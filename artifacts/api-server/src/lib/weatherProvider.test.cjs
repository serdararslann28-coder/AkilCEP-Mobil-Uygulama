const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const {createRequire}=require("node:module");
const ts=require("typescript");
const serverRequire=createRequire(path.resolve(__dirname,"../../package.json"));
const schemaRequire=createRequire(path.resolve(__dirname,"../../../../lib/api-zod/package.json"));
const compile=file=>ts.transpileModule(fs.readFileSync(file,"utf8"),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
}).outputText;
// Controlled fixtures only; production never supplies fallback coordinates/data.
const fixture=()=>({
  current:{time:"2026-10-14T16:00",temperature_2m:17,apparent_temperature:16,is_day:1,
    precipitation:1,rain:1,showers:0,snowfall:0,weather_code:61,cloud_cover:90,wind_speed_10m:12},
  current_units:{temperature_2m:"°C",apparent_temperature:"°C",precipitation:"mm",
    rain:"mm",showers:"mm",snowfall:"cm",wind_speed_10m:"km/h"},
});
const city=()=>({name:"Ankara",admin1:"Ankara",country:"Türkiye",latitude:39.92,longitude:32.85});
function adapter(fetch=async()=>{throw Error("no network");}){
  const exports={};
  vm.runInNewContext(compile(path.join(__dirname,"weatherProvider.ts")),{
    exports,fetch,URL,URLSearchParams,AbortSignal,Date,setTimeout:()=>({unref(){}}),
  });
  return exports;
}
test("current weather preserves live temperature, WMO code, units, precipitation and local time",()=>{
  const r=adapter().normalizeCurrent(fixture());
  assert.equal(r.provider,"open-meteo");assert.equal(r.current.temperature_2m,17);
  assert.equal(r.current.weather_code,61);assert.equal(r.current.rain,1);
  assert.equal(r.current.time,"2026-10-14T16:00");assert.equal(r.current.description,"Hafif yağmurlu");
});
test("bad weather schema/units/day/condition/quantities cannot produce invented weather",()=>{
  const a=adapter();
  for(const data of [null,{}, {error:true}, {...fixture(),current:null}]){
    assert.throws(()=>a.normalizeCurrent(data),e=>e.code==="provider_response_invalid");
  }
  for(const [key,value] of [["weather_code",123],["rain",-1],["is_day",5],["cloud_cover",101],["temperature_2m",null]]){
    const f=fixture();f.current[key]=value;assert.throws(()=>a.normalizeCurrent(f));
  }
  const f=fixture();f.current_units.temperature_2m="°F";assert.throws(()=>a.normalizeCurrent(f));
});
test("city results carry selectable real coordinates; duplicates, zero results and invalid bodies are handled",()=>{
  const a=adapter(),r=a.normalizeCities({results:[city()]});
  assert.equal(r.results[0].name,"Ankara, Türkiye");assert.equal(r.results[0].latitude,39.92);
  assert.equal(a.normalizeCities({generationtime_ms:0.1}).results.length,0);
  assert.equal(a.normalizeCities({results:[]}).results.length,0);
  for(const f of [null,{}, {error:true}, {results:"bad"}, {results:[{...city(),latitude:999}]}]){
    assert.throws(()=>a.normalizeCities(f));
  }
});
test("official current/geocoding requests need no key or billing; bounded cache and single-flight avoid duplicate calls",async()=>{
  const seen=[],a=adapter(async u=>{seen.push(new URL(u));return {
    ok:true,json:async()=>u.hostname==="api.open-meteo.com"?fixture():{results:[city()]},
  }});
  const [first,second]=await Promise.all([a.weatherCurrent(39.92,32.85),a.weatherCurrent(39.92,32.85)]);
  assert.equal(first,second);await a.weatherCurrent(39.92,32.85);assert.equal(seen.length,1);
  await a.weatherCities("Ankara");
  assert.equal(seen[0].hostname,"api.open-meteo.com");
  assert.equal(seen[0].searchParams.get("latitude"),"39.92");
  assert.equal(seen[0].searchParams.get("timezone"),"auto");
  assert.match(seen[0].searchParams.get("current"),/rain/);
  assert.equal(seen[1].hostname,"geocoding-api.open-meteo.com");
  assert.equal(seen[1].searchParams.get("name"),"Ankara");
  assert.equal(seen[1].searchParams.get("language"),"tr");
  for(const u of seen){assert.equal(u.searchParams.has("key"),false);assert.equal(u.searchParams.has("apikey"),false);}
});
test("upstream HTTP/quota/JSON/network/timeout failures are safe, explicit and never cached",async()=>{
  for(const [mock,code,status] of [
    [async()=>({ok:false,status:429,json:async()=>({error:true})}),"provider_quota_exceeded",429],
    [async()=>({ok:false,status:500,json:async()=>null}),"provider_request_failed",502],
    [async()=>({ok:true,json:async()=>{throw SyntaxError("bad");}}),"provider_response_invalid",502],
    [async()=>{throw TypeError("secret URL");},"provider_connection_failed",502],
    [async()=>{throw Object.assign(Error("timeout"),{name:"TimeoutError"});},"provider_timeout",504],
  ]){
    let calls=0;const a=adapter(async u=>{calls++;return mock(u);});
    for(let i=0;i<2;i++)await assert.rejects(a.weatherCurrent(39,32),e=>e.code===code&&e.status===status&&!e.message.includes("secret"));
    assert.equal(calls,2);
  }
});
async function httpHarness(t,upstream){
  const schemas={};
  vm.runInNewContext(compile(path.resolve(__dirname,"../../../../lib/api-zod/src/generated/api.ts")),{
    exports:schemas,require:schemaRequire,
  });
  const exports={},logs=[],api=adapter(upstream);
  vm.runInNewContext(compile(path.join(__dirname,"../routes/weather.ts")),{
    exports,Date,require:name=>name==="express"?serverRequire(name):name==="@workspace/api-zod"?schemas:api,
  });
  const app=serverRequire("express")();
  app.use((req,res,next)=>{req.log={warn:x=>logs.push(x)};next();});
  app.use("/api",exports.default);const server=app.listen(0,"127.0.0.1");
  await new Promise(resolve=>server.once("listening",resolve));
  t.after(()=>{server.closeAllConnections();server.close();});
  return {base:`http://127.0.0.1:${server.address().port}/api/weather`,logs};
}
test("real HTTP router works without environment credentials: city -> selected coordinates -> weather",async t=>{
  const h=await httpHarness(t,async u=>({ok:true,json:async()=>u.hostname==="api.open-meteo.com"?fixture():{results:[city()]}}));
  const search=await fetch(h.base+"/cities?query=Ankara");assert.equal(search.status,200);
  const p=(await search.json()).results[0];
  const forecast=await fetch(`${h.base}/current?latitude=${p.latitude}&longitude=${p.longitude}`);
  assert.equal(forecast.status,200);assert.equal((await forecast.json()).provider,"open-meteo");
});
test("real HTTP router validates inputs, applies traffic limits and returns safe upstream errors",async t=>{
  const h=await httpHarness(t,async()=>({ok:false,status:503,json:async()=>({error:true})}));
  for(const suffix of ["/current?latitude=&longitude=32","/current?latitude=999&longitude=32","/cities?query=a","/cities?query=%20a%20"])
    assert.equal((await fetch(h.base+suffix)).status,400);
  const r=await fetch(h.base+"/cities?query=Ankara");assert.equal(r.status,502);
  assert.equal((await r.json()).code,"provider_request_failed");
  assert.equal(h.logs[0].upstreamStatus,503);assert.equal(JSON.stringify(h.logs).includes("Ankara"),false);
  let last;for(let i=0;i<20;i++)last=await fetch(h.base+"/cities?query=Ankara");
  assert.equal(last.status,429);assert.equal((await last.json()).code,"provider_quota_exceeded");
});
