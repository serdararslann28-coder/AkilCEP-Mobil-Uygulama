// Controlled lifecycle tests; physical Android audio is not simulated evidence.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const compile = name => ts.transpileModule(fs.readFileSync(path.join(__dirname, "../", name), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.React },
}).outputText;

function harness({ saved = null, web = false, rejectPlay = false, weather = false, cached = false,
  noSavedPlace = false, location = {}, network = null, chooser = false } = {}) {
  let index = 0, dirty = false, result, speaking = false, now = 1000, failWeather = false;
  let slots = [], effects = [], timers = new Map(), store = new Map(), callbacks = new Set();
  const players = [], requests = [], urls = [], warnings = [];
  const logger = { warn: (...args) => warnings.push(args) };
  const rain = { kind: "rain", rain: 1, precipitation: 1, snow: 0, temperature: 15,
    feelsLike: 14, wind: 1, cloudCover: 90, code: 61, isDay: true,
    time: "2026-10-14T12:00", fetchedAt: now };
  const place = { name: "Test city", latitude: 41, longitude: 29, source: "city" };
  if (saved) store.set("akilcep:rain-sound:v1:guest", saved);
  if (weather && !noSavedPlace) store.set("akilcep:weather:v1:guest:place", JSON.stringify(place));
  if (cached) {
    store.set("akilcep:weather:v1:guest:cache", JSON.stringify({ place, data: rain }));
    store.set("akilcep:weather:v1:guest:day", "2026-10-14");
  }
  const props = { data: rain, active: true, blocked: false, userKey: "guest", openingId: 0 };
  const React = {
    createElement: (type, props, ...children) => ({type,props:props??{},children}),
    Fragment: "Fragment",
    useState(initial) {
      const at = index++; slots[at] ??= { value: typeof initial === "function" ? initial() : initial };
      return [slots[at].value, next => {
        if (typeof next === "function") next = next(slots[at].value);
        if (!Object.is(next, slots[at].value)) { slots[at].value = next; dirty = true; }
      }];
    },
    useRef(initial) { const at = index++; return slots[at] ??= { current: initial }; },
    useCallback(fn, deps) {
      const at = index++, old = slots[at];
      if (!old || deps.some((d, i) => !Object.is(d, old.deps[i]))) slots[at] = { deps, fn };
      return slots[at].fn;
    },
    useEffect(fn, deps) {
      const at = index++, old = slots[at];
      if (!old || deps.some((d, i) => !Object.is(d, old.deps[i]))) {
        slots[at] = { deps };
        effects.push(() => { old?.cleanup?.(); slots[at].cleanup = fn(); });
      }
    },
  };
  class Audio {
    constructor() { this.removed = false; this.playing = false; this.listeners = new Set(); players.push(this); }
    play() {
      if (rejectPlay) {
        if (web) return Promise.reject(new Error("NotAllowedError"));
        throw new Error("audio focus denied");
      }
      this.playing = true;
      this.onplaying?.();
      for (const fn of this.listeners) fn({ playing: true, isBuffering: false });
      return web ? Promise.resolve() : undefined;
    }
    pause() { this.playing = false; }
    remove() { this.removed = true; this.playing = false; }
    removeAttribute() { this.removed = true; }
    load() {}
    addListener(name, fn) { this.listeners.add(fn); return { remove: () => this.listeners.delete(fn) }; }
  }
  const AppState = { currentState: "active", addEventListener(name, fn) {
    callbacks.add(fn); return { remove: () => callbacks.delete(fn) };
  } };
  const weatherApi = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, "../../lib/weather.ts"), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, {
    exports: weatherApi, URLSearchParams, AbortController, setTimeout, clearTimeout,
    require: () => ({getApiBase: () => "https://test.invalid/api"}),
    console: logger,
    fetch: async (url, options) => { urls.push(url); return network(url, options); },
    Date: class extends Date { static now() { return now; } },
  });
  const modules = {
    react: React, "react-native": new Proxy({
      Platform: { OS: web ? "web" : "android" }, AppState,
      StyleSheet:{create:v=>v,absoluteFill:{},hairlineWidth:1}, Linking:{openURL(){}},
    }, {get:(target,key)=>key in target?target[key]:key}),
    "@expo/vector-icons":{Feather:"Feather"},
    "react-native-keyboard-controller":{KeyboardAvoidingView:"KeyboardAvoidingView"},
    "@/components/WeatherAtmosphere":{__esModule:true,default:"WeatherAtmosphere"},
    "expo-router": { useFocusEffect() {} }, "expo-location": {
      Accuracy: { Lowest: 1 },
      async getForegroundPermissionsAsync() { return { granted: false }; },
      async requestForegroundPermissionsAsync() { return { granted: false }; },
      async hasServicesEnabledAsync() { return true; },
      async getLastKnownPositionAsync() { return null; },
      ...location,
    },
    "@react-native-async-storage/async-storage": {
      async getItem(k) { return store.get(k) ?? null; }, async setItem(k, v) { store.set(k, v); },
      async removeItem(k) { store.delete(k); },
    },
    "expo-audio": { createAudioPlayer: () => new Audio() },
    "expo-asset": { Asset: { fromModule: () => ({ uri: "rain.mp3" }) } },
    "expo-speech": { async isSpeakingAsync() {
      if (speaking === "error") throw new Error("unavailable");
      return speaking;
    } },
    "@/lib/weather": {
      ...weatherApi,
      WEATHER_TTL: 900_000, WEATHER_MAX_AGE: 2700_000,
      weatherDay: d => d.time.slice(0, 10), weatherGreeting: () => "Rain",
      async fetchWeather(p, signal) {
        requests.push({ p, signal });
        if (failWeather) throw new Error("HTTP 503");
        if (network) return weatherApi.fetchWeather(p, signal);
        return { ...rain, fetchedAt: now };
      },
    },
  };
  const exports = {};
  const schedule = (fn, ms) => { const id = Symbol(); timers.set(id, { fn, at: now + ms }); return id; };
  vm.runInNewContext(compile(weather ? "useWeatherAtmosphere.ts" : "useRainAmbience.ts"), {
    exports, require: name => name.endsWith(".mp3") ? 1 : modules[name],
    setTimeout: schedule, clearTimeout: id => timers.delete(id),
    setInterval: () => Symbol(), clearInterval() {}, AbortController, Audio,
    Date: class extends Date { static now() { return now; } },
    console: logger,
  });
  const ui = {};
  if (chooser) vm.runInNewContext(compile("../components/WeatherExperience.tsx"), {
    exports:ui,require:name=>modules[name],AbortController,console:logger,
    setTimeout:schedule,clearTimeout:id=>timers.delete(id),
  });
  let tree;
  function nodes() {
    const out=[];
    (function visit(n){if(!n||typeof n!=="object")return;out.push(n);n.children?.flat(Infinity).forEach(visit);})(tree);
    return out;
  }
  function render() {
    let loops = 0;
    do {
      if (++loops > 30) throw new Error("render loop");
      dirty = false; index = 0;
      result = weather ? exports.useWeatherAtmosphere("guest") : exports.useRainAmbience(props);
      if (chooser) tree=ui.default({weather:result,isDark:false,bottomInset:24,enabled:true});
      effects.splice(0).forEach(fn => fn());
    } while (dirty);
  }
  async function flush() {
    // UI -> hook -> service VM promises -> storage -> modal close cross realms.
    for (let i = 0; i < 64; i++) { await Promise.resolve(); if (dirty) render(); }
  }
  render();
  return {
    players, requests, props, store, urls, warnings, searchCities: weatherApi.searchWeatherCities, get: () => result, flush,
    find:id=>nodes().find(n=>n.props.testID===id),
    text:()=>nodes().filter(n=>n.type==="Text").flatMap(n=>n.children).join(" "),
    modalOpen:()=>nodes().find(n=>n.type==="Modal")?.props.visible,
    async update(next) { Object.assign(props, next); render(); await flush(); },
    async toggle() { result.toggle(); render(); await flush(); },
    async speech(value) { speaking = value; await this.advance(150); },
    async advance(ms) {
      const end = now + ms;
      while (true) {
        const next = [...timers].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        now = next[1].at; timers.delete(next[0]); next[1].fn(); await flush();
      }
      now = end; await flush();
    },
    async app(state) {
      AppState.currentState = state;
      for (const fn of callbacks) fn(state);
      await flush();
    },
    setWeatherFailure() { failWeather = true; },
    setCondition(next) { Object.assign(rain, next); },
    unmount() { slots.forEach(s => s?.cleanup?.()); },
    async remount() { this.unmount(); slots = []; render(); await flush(); },
  };
}
const forecastBody = { provider: "open-meteo", current: {
  time: "2026-10-14T12:00", temperature_2m: 18.4, apparent_temperature: 18, is_day: 1,
  precipitation: 1, rain: 1, showers: 0, snowfall: 0, weather_code: 61, cloud_cover: 90, wind_speed_10m: 12,
} };
const response = body => ({ ok: true, status: 200, async json() { return body; } });
const cityPlace = { name: "Test city", latitude: 41.01, longitude: 28.98, source: "city" };
test("city chooser shows quota failure honestly, not empty results or fake weather",async()=>{
  const h=harness({weather:true,chooser:true,noSavedPlace:true,network:async()=>({
    ok:false,status:429,json:async()=>({code:"provider_quota_exceeded"}),
  })});
  await h.flush();h.find("weather-city-input").props.onChangeText("Ankara");
  await h.flush();await h.advance(350);
  assert.match(h.text(),/kullanım sınırına/);
  assert.equal(h.get().data,null);assert.equal(h.get().live,false);
  assert.equal(h.modalOpen(),true);h.unmount();
});

