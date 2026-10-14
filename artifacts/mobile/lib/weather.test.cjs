const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const path = require("node:path");
const source = fs.readFileSync(path.join(__dirname, "weather.ts"), "utf8");
test("Expo config and tracked Android manifest both declare foreground location permissions", () => {
  const config=JSON.parse(fs.readFileSync(path.join(__dirname,"../app.json"),"utf8").replace(/,\s*([}\]])/g,"$1"));
  const manifest=fs.readFileSync(path.join(__dirname,"../android/app/src/main/AndroidManifest.xml"),"utf8");
  for(const permission of ["android.permission.ACCESS_COARSE_LOCATION","android.permission.ACCESS_FINE_LOCATION"]){
    assert.ok(config.expo.android.permissions.includes(permission));
    assert.ok(manifest.includes(`android:name="${permission}"`));
  }
  assert.equal(config.expo.android.package,"com.akilcep.ai");
});
function load(fetch = async () => { throw new Error("offline"); }) {
  const exports = {};
  const context = { exports, fetch, URLSearchParams, AbortController, setTimeout, clearTimeout, Date, Number,
    require: () => ({ getApiBase: () => "https://test.invalid/api" }) };
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, context);
  return exports;
}
const current = (code, more = {}) => ({ current: {
  time: "2026-10-14T08:00", temperature_2m: 14, apparent_temperature: 13, is_day: 1,
  precipitation: 0, rain: 0, showers: 0, snowfall: 0, weather_code: code,
  cloud_cover: 30, wind_speed_10m: 12, ...more,
} });
test("real-condition description stays in the timed weather row without visible provider branding",()=>{
  const data={...load().parseWeather(current(61)),provider:"open-meteo",description:"Hafif yağmurlu"};
  const nodes=renderWeatherHeader({live:true,data,atmosphereData:data},320);
  const row=nodes.find(n=>n.props.testID==="chat-weather-indicator");
  assert.match(row.props.accessibilityLabel,/Hafif yağmurlu/);
  assert.doesNotMatch(row.props.accessibilityLabel,/Google|Open.Meteo/i);
  assert.equal(row.children[1].children.at(-1),"Hafif yağmurlu");
  assert.equal(row.children.length,2);
  assert.equal(renderWeatherHeader({live:false,data,atmosphereData:null},320)
    .some(n=>n.props.testID==="chat-weather-indicator"),false);
});
test("keyless-provider errors are actionable and legacy weather cannot masquerade as current data",async()=>{
  const place={name:"Test",latitude:39.9,longitude:32.8,source:"city"};
  for(const [code,expected] of [["provider_timeout","timeout"],["provider_quota_exceeded","provider_quota_exceeded"],["provider_response_invalid","response"],["provider_connection_failed","network"]]){
    const w=load(async()=>({ok:false,status:503,json:async()=>({code})}));
    await assert.rejects(w.fetchWeather(place),e=>e.code===expected&&w.weatherErrorMessage(e).length>20);
  }
  await assert.rejects(load(async()=>({ok:true,json:async()=>current(61)})).fetchWeather(place),
    e=>e.code==="response");
});
// Render the actual inline header JSX without starting the native app.
function renderWeatherHeader(weather, width = 320, voiceStageEnabled = false, isDark = false) {
  const chat = fs.readFileSync(path.join(__dirname, "../app/chat.tsx"), "utf8");
  const mapping = chat.match(/const HEADER_WEATHER = \{[\s\S]*?\} as const;/)[0];
  const palette = chat.match(/const WEATHER_BLUE = \{.*?\} as const;/)[0];
  const rowData = chat.match(/const weatherRowData = [\s\S]*?;/)[0];
  const start = chat.indexOf('<View pointerEvents="box-none" style={[ss.topOverlay');
  const end = chat.indexOf("      {moreOpen &&", start);
  const exports = {};
  vm.runInNewContext(ts.transpileModule(`${palette}\n${mapping}\n${rowData}\nexports.tree = (<>${chat.slice(start, end).trim()}</>);`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2020 },
  }).outputText, {
    exports, weather, winW: width, voiceStageEnabled, topPad: 24, leafOnly: 1, SURFACE_LIGHT: "white", SURFACE_DARK: "black",
    ss: {}, StyleSheet: { absoluteFill: {} }, T: { isDark, fgSoft: isDark ? "#C4C2BC" : "#303030" },
    React: { Fragment: "Fragment", createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }) },
    View: "View", Text: "Text", Image: "Image", Feather: "Feather", Pressable: "Pressable",
    openMenu() {}, setMenuVisible() {}, beginNewConversation() {}, setMoreOpen() {},
  });
  const nodes = [];
  const walk = node => {
    if (!node || typeof node !== "object") return;
    nodes.push(node); node.children?.forEach(walk);
  };
  walk(exports.tree);
  return nodes;
}
test("separate weather row displays real temperature and description then disappears at expiry", () => {
  const data = load().parseWeather(current(61, { temperature_2m: 18.4 }));
  const weather = { live: true, data, atmosphereData: data };
  const nodes = renderWeatherHeader(weather);
  const indicator = nodes.find(n => n.props.testID === "chat-weather-indicator");
  assert.ok(indicator);
  assert.equal(indicator.props.pointerEvents, "none");
  assert.match(indicator.props.accessibilityLabel, /Yağmurlu, 18 derece Celsius/);
  assert.equal(indicator.children[0].props.name, "cloud-rain");
  assert.deepEqual(Array.from(indicator.children[1].children[0].children), [18, "°"]);
  assert.deepEqual(Array.from(indicator.children[1].children).slice(1), [" · ", "Yağmurlu"]);
  assert.equal(indicator.children[0].props.color, "#1976D2");
  assert.equal(indicator.children[1].children[0].props.style.color, "#1976D2");
  assert.equal(indicator.children[1].props.style[1].color, "#303030", "description retains dark readable text");
  const dark = renderWeatherHeader(weather, 320, false, true).find(n => n.props.testID === "chat-weather-indicator");
  assert.equal(dark.children[0].props.color, "#64B5F6");
  assert.equal(dark.children[1].children[0].props.style.color, "#64B5F6");
  assert.equal(dark.children[1].props.style[1].color, "#C4C2BC");
  assert.equal(indicator.props.style[1].top, 86);
  const topBar = nodes.find(n => n.props.pointerEvents === "box-none");
  assert.equal(topBar.children[1].props.testID, "chat-menu-button", "menu stays directly in the original top bar");
  assert.equal(nodes[0].children[1], indicator, "weather row must be outside the top bar");
  assert.deepEqual(nodes.filter(n => n.type === "Pressable").map(n => n.props.testID),
    ["chat-menu-button", "chat-new-button", "chat-more-button"]);
  assert.equal(nodes.find(n => n.type === "Image").props.style.width, 27);
  weather.data = load().parseWeather(current(0, { temperature_2m: -2.6, is_day: 0 }));
  weather.atmosphereData = weather.data;
  const changed = renderWeatherHeader(weather).find(n => n.props.testID === "chat-weather-indicator");
  assert.equal(changed.children[0].props.name, "moon");
  assert.deepEqual(Array.from(changed.children[1].children[0].children), [-3, "°"]);
  assert.deepEqual(Array.from(changed.children[1].children).slice(1), [" · ", "Açık"]);
  weather.atmosphereData = null;
  assert.equal(renderWeatherHeader(weather).some(n => n.props.testID === "chat-weather-indicator"), false);
  assert.ok(weather.data, "retained forecast must not keep the expired header visible");
});
test("weather row hides unavailable data and preserves controls, including on small screens", () => {
  const data = load().parseWeather(current(3, { temperature_2m: 0 }));
  assert.ok(renderWeatherHeader({ live: true, data, atmosphereData: data }).some(n => n.props.testID === "chat-weather-indicator"));
  for (const [weather, width] of [
    [{ live: true, data: null, atmosphereData: null }, 320],
    [{ live: false, data, atmosphereData: data }, 320],
    [{ live: true, data, atmosphereData: { ...data, temperature: NaN } }, 320],
  ]) {
    const nodes = renderWeatherHeader(weather, width);
    assert.equal(nodes.some(n => n.props.testID === "chat-weather-indicator"), false);
    assert.equal(nodes.filter(n => n.type === "Pressable").length, 3);
  }
  assert.ok(renderWeatherHeader({ live: true, data, atmosphereData: data }, 260)
    .some(n => n.props.testID === "chat-weather-indicator"));
  assert.equal(renderWeatherHeader({ live: true, data, atmosphereData: data }, 320, true)
    .some(n => n.props.testID === "chat-weather-indicator"), false);
});
test("weather row reserves a clipped message viewport below it without changing the composer or timer", () => {
  const chat = fs.readFileSync(path.join(__dirname, "../app/chat.tsx"), "utf8");
  assert.match(chat, /overflow: "hidden", marginTop: weatherRowData \? topPad \+ 88 : 0/);
  assert.match(chat, /ListFooterComponent=\{<View style=\{\{ height: weatherRowData \? 8 : topPad \+ 72 \}\}/);
  assert.match(chat, /topWeather: \{ position: "absolute", left: 24, right: 24, height: 20/);
  assert.match(chat, /topWeather: \{[^}\n]*flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5/);
  assert.ok(62 + 20 < 88, "weather line ends before the message viewport begins");
});
for (const [code, kind] of [[0,"sun"], [2,"partly-cloudy"], [3,"clouds"], [45,"fog"],
  [61,"rain"], [71,"snow"], [95,"storm"], [99,"storm"], [85,"snow"], [56,"rain"]]) {
  test(`real WMO code ${code} maps to ${kind}`, () => {
    assert.equal(load().parseWeather(current(code), 100).kind, kind);
  });
}
test("rain/showers/snow influence conditions, not a canned city forecast", () => {
  const w = load();
  assert.equal(w.parseWeather(current(3, { showers: 0.5 })).kind, "rain");
  assert.equal(w.parseWeather(current(3, { snowfall: 0.3 })).kind, "snow");
  assert.equal(w.parseWeather(current(95, { snowfall: 0.3 })).kind, "storm");
});
test("malformed/API error/unknown code fail explicitly without invented weather", () => {
  const w = load();
  for (const c of [null, {error:true}, current(500), current(0, { rain: null })]) {
    assert.throws(() => w.parseWeather(c));
  }
});
test("greeting uses local API date/time and actual weather, including night", () => {
  const w = load(), rain = w.parseWeather(current(61));
  assert.equal(w.weatherDay(rain), "2026-10-14");
  assert.match(w.weatherGreeting(rain), /Günaydın.*yağmur/);
  const night = w.parseWeather(current(0, { time: "2026-10-14T23:00", is_day: 0 }));
  assert.match(w.weatherGreeting(night), /İyi akşamlar.*gece/);
});
test("weather uses existing backend and coordinates, never a client API key or direct provider request", async () => {
  let url;
  const w = load(async u => { url = new URL(u); return { ok: true, json: async () => ({provider:"open-meteo",...current(61)}) }; });
  const data = await w.fetchWeather({name:"Test",latitude:41.01,longitude:28.98,source:"city"});
  assert.equal(url.hostname, "test.invalid");
  assert.equal(url.pathname,"/api/weather/current");
  assert.equal(url.searchParams.get("latitude"),"41.01");
  assert.equal(url.searchParams.get("longitude"),"28.98");
  assert.equal(url.searchParams.has("key"),false);
  assert.equal(url.searchParams.has("apikey"), false);
  assert.equal(data.kind, "rain");
});
test("HTTP failure disables weather path rather than generating fallback data", async () => {
  await assert.rejects(load(async () => ({ ok:false,status:503 })).fetchWeather({ latitude:0,longitude:0 }), /503/);
});
test("city search encodes input, consumes real coordinates, skips short queries", async () => {
  let calls=0, url;
  const w = load(async u => { calls++; url=new URL(u); return {ok:true,json:async()=>({
    results:[{name:"İstanbul",country:"Türkiye",latitude:41.01,longitude:28.98}],
  })}; });
  assert.equal((await w.searchWeatherCities("a")).length,0);
  const places = await w.searchWeatherCities("İstanbul &");
  assert.equal(calls,1);
  assert.equal(url.searchParams.get("query"),"İstanbul &");
  assert.equal(url.pathname,"/api/weather/cities");
  assert.equal(places[0].source,"city");
  assert.equal(places[0].latitude,41.01);
});
test("aborted weather request cannot keep network work alive", async () => {
  const c = new AbortController(); c.abort();
  const w = load(async (_u,{signal}) => {
    assert.equal(signal.aborted,true);
    throw new Error("aborted");
  });
  await assert.rejects(w.fetchWeather({latitude:0,longitude:0},c.signal),/aborted/);
});

test("out-of-range coordinates never reach the weather network", async () => {
  let calls = 0;
  const w = load(async () => { calls++; });
  for (const coordinates of [{latitude:NaN,longitude:0},{latitude:91,longitude:0},{latitude:0,longitude:-181}]) {
    await assert.rejects(w.fetchWeather(coordinates), /Invalid weather coordinates/);
  }
  assert.equal(calls, 0);
});
test("malformed geocoding and invalid result coordinates are errors, but genuine empty results are valid", async () => {
  for (const body of [null, [], {error:true}, {results:{}}, {results:[{name:"Invalid",latitude:91,longitude:0}]}]) {
    await assert.rejects(load(async () => ({ok:true,json:async()=>body})).searchWeatherCities("Ankara"));
  }
  assert.equal((await load(async () => ({ok:true,json:async()=>({generationtime_ms:1})})).searchWeatherCities("unknown")).length, 0);
});
test("developer weather errors retain stage/status but redact URLs and coordinates; UI text contains no provider name", () => {
  const w = load(); let log;
  // Use the actual reporter's VM with a captured console, not console output containing coordinates.
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,
    {exports,require:()=>({getApiBase:()=>"/api"}),console:{warn:(...args)=>{log=args;}}});
  exports.reportWeatherError("device-location", {code:"E_LOCATION",message:"Failed at 41.12345, 29.45678 https://example.test/?latitude=41.12345"});
  assert.equal(log[1].stage, "device-location"); assert.equal(log[1].code, "E_LOCATION");
  assert.doesNotMatch(log[1].detail, /41\.12345|29\.45678|https:/);
  for (const code of ["permission","services","location","timeout","coordinates","response","http","network"]) {
    const text = w.weatherErrorMessage(new w.WeatherError(code, "diagnostic", 503));
    assert.ok(text); assert.doesNotMatch(text, /Open-Meteo/);
  }
});

function renderCityChooser(weather, { query = "", results = [], status = "idle" } = {}) {
  let index = 0;
  const states = [query, results, status], writes = [], exports = {};
  const React = { createElement: (type, props, ...children) => ({type,props:props??{},children}),
    Fragment:"Fragment", useEffect(){}, useRef:v=>({current:v}),
    useState() { const at = index++; return [states[at], value => writes.push({at,value})]; } };
  const native = new Proxy({ StyleSheet:{create:v=>v,absoluteFill:{},hairlineWidth:1}, Linking:{openURL(){}} },
    {get:(target,key)=>key in target?target[key]:key});
  const code = fs.readFileSync(path.join(__dirname,"../components/WeatherExperience.tsx"),"utf8");
  vm.runInNewContext(ts.transpileModule(code, {compilerOptions:{
    module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true,
  }}).outputText, {exports, require:name=>name==="react"?React:name==="react-native"?native:
    name==="@expo/vector-icons"?{Feather:"Feather"}:name==="react-native-keyboard-controller"?
      {KeyboardAvoidingView:"KeyboardAvoidingView"}:name==="@/components/WeatherAtmosphere"?
        {default:"WeatherAtmosphere"}:{}});
  const tree = exports.default({weather,isDark:false,bottomInset:24,enabled:true}), nodes = [];
  (function walk(n){if(!n||typeof n!=="object")return;nodes.push(n);n.children?.flat(Infinity).forEach(walk);})(tree);
  return {nodes,writes, find:id=>nodes.find(n=>n.props.testID===id),
    text:nodes.filter(n=>n.type==="Text").flatMap(n=>n.children).join(" ")};
}
test("location chooser displays permission failure, keeps city alternative, and never adds provider branding", () => {
  let cleared = 0, located = 0, dismissed = 0;
  const weather = {needsCity:true,locating:false,loading:false,
    error:load().weatherErrorMessage({code:"permission"}),
    clearError(){cleared++;},useDeviceLocation(){located++;},dismissCity(){dismissed++;}};
  const ui = renderCityChooser(weather);
  assert.match(ui.text,/Konum izni verilmedi.*Şehir/); assert.doesNotMatch(ui.text,/Open-Meteo/);
  assert.equal(ui.nodes.find(n=>n.type==="Modal").props.visible,true);
  ui.find("weather-city-input").props.onChangeText("Ankara");
  assert.equal(cleared,1); assert.equal(ui.writes[0].value,"Ankara");
  ui.find("weather-location-button").props.onPress(); ui.find("weather-city-dismiss").props.onPress();
  assert.equal(located,1); assert.equal(dismissed,1);
});
test("chooser indicates forecast loading, prevents duplicate taps, wires result coordinates and explains empty/network search", () => {
  let selected;
  const place = {name:"Test city",latitude:41,longitude:29,source:"city"};
  const weather = {needsCity:true,loading:true,locating:false,error:null,selectPlace:p=>{selected=p;}};
  const loading = renderCityChooser(weather,{query:"Test",results:[place],status:"done"});
  assert.match(loading.text,/Hava durumu yükleniyor/);
  assert.equal(loading.find("weather-location-button").props.disabled,true);
  assert.equal(loading.find("weather-city-result-0").props.disabled,true);
  weather.loading=false;
  const ready=renderCityChooser(weather,{query:"Test",results:[place],status:"done"});
  ready.find("weather-city-result-0").props.onPress(); assert.equal(selected,place);
  assert.match(renderCityChooser(weather,{query:"unknown",status:"done"}).text,/bir yer bulamadık/);
  assert.match(renderCityChooser(weather,{query:"Test",status:"error"}).text,/İnternet bağlantını/);
});

// Inspect actual component geometry/worklets without claiming Android GPU tests.
function rainGeometry(runEffects = false) {
  const code = fs.readFileSync(path.join(__dirname, "../components/WeatherAtmosphere.tsx"), "utf8");
  const exports = {};
  const React = {
    memo: fn => fn, useEffect(fn) { if (runEffects) fn(); },
    createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }),
  };
  const modules = {
    react: React,
    "react-native": { StyleSheet: { absoluteFill: {} } },
    "react-native-reanimated": {
      default: { View: "AnimatedView" }, useSharedValue: value => ({ value }),
      useAnimatedStyle: fn => fn(), Easing: { inOut: fn => fn, quad: "quad" },
      cancelAnimation() {}, withTiming: value => value,
    },
    "react-native-svg": Object.fromEntries(
      ["default", "Defs", "Ellipse", "LinearGradient", "Path", "RadialGradient", "Rect", "Stop"].map(n => [n, n])),
  };
  vm.runInNewContext(ts.transpileModule(code, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React },
  }).outputText + "\nexports.geometry = { Drop, Layer };", {
    exports, require: name => modules[name], console,
  });
  return exports.geometry;
}
test("real rain geometry has rounded graded beads, varied depth, falling motion and wind response", () => {
  const { Drop } = rainGeometry();
  const p = { w: 390, h: 844, data: { wind: 18, fetchedAt: 1 }, isDark: false };
  const clock = { value: 0 };
  const drops = Array.from({ length: 48 }, (_, i) => Drop({ clock, i, p, intensity: 0.3, total: 48 }));
  const styles = drops.map(d => d.props.style[0]);
  assert.ok(new Set(styles.map(s => s.width)).size > 30);
  assert.ok(new Set(styles.map(s => s.height)).size > 30);
  assert.ok(new Set(styles.map(s => s.opacity)).size > 30);
  assert.ok(styles.every(s => s.width > 2 && s.width < 5.5 && s.height < 12));
  assert.ok(styles.every(s => s.height / s.width < 3.5), "short trails must not read as thin straight lines");
  assert.ok(styles.every(s => !s.backgroundColor));
  const types = node => node && typeof node === "object" ?
    [node.type, ...node.children.flat(Infinity).flatMap(types)] : [];
  assert.ok(types(drops[0]).includes("Path"));
  assert.ok(types(drops[0]).includes("LinearGradient"));
  assert.ok(types(drops[0]).includes("Ellipse"));
  clock.value = 0.02;
  const moved = Drop({ clock, i: 0, p, intensity: 0.3, total: 48 });
  assert.ok(moved.props.style[1].transform[1].translateY > drops[0].props.style[1].transform[1].translateY);
  clock.value = 1;
  const windy = Drop({ clock, i: 0, p, intensity: 0.3, total: 48 });
  assert.notEqual(windy.props.style[1].transform[2].rotate, drops[0].props.style[1].transform[2].rotate);
});
test("actual precipitation controls bounded rain density; dry storms and reduced motion emit no drops", () => {
  const { Layer, Drop } = rainGeometry();
  const p = { clock: { value: 0 }, w: 390, h: 844, count: 12, reduced: false, data: {
    kind: "rain", rain: 0.1, precipitation: 0.1, wind: 2, fetchedAt: 1,
  } };
  const count = node => node && typeof node === "object" ?
    (node.type === Drop ? 1 : 0) + node.children.flat(Infinity).reduce((sum, child) => sum + count(child), 0) : 0;
  const light = count(Layer(p));
  const heavy = count(Layer({ ...p, data: { ...p.data, rain: 8, precipitation: 8 } }));
  assert.ok(light > 0 && heavy > light && heavy <= p.count * 6);
  assert.equal(count(Layer({ ...p, reduced: true })), 0);
  assert.equal(count(Layer({ ...p, data: { ...p.data, kind: "storm", rain: 0, precipitation: 0 } })), 0);
  assert.equal(count(Layer({ ...p, data: { ...p.data, kind: "sun", rain: 0, precipitation: 0 } })), 0);
});
test("cool rain tint stays subtle, touch-transparent and absent without rain", () => {
  const { Layer } = rainGeometry(true);
  const p = { clock: { value: 0 }, w: 390, h: 844, count: 12, active: true,
    reduced: false, isDark: false, enterMs: 2000, data: {
      kind: "rain", rain: 0.2, precipitation: 0.2, wind: 2, fetchedAt: 1,
    } };
  const shadeOf = node => node.children.flat(Infinity).find(n => n?.props?.testID === "weather-rain-shade");
  const shade = shadeOf(Layer(p));
  assert.equal(shade.props.pointerEvents, "none");
  assert.equal(shade.props.style[1].backgroundColor, "#3B516C");
  assert.ok(shade.props.style[2].opacity >= 0.1 && shade.props.style[2].opacity <= 0.145);
  assert.equal(shadeOf(Layer({ ...p, data: { ...p.data, kind: "clouds", rain: 0, precipitation: 0 } })), undefined);
  assert.equal(shadeOf(Layer({ ...p, data: { ...p.data, kind: "storm", rain: 0, precipitation: 0 } })), undefined);
});
