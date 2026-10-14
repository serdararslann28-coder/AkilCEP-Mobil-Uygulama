// Execute the real sender without a device, controlling network completion order.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const text = fs.readFileSync(path.join(__dirname,"ChatContext.tsx"),"utf8");
const source = ts.createSourceFile("ChatContext.tsx",text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const provider = source.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==="ChatProvider");
const declaration = provider.body.statements.flatMap(n=>ts.isVariableStatement(n)?Array.from(n.declarationList.declarations):[])
  .find(n=>n.name.getText(source)==="sendMessage");
const parser = source.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==="readChatResponse");
const code = ts.transpileModule(parser.getText(source)+"\nconst sendMessage = "+declaration.initializer.arguments[0].getText(source)+";\nexports.sendMessage=sendMessage;",{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
}).outputText;
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function harness(initial=null) {
  const state={conversation:initial,typing:false,saves:[],calls:[]};
  const moduleObject={exports:{}};let id=0;
  const bindings={
    module:moduleObject,exports:moduleObject.exports,
    currentConversation:initial,selectedModel:"existing-model",
    abortRef:{current:null},pendingTextRequestRef:{current:null},profileRef:{current:null},
    AbortController,Date,Error,console,
    MAX_ATTACHMENT_COUNT:4,MAX_TOTAL_ATTACHMENT_BYTES:20_000_000,
    MAX_ATTACHMENT_BYTES:10_000_000,isSupabaseConfigured:false,
    isImageRequest:()=>false,generateId:()=>`message-${++id}`,getApiBase:()=>"https://test.invalid/api",
    setCurrentConversation:conv=>{state.conversation=conv;},
    setIsTyping:value=>{state.typing=value;},
    persistConversation:conv=>{state.conversation=conv;state.saves.push(conv);},
    fetch:(url,options)=>new Promise((resolve,reject)=>state.calls.push({url,options,resolve,reject})),
  };
  vm.runInNewContext(code,bindings);
  return {state,bindings,send:moduleObject.exports.sendMessage};
}
test("complete Markdown reply is stored once with user/assistant order and stable prior messages",async()=>{
  const prior={id:"old",role:"assistant",content:"Önceki cevap",timestamp:1};
  const h=harness({id:"thread",title:"Eski",messages:[prior],model:"existing-model",createdAt:1});
  h.send("Yeni soru");await tick();
  assert.equal(h.state.typing,true);
  assert.equal(h.state.saves.length,1,"persist the user message before awaiting the network");
  const reply="# Başlık\n\n**Yanıt**\n\n```js\nconst a = 1;\n```";
  h.state.calls[0].resolve(Response.json({ok:true,response:reply}));await tick();
  const messages=h.state.conversation.messages;
  assert.deepEqual(Array.from(messages,m=>m.role),["assistant","user","assistant"]);
  assert.equal(messages[0],prior);assert.equal(messages[2].content,reply);
  assert.equal(messages.filter(m=>m.role==="assistant").length,2);
  assert.equal(h.state.typing,false);assert.equal(h.bindings.abortRef.current,null);
});
test("replacement request keeps both user messages and ignores a late cancelled answer",async()=>{
  const h=harness();h.send("Birinci");await tick();h.send("İkinci");await tick();
  assert.equal(h.state.calls.length,2);
  h.state.calls[0].resolve(Response.json({ok:true,response:"ESKİ CEVAP"}));await tick();
  assert.equal(h.state.typing,true,"old request cannot hide the current loading indicator");
  h.state.calls[1].resolve(Response.json({ok:true,response:"Güncel cevap"}));await tick();
  assert.deepEqual(Array.from(h.state.conversation.messages,m=>m.content),["Birinci","İkinci","Güncel cevap"]);
  assert.equal(h.state.typing,false);
});
test("active abort clears loading and keeps the already-persisted user message",async()=>{
  const h=harness();h.send("Soru");await tick();
  h.bindings.abortRef.current.abort();
  h.state.calls[0].reject(Object.assign(new Error("cancel"),{name:"AbortError"}));await tick();
  assert.equal(h.state.typing,false);
  assert.equal(h.state.conversation.messages.length,1);
  assert.equal(h.state.conversation.messages[0].role,"user");
});
test("safe API errors and network failures finish loading without leaking raw details",async()=>{
  const h=harness();h.send("Soru");await tick();
  h.state.calls[0].resolve(Response.json({code:"provider_timeout"},{status:504}));await tick();
  assert.match(h.state.conversation.messages.at(-1).content,/zaman aşımı/);
  assert.equal(h.state.typing,false);
  const x=harness();x.send("Soru");await tick();
  x.state.calls[0].reject(new Error("private upstream details"));await tick();
  assert.doesNotMatch(x.state.conversation.messages.at(-1).content,/private/);
  assert.equal(x.state.typing,false);
});

test("inverted-list scrolling follows the latest end but preserves an older reading position",()=>{
  const screenText=fs.readFileSync(path.join(__dirname,"../app/chat.tsx"),"utf8");
  const screen=ts.createSourceFile("chat.tsx",screenText,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const callbacks={};
  function visit(node){
    if(ts.isJsxAttribute(node)&&["onScroll","onContentSizeChange"].includes(node.name.getText(screen))){
      const expression=node.initializer?.expression;
      if(expression?.getText(screen).includes("nearLatestRef")) callbacks[node.name.getText(screen)]=expression.getText(screen);
    }
    ts.forEachChild(node,visit);
  }
  visit(screen);
  assert.ok(callbacks.onScroll&&callbacks.onContentSizeChange);
  const scrolls=[], nearLatestRef={current:true},mod={exports:{}};
  vm.runInNewContext(ts.transpileModule(`exports.scroll=${callbacks.onScroll};exports.size=${callbacks.onContentSizeChange};`,{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
  }).outputText,{exports:mod.exports,nearLatestRef,scrollToLatest:animated=>scrolls.push(animated)});
  mod.exports.scroll({nativeEvent:{contentOffset:{y:420}}});mod.exports.size();
  assert.equal(scrolls.length,0,"do not pull an older-message reader to the bottom");
  mod.exports.scroll({nativeEvent:{contentOffset:{y:0}}});mod.exports.size();
  assert.deepEqual(scrolls,[false]);
});