test("actual chooser: typing, failed geocoding, Search-key retry, selecting coordinates, forecast and atmosphere", async () => {
  let searches=0;
  const h=harness({weather:true,chooser:true,noSavedPlace:true,network:async url=>{
    if(url.includes("/weather/cities")) return ++searches===1 ? {ok:false,status:503} : response({results:[cityPlace]});
    return response(forecastBody);
  }});
  await h.flush(); assert.equal(h.modalOpen(),true);
  h.find("weather-city-input").props.onChangeText("Ankara"); await h.flush();
  assert.match(h.text(),/Aranıyor/); await h.advance(350);
  assert.match(h.text(),/Şehir araması yapılamadı/); assert.equal(h.requests.length,0);
  h.find("weather-city-input").props.onSubmitEditing(); await h.flush(); await h.advance(350);
  const result=h.find("weather-city-result-0"); assert.ok(result);
  result.props.onPress(); await h.flush();
  assert.equal(searches,2); assert.equal(h.requests.length,1);
  const forecast=new URL(h.urls.find(url=>url.includes("/weather/current")));
  assert.equal(forecast.searchParams.get("latitude"),String(cityPlace.latitude));
  assert.equal(forecast.searchParams.get("longitude"),String(cityPlace.longitude));
  assert.equal(h.get().data.temperature,forecastBody.current.temperature_2m);
  assert.equal(h.get().atmosphereData.kind,"rain"); assert.equal(h.modalOpen(),false);
  assert.doesNotMatch(h.text(),/Open-Meteo/); h.unmount();
});

test("actual location button: foreground permission, services, GPS, forecast and visible weather use one chain", async () => {
  const calls=[];
  const h=harness({weather:true,chooser:true,noSavedPlace:true,network:async()=>response(forecastBody),location:{
    async requestForegroundPermissionsAsync(){calls.push("permission");return {granted:true};},
    async hasServicesEnabledAsync(){calls.push("services");return true;},
    async getLastKnownPositionAsync(){calls.push("cache");return null;},
    async getCurrentPositionAsync(){calls.push("gps");return {coords:{latitude:40.1234,longitude:29.4567}};},
  }});
  await h.flush(); h.find("weather-location-button").props.onPress(); await h.flush();
  assert.deepEqual(calls,["permission","services","cache","gps"]); assert.equal(h.requests.length,1);
  const forecast=new URL(h.urls[0]);
  assert.equal(forecast.searchParams.get("latitude"),"40.12");
  assert.equal(forecast.searchParams.get("longitude"),"29.46");
  assert.equal(h.get().place.source,"device"); assert.equal(h.modalOpen(),false);
  assert.equal(h.get().data.temperature,forecastBody.current.temperature_2m);
  assert.equal(h.get().atmosphereData.kind,"rain"); h.unmount();
});

test("actual chooser shows denied permission, empty search, and retryable offline search without closing", async () => {
  let offline=false;
  const h=harness({weather:true,chooser:true,noSavedPlace:true,network:async()=>{
    if(offline)throw new TypeError("Network request failed");
    return response({});
  }});
  await h.flush(); h.find("weather-location-button").props.onPress(); await h.flush();
  assert.match(h.text(),/Konum izni verilmedi/); assert.equal(h.requests.length,0);
  h.find("weather-city-input").props.onChangeText("Unknown"); await h.flush(); await h.advance(350);
  assert.match(h.text(),/bir yer bulamadık/);
  offline=true; h.find("weather-city-input").props.onSubmitEditing(); await h.flush(); await h.advance(350);
  assert.match(h.text(),/İnternet bağlantını/); assert.equal(h.modalOpen(),true);
  assert.equal(h.get().atmosphereData,null); assert.equal(h.warnings.at(-1)[1].code,"network");
  h.unmount();
});

test("OS dialog inactive/active cannot cancel an interactive city forecast", async () => {
  let finish;
  const h = harness({weather:true,noSavedPlace:true,network:() => new Promise(resolve => { finish=resolve; })});
  await h.flush();
  const selected=h.get().selectPlace(cityPlace); await h.flush();
  await h.app("inactive"); await h.app("active");
  finish(response(forecastBody)); const ok=await selected; await h.flush();
  const visible=h.get().needsCity, live=h.get().live; h.unmount();
  assert.equal(ok,true); assert.equal(visible,false); assert.equal(live,true);
});

test("foreground return does not replace a pending manual GPS forecast", async () => {
  const finish=[];
  const h=harness({weather:true,noSavedPlace:true,network:() => new Promise(resolve => finish.push(resolve)),location:{
    async requestForegroundPermissionsAsync(){return {granted:true};},
    async getLastKnownPositionAsync(){return {coords:{latitude:41.1234,longitude:29.4567}};},
  }});
  await h.flush(); const located=h.get().useDeviceLocation(); await h.flush();
  await h.app("background"); await h.app("active");
  finish.forEach(resolve=>resolve(response(forecastBody)));
  await located; await h.flush();
  const count=h.requests.length, visible=h.get().needsCity, live=h.get().live; h.unmount();
  assert.equal(count,1); assert.equal(visible,false); assert.equal(live,true);
});

test("city geocoding -> selected coordinates -> real parser: panel waits for forecast and 30s budget never replays", async () => {
  let finishForecast, forecastCount = 0;
  const h = harness({ weather: true, noSavedPlace: true, network: async url => {
    if (url.includes("/weather/cities")) return response({ results: [cityPlace] });
    if (++forecastCount > 1) return response(forecastBody);
    return new Promise(resolve => { finishForecast = resolve; });
  } });
  await h.flush();
  const places = await h.searchCities("İstanbul");
  const selection = h.get().selectPlace(places[0]); await h.flush();
  assert.equal(h.get().loading, true); assert.equal(h.get().needsCity, true);
  assert.equal(h.get().live, false);
  finishForecast(response(forecastBody)); assert.equal(await selection, true); await h.flush();
  assert.equal(h.get().loading, false); assert.equal(h.get().needsCity, false);
  assert.equal(h.get().data.temperature, 18.4); assert.equal(h.get().atmosphereData.kind, "rain");
  const forecast = new URL(h.urls.find(u => u.includes("/weather/current")));
  assert.equal(forecast.searchParams.get("latitude"), "41.01");
  assert.equal(forecast.searchParams.get("longitude"), "28.98");
  await h.advance(30_000); assert.equal(h.get().atmosphereData, null);
  await h.remount(); assert.equal(h.get().atmosphereData, null);
  h.unmount();
});

test("denied Android permission is visible and city search still completes", async () => {
  const h = harness({ weather: true, noSavedPlace: true, network: async url =>
    response(url.includes("/weather/cities") ? { results: [cityPlace] } : forecastBody) });
  await h.flush(); await h.get().useDeviceLocation(); await h.flush();
  assert.match(h.get().error, /Konum izni verilmedi.*Şehir/);
  assert.equal(h.get().needsCity, true); assert.equal(h.requests.length, 0);
  assert.equal(h.warnings[0][1].code, "permission");
  const places = await h.searchCities("İstanbul");
  assert.equal(await h.get().selectPlace(places[0]), true); await h.flush();
  assert.equal(h.get().error, null); assert.equal(h.get().live, true); h.unmount();
});

test("Android cached-position failure falls through to GPS and sends only coarse coordinates", async () => {
  let gps = 0;
  const h = harness({ weather: true, noSavedPlace: true, network: async () => response(forecastBody), location: {
    async requestForegroundPermissionsAsync() { return { granted: true }; },
    async getLastKnownPositionAsync() { throw new Error("Location cache unavailable"); },
    async getCurrentPositionAsync() { gps++; return { coords: { latitude: 40.1234, longitude: 29.4567 } }; },
  } });
  await h.flush(); await h.get().useDeviceLocation(); await h.flush();
  assert.equal(gps, 1); assert.equal(h.requests.length, 1);
  assert.equal(h.get().live, true); assert.equal(h.get().data.temperature, 18.4);
  assert.equal(h.get().needsCity, false); assert.equal(h.get().locating, false);
  const params = new URL(h.urls[0]).searchParams;
  assert.equal(params.get("latitude"), "40.12"); assert.equal(params.get("longitude"), "29.46");
  assert.equal(h.warnings[0][1].stage, "location-cache"); h.unmount();
});

test("disabled Android location services and GPS timeout remain actionable, not silent", async () => {
  const disabled = harness({ weather: true, noSavedPlace: true, location: {
    async requestForegroundPermissionsAsync() { return { granted: true }; },
    async hasServicesEnabledAsync() { return false; },
  } });
  await disabled.flush(); await disabled.get().useDeviceLocation(); await disabled.flush();
  assert.match(disabled.get().error, /konum hizmetleri kapalı/); assert.equal(disabled.requests.length, 0);
  disabled.unmount();
  const timeout = harness({ weather: true, noSavedPlace: true, location: {
    async requestForegroundPermissionsAsync() { return { granted: true }; },
    getCurrentPositionAsync() { return new Promise(() => {}); },
  } });
  await timeout.flush(); const attempt = timeout.get().useDeviceLocation(); await timeout.flush();
  await timeout.advance(8000); await attempt; await timeout.flush();
  assert.match(timeout.get().error, /zaman aşımına/); assert.equal(timeout.get().locating, false);
  assert.equal(timeout.get().needsCity, true); assert.equal(timeout.requests.length, 0);
  timeout.unmount();
});

test("forecast HTTP failure leaves panel open, logs status, and explicit retry bypasses cache throttle", async () => {
  let healthy = false;
  const h = harness({ weather: true, noSavedPlace: true, network: async () =>
    healthy ? response(forecastBody) : { ok: false, status: 503 } });
  await h.flush(); assert.equal(await h.get().selectPlace(cityPlace), false); await h.flush();
  assert.equal(h.get().needsCity, true); assert.equal(h.get().loading, false); assert.equal(h.get().live, false);
  assert.match(h.get().error, /Hava bilgisi alınamadı/);
  assert.equal(h.warnings[0][1].stage, "forecast"); assert.equal(h.warnings[0][1].status, 503);
  healthy = true; assert.equal(await h.get().selectPlace(cityPlace), true); await h.flush();
  assert.equal(h.requests.length, 2); assert.equal(h.get().error, null); assert.equal(h.get().live, true);
  h.unmount();
});

test("invalid coordinates and malformed forecast cannot close panel or create an atmosphere", async () => {
  const h = harness({ weather: true, noSavedPlace: true, network: async () => response({ current: {} }) });
  await h.flush(); assert.equal(await h.get().selectPlace({ ...cityPlace, latitude: 91 }), false); await h.flush();
  assert.match(h.get().error, /Konum bilgisi geçersiz/); assert.equal(h.requests.length, 0);
  assert.equal(await h.get().selectPlace(cityPlace), false); await h.flush();
  assert.match(h.get().error, /Hava bilgisi okunamadı/); assert.equal(h.get().needsCity, true);
  assert.equal(h.get().atmosphereData, null); h.unmount();
});

test("late automatic location cannot overwrite the user's successful city selection", async () => {
  let finishLocation;
  const h = harness({ weather: true, noSavedPlace: true, network: async () => response(forecastBody), location: {
    async getForegroundPermissionsAsync() { return { granted: true }; },
    getLastKnownPositionAsync() { return new Promise(resolve => { finishLocation = resolve; }); },
  } });
  await h.flush(); h.get().openCity(); await h.flush();
  await h.get().selectPlace(cityPlace); await h.flush();
  finishLocation({ coords: { latitude: 20, longitude: 30 } }); await h.flush();
  assert.equal(h.get().place.source, "city"); assert.equal(h.requests.length, 1);
  assert.equal(h.get().needsCity, false); h.unmount();
});

test("late cancelled forecast cannot reopen panel after a newer selection", async () => {
  let finishFirst, count = 0;
  const h = harness({ weather: true, noSavedPlace: true, network: async () => {
    if (++count === 1) return new Promise(resolve => { finishFirst = resolve; });
    return response(forecastBody);
  } });
  await h.flush();
  const first = h.get().selectPlace(cityPlace); await h.flush();
  assert.equal(await h.get().selectPlace(cityPlace), true); await h.flush();
  finishFirst(response(forecastBody)); assert.equal(await first, false); await h.flush();
  assert.equal(h.get().needsCity, false); assert.equal(h.get().live, true);
  assert.equal(h.warnings.length, 0); h.unmount();
});

test("Daha sonra dismisses pending forecast or GPS without late results reopening the panel", async () => {
  let finishForecast;
  const h = harness({ weather: true, noSavedPlace: true, network: () => new Promise(resolve => { finishForecast = resolve; }) });
  await h.flush(); const request = h.get().selectPlace(cityPlace); await h.flush();
  h.get().dismissCity(); await h.flush();
  finishForecast({ ok: false, status: 503 }); assert.equal(await request, false); await h.flush();
  assert.equal(h.get().needsCity, false); assert.equal(h.get().loading, false);
  assert.equal(h.warnings.length, 0); h.unmount();
  let finishGps;
  const gps = harness({ weather: true, noSavedPlace: true, location: {
    async requestForegroundPermissionsAsync() { return { granted: true }; },
    getCurrentPositionAsync() { return new Promise(resolve => { finishGps = resolve; }); },
  } });
  await gps.flush(); const attempt = gps.get().useDeviceLocation(); await gps.flush();
  gps.get().dismissCity(); await gps.flush();
  finishGps({ coords: { latitude: 41, longitude: 29 } }); await attempt; await gps.flush();
  assert.equal(gps.get().needsCity, false); assert.equal(gps.get().locating, false);
  assert.equal(gps.requests.length, 0); gps.unmount();
});

test("fresh rain auto-starts once, stays on for 29999ms and releases at 30000ms", async () => {
  const h = harness(); await h.flush();
  const p = h.players[0];
  assert.equal(p.playing, true); assert.equal(p.loop, true); assert.equal(p.volume, 0.12);
  await h.advance(29_999); assert.equal(p.playing, true);
  await h.advance(1); assert.equal(p.playing, false); assert.equal(p.removed, true);
  await h.update({ data: { ...h.props.data } }); await h.toggle(); await h.toggle();
  await h.remount(); assert.equal(h.players.length, 1);
  await h.update({ openingId: 1 }); assert.equal(h.players.length, 2);
  h.unmount();
});
test("saved mute is respected; preference toggle persists but cannot reset the deadline", async () => {
  const h = harness({ saved: "off" }); await h.flush();
  assert.equal(h.players.length, 0);
  await h.toggle(); assert.equal(h.players.length, 1);
  await h.advance(10_000); await h.toggle();
  assert.equal(h.store.get("akilcep:rain-sound:v1:guest"), "off");
  await h.advance(25_000); await h.toggle();
  assert.equal(h.players.length, 1); h.unmount();
});
test("voice and chat inactivity release resources; pauses do not extend the 30s budget", async () => {
  const h = harness(); await h.flush();
  await h.advance(10_000); await h.update({ blocked: true });
  assert.equal(h.players[0].removed, true);
  await h.advance(5_000); await h.update({ blocked: false });
  assert.equal(h.players[1].playing, true);
  await h.advance(14_999); assert.equal(h.players[1].playing, true);
  await h.advance(1); assert.equal(h.players[1].removed, true);
  await h.update({ active: false }); await h.update({ active: true });
  assert.equal(h.players.length, 2); h.unmount();
});
test("read aloud pauses within the same window; unavailable TTS status remains silent", async () => {
  const h = harness(); await h.flush();
  await h.speech(true); assert.equal(h.players[0].playing, false);
  await h.speech(false); assert.equal(h.players[0].playing, true);
  await h.speech("error"); assert.equal(h.players[0].playing, false);
  await h.advance(30_000); assert.equal(h.players[0].removed, true); h.unmount();
});
test("missing, dry, and failed weather cannot start audio; wet storm may start", async () => {
  const h = harness(); await h.update({ data: null }); await h.flush();
  const count = h.players.length;
  for (const data of [{ kind: "clouds" }, { kind: "snow" }, { kind: "storm", rain: 0, precipitation: 0 }]) {
    await h.update({ data }); assert.equal(h.players.length, count);
  }
  await h.update({ data: { kind: "storm", rain: 1, precipitation: 1 } });
  assert.equal(h.players.at(-1).playing, true);
  await h.update({ data: null }); assert.equal(h.players.at(-1).removed, true); h.unmount();
});
test("web autoplay denial and native playback errors release without claiming playback", async () => {
  for (const web of [true, false]) {
    const h = harness({ web, rejectPlay: true }); await h.flush();
    assert.equal(h.get().failed, true);
    assert.equal(h.players[0].playing, false); assert.equal(h.players[0].removed, true);
    h.unmount();
  }
});
test("browser playback expires at 30s and detaches the real media source", async () => {
  const h = harness({ web: true }); await h.flush();
  await h.advance(29_999); assert.equal(h.players[0].playing, true);
  await h.advance(1);
  assert.equal(h.players[0].removed, true); assert.equal(h.players[0].playing, false); h.unmount();
});
test("foreground refresh fetches live weather without granting a new opening; failures are not live", async () => {
  const h = harness({ weather: true, cached: true }); await h.flush();
  assert.equal(h.requests.length, 1); assert.equal(h.get().live, true);
  await h.app("background"); assert.equal(h.get().live, false); assert.equal(h.get().active, false);
  await h.app("active");
  assert.equal(h.requests.length, 2); assert.equal(h.get().openingId, 0); assert.equal(h.get().live, true);
  h.setWeatherFailure();
  await h.app("background"); await h.app("active");
  assert.equal(h.requests.length, 3); assert.equal(h.get().live, false);
  assert.equal(h.get().active, true); h.unmount();
});

test("rain visuals expire independently at 30s and cannot replay on remount or background return", async () => {
  const h = harness({ weather: true, saved: "off" }); await h.flush();
  assert.equal(h.get().atmosphereData.kind, "rain", "muting sound must not suppress visuals");
  await h.advance(29_999); assert.equal(h.get().atmosphereData.kind, "rain");
  await h.advance(1); assert.equal(h.get().atmosphereData, null);
  assert.equal(h.get().data.kind, "rain", "visual expiry must not hide live data from the audio hook");
  assert.equal(h.get().live, true);
  await h.remount(); assert.equal(h.get().atmosphereData, null);
  await h.app("background"); await h.app("active");
  assert.equal(h.get().atmosphereData, null, "background return must not renew the visual allowance");
  h.unmount();
  const reopened = harness({ weather: true }); await reopened.flush();
  assert.equal(reopened.get().atmosphereData.kind, "rain", "a fresh app runtime gets a new allowance");
  reopened.unmount();
});
test("background time counts towards the original visual deadline", async () => {
  const h = harness({ weather: true }); await h.flush();
  await h.advance(10_000); await h.remount(); await h.app("background");
  assert.equal(h.get().atmosphereData, null);
  await h.advance(5_000); await h.app("active");
  assert.equal(h.get().atmosphereData.kind, "rain");
  await h.advance(14_999); assert.equal(h.get().atmosphereData.kind, "rain");
  await h.advance(1); assert.equal(h.get().atmosphereData, null);
  h.unmount();
});
test("fresh weather after a background return cannot restart expired audio or visuals", async () => {
  const weather = harness({ weather: true }); await weather.flush();
  const audio = harness(); await audio.flush();
  await weather.advance(10_000); await audio.advance(10_000);
  await weather.app("background");
  await audio.update({ active: weather.get().active, data: null, openingId: weather.get().openingId });
  assert.equal(audio.players[0].removed, true);
  await weather.advance(25_000); await audio.advance(25_000);
  await weather.app("active");
  assert.equal(weather.get().live, true);
  assert.equal(weather.get().atmosphereData, null);
  await audio.update({ active: weather.get().active, data: weather.get().data, openingId: weather.get().openingId });
  assert.equal(audio.players.length, 1, "fresh forecast must not grant another audio allowance");
  weather.unmount(); audio.unmount();
});
test("cached rain on API failure cannot darken", async () => {
  const h = harness({ weather: true, cached: true });
  h.setWeatherFailure(); await h.flush();
  assert.equal(h.get().live, false); assert.equal(h.get().atmosphereData, null);
  h.unmount();
});
test("all real weather kinds share the 30s visual allowance without losing forecast data", async () => {
  for (const kind of ["sun", "clouds", "snow", "fog", "partly-cloudy", "storm"]) {
    const h = harness({ weather: true });
    h.setCondition({ kind, rain: 0, precipitation: 0, code: 3 }); await h.flush();
    assert.equal(h.get().atmosphereData.kind, kind);
    await h.advance(29_999); assert.equal(h.get().atmosphereData.kind, kind);
    await h.advance(1); assert.equal(h.get().atmosphereData, null);
    assert.equal(h.get().data.kind, kind);
    await h.remount(); assert.equal(h.get().atmosphereData, null);
    h.unmount();
  }
});
test("audio and separate weather row share the atmosphere window instead of retained forecast data", () => {
  const chat = fs.readFileSync(path.join(__dirname, "../../app/chat.tsx"), "utf8");
  assert.match(chat, /useRainAmbience\(\{\s*data: weather\.atmosphereData/);
  assert.match(chat, /const weatherRowData = !voiceStageEnabled && weather\.live && weather\.atmosphereData &&\s*Number\.isFinite\(weather\.atmosphereData\.temperature\)/);
  const experience = fs.readFileSync(path.join(__dirname, "../../components/WeatherExperience.tsx"), "utf8");
  assert.match(experience, /WeatherAtmosphere data=\{enabled \? weather\.atmosphereData : null\}/);
});
test("audio starting late stops at the shared 30s deadline and cannot restart afterwards", async () => {
  const weather = harness({ weather: true }); await weather.flush();
  const audio = harness(); await audio.update({ active: false, data: null });
  await weather.advance(10_000); await audio.advance(10_000);
  await audio.update({ active: true, data: weather.get().atmosphereData });
  assert.equal(audio.players[0].playing, true);
  await weather.advance(19_999); await audio.advance(19_999);
  assert.equal(audio.players[0].playing, true);
  await weather.advance(1); await audio.advance(1);
  assert.equal(weather.get().atmosphereData, null);
  await audio.update({ data: weather.get().atmosphereData });
  assert.equal(audio.players[0].removed, true);
  assert.equal(audio.players[0].playing, false);
  await weather.remount(); await weather.app("background"); await weather.app("active");
  await audio.update({ data: weather.get().atmosphereData });
  await audio.toggle(); await audio.toggle();
  assert.equal(audio.players.length, 1);
  weather.unmount(); audio.unmount();
});
