// Controlled native-event tests. These do not replace Android microphone/TTS tests.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const source = fs.readFileSync(path.join(__dirname, "../useVoiceSession.ts"), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

function harness(config = {}) {
  let index = 0, dirty = false, value, now = 0, sequence = 0, playing = false;
  const slots = [], pending = [], timers = new Map(), listeners = new Set();
  const calls = [], roles = [], alerts = [], speeches = [], warnings = [];
  const changed = (a, b) => !a || a.length !== b.length || a.some((v, i) => !Object.is(v, b[i]));
  const React = {
    useState(initial) {
      const at = index++;
      slots[at] ??= { value: typeof initial === "function" ? initial() : initial };
      return [slots[at].value, next => {
        const result = typeof next === "function" ? next(slots[at].value) : next;
        if (!Object.is(result, slots[at].value)) { slots[at].value = result; dirty = true; }
      }];
    },
    useRef(initial) { const at = index++; return slots[at] ??= { current: initial }; },
    useCallback(fn, deps) {
      const at = index++;
      if (changed(slots[at]?.deps, deps)) slots[at] = { deps, value: fn };
      return slots[at].value;
    },
    useEffect(fn, deps) {
      const at = index++;
      if (changed(slots[at]?.deps, deps)) {
        const previous = slots[at];
        slots[at] = { deps };
        pending.push(() => { previous?.cleanup?.(); slots[at].cleanup = fn(); });
      }
    },
  };
  const recorder = {
    recording: false, db: -65, starts: 0, stops: 0, uri: "file:///recording.m4a",
    async prepareToRecordAsync() {},
    record() {
      assert.equal(playing, false, "microphone must not record TTS");
      this.recording = true; this.starts++;
    },
    async stop() { this.recording = false; this.stops++; },
    getStatus() { return { isRecording: this.recording, metering: config.noMeter ? undefined : this.db }; },
  };
  const AppState = {
    currentState: "active",
    addEventListener(_, fn) { listeners.add(fn); return { remove: () => listeners.delete(fn) }; },
  };
  const options = {
    blocked: false, currentConversationId: null,
    injectMessages(user, assistant) {
      if (user) { roles.push("user"); options.currentConversationId ??= "local-conversation"; }
      if (assistant) roles.push("assistant");
    },
  };
  const schedule = (fn, ms, interval = 0) => {
    const id = ++sequence; timers.set(id, { fn, at: now + ms, interval }); return id;
  };
  let releaseReply, releaseTranscript, releasePermission;
  const modules = {
    react: React,
    "expo-router": { useFocusEffect: fn => React.useEffect(fn, [fn]) },
    "react-native": {
      Platform: { OS: "android" }, Keyboard: { dismiss() {} }, AppState,
      Alert: { alert: (_, message) => alerts.push(message) },
    },
    "expo-audio": {
      RecordingPresets: { HIGH_QUALITY: {} }, useAudioRecorder: () => recorder,
      requestRecordingPermissionsAsync: async () => {
        if (config.holdPermission) return new Promise(resolve => { releasePermission = resolve; });
        return { granted: !config.denied };
      },
      setAudioModeAsync: async mode => {
        if (mode.allowsRecording) assert.equal(playing, false);
      },
    },
    "expo-file-system": { File: class { async base64() { return "c3ludGhldGlj"; } } },
    "expo-speech": {
      async stop() { if (playing) { playing = false; speeches.at(-1)?.onStopped?.(); } },
      speak(_, callbacks) {
        assert.equal(recorder.recording, false, "TTS must not overlap recording");
        assert.equal(callbacks.language, "tr-TR");
        if (config.speechThrow) throw new Error("Native TTS unavailable");
        speeches.push(callbacks); playing = true; callbacks.onStart();
      },
    },
    "@/context/ChatContext": { getApiBase: () => "https://test.invalid/api" },
    "@workspace/api-client-react": {
      async customFetch(url, init) {
        const payload = JSON.parse(init.body); calls.push({ url, payload, signal: init.signal });
        if (url.endsWith("/transcribe")) {
          if (config.sttError) throw new Error("HTTP 503");
          if (config.holdTranscript) return new Promise(resolve => { releaseTranscript = resolve; });
          return { text: config.empty ? "" : "Merhaba" };
        }
        if (url.endsWith("/conversations")) return { id: 42 };
        assert.deepEqual(payload, { text: "Merhaba" }, "AI receives text once, not retranscribed audio");
        if (config.replyError) throw new Error("HTTP 502");
        if (config.holdReply) return new Promise((resolve, reject) => {
          releaseReply = resolve;
          if (!config.ignoreAbort) {
            init.signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
          }
        });
        return { userText: "Merhaba", assistantText: "Merhaba, nasıl yardımcı olabilirim?" };
      },
    },
  };
  const module = { exports: {} };
  vm.runInNewContext(compiled, {
    module, exports: module.exports,
    require(name) { assert.ok(modules[name], `unexpected dependency ${name}`); return modules[name]; },
    AbortController, Date: class extends Date { static now() { return now; } },
    console: { warn: (...args) => warnings.push(args) },
    setTimeout: (fn, ms) => schedule(fn, ms), clearTimeout: id => timers.delete(id),
    setInterval: (fn, ms) => schedule(fn, ms, ms), clearInterval: id => timers.delete(id),
  });
  function render() {
    index = 0; dirty = false; value = module.exports.useVoiceSession(options);
    while (pending.length) pending.shift()();
  }
  async function flush() {
    for (let i = 0; i < 35; i++) { if (dirty) render(); await Promise.resolve(); }
    if (dirty) render();
  }
  async function advance(ms, db = recorder.db) {
    recorder.db = db; const until = now + ms;
    while (true) {
      const next = [...timers].sort((a, b) => a[1].at - b[1].at)[0];
      if (!next || next[1].at > until) break;
      const [id, timer] = next; now = timer.at;
      if (timer.interval) timer.at += timer.interval; else timers.delete(id);
      timer.fn(); await flush();
    }
    now = until; await flush();
  }
  render();
  return {
    get: () => value, options, recorder, calls, roles, alerts, speeches, warnings, flush, advance,
    async enter() { await value.enter(); await flush(); },
    async utterance() { await advance(400, -15); await advance(1600, -65); },
    async done() { playing = false; speeches.at(-1).onDone(); await flush(); },
    async background() {
      AppState.currentState = "background"; listeners.forEach(fn => fn("background")); await flush();
    },
    async resolveReply() {
      releaseReply({ userText: "Merhaba", assistantText: "Merhaba" }); await flush();
    },
    async resolveTranscript() { releaseTranscript({ text: "Merhaba" }); await flush(); },
    async resolvePermission() { releasePermission({ granted: true }); await flush(); },
  };
}

test("auto-listen → one transcript → one reply → TTS → auto-listen, twice", async () => {
  const h = harness(); await h.enter();
  assert.equal(h.get().phase, "listening");
  for (let turn = 1; turn <= 2; turn++) {
    await h.utterance();
    assert.equal(h.get().phase, "speaking");
    assert.equal(h.recorder.recording, false);
    await h.done(); h.speeches.at(-1).onDone(); await h.flush();
    await h.advance(500); assert.equal(h.recorder.recording, false);
    await h.advance(100); assert.equal(h.get().phase, "listening");
    assert.equal(h.recorder.starts, turn + 1);
  }
  assert.deepEqual(h.roles, ["user", "assistant", "user", "assistant"]);
  assert.equal(h.calls.filter(c => c.url.endsWith("/transcribe")).length, 2);
  assert.equal(h.calls.filter(c => c.url.endsWith("/voice-messages")).length, 2);
  assert.equal(h.calls.filter(c => c.url.endsWith("/conversations")).length, 1);
  await h.get().exit(); await h.flush();
});
test("final transcript appears before AI returns", async () => {
  const h = harness({ holdReply: true }); await h.enter(); await h.utterance();
  assert.equal(h.get().phase, "thinking"); assert.equal(h.get().userText, "Merhaba");
  assert.deepEqual(h.roles, ["user"]);
  await h.resolveReply(); assert.equal(h.get().phase, "speaking");
  assert.deepEqual(h.roles, ["user", "assistant"]); await h.get().exit();
});
test("exit during TTS cooldown prevents reopening the microphone", async () => {
  const h = harness(); await h.enter(); await h.utterance(); await h.done();
  await h.get().exit(); await h.flush(); await h.advance(1000);
  assert.equal(h.recorder.starts, 1); assert.equal(h.get().enabled, false);
});
test("background stops recording and ignores stale TTS completion", async () => {
  const h = harness(); await h.enter(); await h.utterance(); const stale = h.speeches[0];
  await h.background(); stale.onDone(); await h.advance(1000);
  assert.equal(h.get().enabled, false); assert.equal(h.recorder.starts, 1);
});
test("denied permission never starts recording", async () => {
  const h = harness({ denied: true }); await h.enter();
  assert.equal(h.get().enabled, false); assert.equal(h.recorder.starts, 0); assert.equal(h.alerts.length, 1);
});
test("AI failure retains user text and does not retry", async () => {
  const h = harness({ replyError: true }); await h.enter(); await h.utterance(); await h.advance(2000);
  assert.equal(h.get().enabled, false); assert.deepEqual(h.roles, ["user"]); assert.equal(h.alerts.length, 1);
  assert.equal(h.calls.filter(c => c.url.endsWith("/voice-messages")).length, 1);
});
test("TTS failure preserves reply and stops instead of retrying", async () => {
  const h = harness({ speechThrow: true }); await h.enter(); await h.utterance(); await h.advance(2000);
  assert.equal(h.get().enabled, false); assert.deepEqual(h.roles, ["user", "assistant"]);
  assert.equal(h.recorder.starts, 1); assert.equal(h.alerts.length, 1);
});
test("native TTS error or interruption never triggers another listening turn", async () => {
  for (const event of ["onError", "onStopped"]) {
    const h = harness(); await h.enter(); await h.utterance();
    h.speeches[0][event](new Error("Native speech interrupted"));
    await h.flush(); await h.advance(2000);
    assert.equal(h.get().enabled, false); assert.equal(h.recorder.starts, 1);
    assert.equal(h.alerts.length, 1); assert.deepEqual(h.roles, ["user", "assistant"]);
  }
});
test("silent speech and missing metering fail explicitly without AI requests", async () => {
  for (const config of [{ empty: true }, { noMeter: true }]) {
    const h = harness(config); await h.enter(); await h.utterance();
    assert.equal(h.get().enabled, false); assert.equal(h.alerts.length, 1);
    assert.equal(h.calls.filter(c => c.url.endsWith("/voice-messages")).length, 0);
  }
});
test("disabled spoken replies still resume listening", async () => {
  const h = harness(); h.get().setVoiceReplyEnabled(false); await h.flush();
  await h.enter(); await h.utterance(); await h.advance(600);
  assert.equal(h.get().phase, "listening"); assert.equal(h.speeches.length, 0); await h.get().exit();
});
test("request and TTS watchdogs stop stuck sessions", async () => {
  for (const config of [{ holdReply: true }, {}]) {
    const h = harness(config); await h.enter(); await h.utterance(); await h.advance(121000);
    assert.equal(h.get().enabled, false); assert.equal(h.alerts.length, 1); assert.equal(h.recorder.starts, 1);
  }
});
test("menu blocking stops the session", async () => {
  const h = harness(); await h.enter(); h.options.blocked = true;
  // Change a state value to render the options update, just as the parent does.
  h.get().setSpeechRate(1); await h.flush();
  assert.equal(h.get().enabled, false); assert.equal(h.recorder.recording, false);
});
test("stop keeps Voice Mode open without uploading, and manual restart resumes listening", async () => {
  const h = harness(); await h.enter();
  await h.get().stop(); await h.flush(); await h.advance(2000);
  assert.equal(h.get().enabled, true); assert.equal(h.get().paused, true);
  assert.equal(h.get().phase, "idle"); assert.equal(h.recorder.recording, false);
  assert.equal(h.calls.length, 0); assert.equal(h.recorder.starts, 1);
  await h.get().action(); await h.flush();
  assert.equal(h.get().enabled, true); assert.equal(h.get().paused, false);
  assert.equal(h.get().phase, "listening"); assert.equal(h.recorder.starts, 2);
  await h.get().exit(); await h.flush();
});
test("stop cancels TTS and ignores all stale playback callbacks, without losing history", async () => {
  const h = harness(); await h.enter(); await h.utterance();
  const oldSpeech = h.speeches[0], history = [...h.roles];
  await h.get().stop(); await h.flush();
  oldSpeech.onStart(); oldSpeech.onDone(); oldSpeech.onError(new Error("stale"));
  await h.advance(2000);
  assert.equal(h.get().enabled, true); assert.equal(h.get().paused, true);
  assert.equal(h.get().phase, "idle"); assert.equal(h.recorder.starts, 1);
  assert.deepEqual(h.roles, history); assert.equal(h.alerts.length, 0);
  await h.get().action(); await h.flush(); await h.utterance();
  assert.equal(h.get().phase, "speaking");
  assert.deepEqual(h.roles, ["user", "assistant", "user", "assistant"]);
  assert.equal(h.calls.filter(c => c.url.endsWith("/conversations")).length, 1);
  await h.get().exit(); await h.flush();
});
test("stop during automatic-listening cooldown cancels the scheduled microphone restart", async () => {
  const h = harness(); await h.enter(); await h.utterance(); await h.done();
  await h.get().stop(); await h.flush(); await h.advance(2000);
  assert.equal(h.get().enabled, true); assert.equal(h.get().paused, true);
  assert.equal(h.recorder.starts, 1); assert.equal(h.alerts.length, 0);
  await h.get().exit(); await h.flush();
});
test("late AI replies cannot reopen either a stopped or a closed session", async () => {
  for (const action of ["stop", "exit"]) {
    // Deliberately emulate a transport which returns even after cancellation.
    const h = harness({ holdReply: true, ignoreAbort: true });
    await h.enter(); await h.utterance(); assert.equal(h.get().phase, "thinking");
    await h.get()[action](); await h.flush();
    assert.ok(h.calls.every(c => c.signal.aborted));
    await h.resolveReply(); await h.advance(2000);
    assert.equal(h.get().enabled, action === "stop");
    assert.equal(h.get().paused, action === "stop"); assert.equal(h.get().phase, "idle");
    assert.equal(h.speeches.length, 0); assert.equal(h.recorder.starts, 1);
    assert.deepEqual(h.roles, ["user"]); assert.equal(h.alerts.length, 0);
    await h.get().exit(); await h.flush();
  }
});
test("late transcripts after stop are never injected or submitted to AI", async () => {
  const h = harness({ holdTranscript: true }); await h.enter(); await h.utterance();
  assert.equal(h.get().phase, "thinking");
  await h.get().stop(); await h.flush(); await h.resolveTranscript();
  assert.equal(h.get().paused, true); assert.equal(h.get().enabled, true);
  assert.equal(h.calls.length, 1); assert.deepEqual(h.roles, []);
  assert.equal(h.speeches.length, 0); await h.get().exit(); await h.flush();
});
test("late reply from a stopped turn cannot interrupt a manually restarted microphone", async () => {
  const h = harness({ holdReply: true, ignoreAbort: true }); await h.enter(); await h.utterance();
  await h.get().stop(); await h.flush(); await h.get().action(); await h.flush();
  await h.resolveReply(); await h.advance(1000);
  assert.equal(h.get().phase, "listening"); assert.equal(h.get().paused, false);
  assert.equal(h.recorder.recording, true); assert.equal(h.recorder.starts, 2);
  assert.deepEqual(h.roles, ["user"]); assert.equal(h.speeches.length, 0);
  await h.get().exit(); await h.flush();
});
test("real composer button handlers stop, restart and close the same session", async () => {
  const source = fs.readFileSync(path.join(__dirname, "../../app/chat.tsx"), "utf8");
  const parsed = ts.createSourceFile("chat.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const controls = new Map();
  function visit(node) {
    if (ts.isJsxOpeningElement(node)) {
      const attrs = node.attributes.properties;
      const id = attrs.find(a => a.name?.text === "testID")?.initializer?.text;
      if (id === "voice-stop-button" || id === "voice-close-button") {
        const onPress = attrs.find(a => a.name?.text === "onPress");
        controls.set(id, onPress.initializer.expression.getText(parsed));
        let parent = node.parent, inRow = false;
        while (parent) {
          if (ts.isJsxElement(parent)) {
            inRow ||= parent.openingElement.attributes.properties.some(a =>
              a.name?.text === "style" && a.initializer?.expression?.getText(parsed) === "ss.composerRow");
          }
          parent = parent.parent;
        }
        assert.ok(inRow, `${id} must remain inside the shared capsule row`);
        assert.ok(!attrs.some(a => a.name?.text === "disabled"), "processing must never disable cancellation");
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(parsed);
  assert.equal(controls.size, 2); assert.ok(!source.includes("Yazı moduna dön"));
  assert.ok(source.includes('placeholder="AkılCEP’e sor"'));
  const h = harness(); await h.enter();
  const press = id => vm.runInNewContext(controls.get(id), {
    voice: h.get(), exitVoice: () => h.get().exit(),
  })();
  await press("voice-stop-button"); await h.flush();
  assert.equal(h.get().enabled, true); assert.equal(h.get().paused, true);
  await press("voice-stop-button"); await h.flush();
  assert.equal(h.get().phase, "listening"); assert.equal(h.get().paused, false);
  await press("voice-close-button"); await h.flush();
  assert.equal(h.get().enabled, false); assert.equal(h.recorder.recording, false);
});
test("actual fixed control widths leave input space inside narrow voice capsules", () => {
  const source = fs.readFileSync(path.join(__dirname, "../../app/chat.tsx"), "utf8");
  const parsed = ts.createSourceFile("chat.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let stylesheet;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(parsed) === "ss") {
      stylesheet = node.initializer.arguments[0];
    }
    ts.forEachChild(node, visit);
  }
  visit(parsed); assert.ok(stylesheet);
  const style = name => {
    const property = stylesheet.properties.find(p => p.name.getText(parsed) === name);
    assert.ok(property);
    return vm.runInNewContext(`(${property.initializer.getText(parsed)})`);
  };
  const dock = style("dock"), plus = style("dockPlus"), control = style("voiceCtl");
  const row = style("composerRow"), field = style("underlineInput"), right = style("dockAiShell");
  assert.equal(row.flexDirection, "row"); assert.equal(field.flex, 1); assert.equal(field.minWidth, 0);
  assert.ok(control.width >= 44 && control.height >= 44);
  for (const width of [280, 320, 360, 402]) {
    const usable = width - dock.marginHorizontal * 2 - dock.paddingHorizontal * 2;
    const inputWidth = usable - plus.width - control.width * 2 - row.gap * 3;
    assert.ok(inputWidth >= 80, `input still fits at ${width}dp`);
    const dictationInputWidth = usable - plus.width - control.width - right.width - row.gap * 3;
    assert.ok(dictationInputWidth >= 80, `separate mic and waveform fit at ${width}dp`);
    assert.ok(plus.height <= dock.minHeight - dock.paddingVertical * 2);
    assert.ok(control.height <= dock.minHeight - dock.paddingVertical * 2);
    assert.ok(right.height <= dock.minHeight - dock.paddingVertical * 2);
  }
});
test("actual microphone handler uses dictation once without sending a conversation or playing TTS", async () => {
  const source = fs.readFileSync(path.join(__dirname, "../../app/chat.tsx"), "utf8");
  const parsed = ts.createSourceFile("chat.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let handler;
  function visit(node) {
    if (ts.isJsxOpeningElement(node)) {
      const attrs = node.attributes.properties;
      if (attrs.find(a => a.name?.text === "testID")?.initializer?.text === "chat-dictation-button") {
        handler = attrs.find(a => a.name?.text === "onPress").initializer.expression.getText(parsed);
        assert.equal(attrs.find(a => a.name?.text === "disabled").initializer.expression.getText(parsed), "micDisabled");
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(parsed); assert.ok(handler);
  const h = harness(), drafts = [];
  h.options.onDictation = text => drafts.push(text);
  const press = async () => {
    vm.runInNewContext(handler, {
      voice: h.get(), dictating: h.get().enabled && h.get().mode === "dictation",
    })();
    await h.flush();
  };
  await press();
  assert.equal(h.get().mode, "dictation"); assert.equal(h.get().phase, "listening");
  await h.advance(400, -15);
  await press(); await h.advance(2000);
  assert.deepEqual(drafts, ["Merhaba"]); assert.equal(h.recorder.starts, 1);
  assert.equal(h.get().enabled, false); assert.equal(h.get().phase, "idle");
  assert.equal(h.calls.length, 1); assert.ok(h.calls[0].url.endsWith("/transcribe"));
  assert.deepEqual(h.roles, []); assert.equal(h.speeches.length, 0);
});
test("composer preserves attachment, text-send and waveform-launch handlers", () => {
  const text = fs.readFileSync(path.join(__dirname, "../../app/chat.tsx"), "utf8");
  const parsed = ts.createSourceFile("chat.tsx", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const buttons = new Map(); let rightAction;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(parsed) === "onRightAction") {
      rightAction = node.initializer.getText(parsed);
    }
    if (ts.isJsxOpeningElement(node)) {
      const attrs = node.attributes.properties;
      const id = attrs.find(a => a.name?.text === "testID")?.initializer?.text;
      if (id === "chat-plus-button" || id === "chat-send-voice-button") {
        buttons.set(id, attrs.find(a => a.name?.text === "onPress").initializer.expression.getText(parsed));
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(parsed);
  assert.equal(buttons.get("chat-send-voice-button"), "onRightAction");
  const events = [];
  for (const hasComposerContent of [false, true]) {
    vm.runInNewContext(rightAction, {
      hasComposerContent,
      voice: { enabled: false, enter: () => events.push("voice") },
      handleSend: () => events.push("send"),
      Keyboard: { dismiss() {} }, exitVoice: () => events.push("exit"),
      Haptics: { impactAsync() {}, ImpactFeedbackStyle: { Medium: 1 } },
    })();
  }
  assert.deepEqual(events, ["voice", "send"]);
  let open = false;
  vm.runInNewContext(buttons.get("chat-plus-button"), {
    exitVoice: () => events.push("exit"), setPanelOpen: fn => { open = fn(open); },
    restoreInputFocusRef: { current: false },
  })();
  assert.equal(open, true);
});
test("stop or close during permission handoff cannot start a microphone after permission resolves", async () => {
  for (const action of ["stop", "exit"]) {
    const h = harness({ holdPermission: true });
    const entering = h.get().enter(); await h.flush();
    await h.get()[action](); await h.flush();
    await h.resolvePermission(); await entering; await h.flush();
    assert.equal(h.recorder.starts, 0); assert.equal(h.get().phase, "idle");
    assert.equal(h.get().enabled, action === "stop");
    assert.equal(h.get().paused, action === "stop"); assert.equal(h.alerts.length, 0);
    await h.get().exit(); await h.flush();
  }
});
test("close after stop exits immediately, and repeated stop never reopens closed Voice Mode", async () => {
  const h = harness(); await h.enter(); await h.get().stop(); await h.flush();
  await h.get().stop(); await h.flush(); await h.get().exit(); await h.flush();
  await h.get().stop(); await h.flush(); await h.advance(2000);
  assert.equal(h.get().enabled, false); assert.equal(h.get().paused, false);
  assert.equal(h.recorder.recording, false); assert.equal(h.recorder.starts, 1);
  assert.deepEqual(h.roles, []); assert.equal(h.alerts.length, 0);
});
test("real history callback supports split voice turns and ordinary paired injections", () => {
  const text = fs.readFileSync(path.join(__dirname, "../../context/ChatContext.tsx"), "utf8");
  const parsed = ts.createSourceFile("context.tsx", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let arrow;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(parsed) === "injectMessages") arrow = node.initializer.arguments[0];
    ts.forEachChild(node, visit);
  }
  visit(parsed); assert.ok(arrow);
  let current = null, conversations = [], id = 0;
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(`module.exports = ${arrow.getText(parsed)}`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, {
    module, Date, abortRef: { current: null }, setIsTyping() {}, generateId: () => String(++id),
    setCurrentConversation: fn => { current = fn(current); },
    setConversations: fn => { conversations = fn(conversations); }, saveConversations: async () => {},
  });
  module.exports("Merhaba", ""); assert.equal(current.messages.length, 1);
  module.exports("", "Yanıt"); module.exports("Soru", "Normal yanıt");
  assert.equal(current.messages.length, 4);
  assert.equal(current.messages.map(m => m.role).join(","), "user,assistant,user,assistant");
  assert.ok(current.messages.every(m => m.content)); assert.equal(conversations.length, 1);
});
test("actual composer keeps one keyboard translation and a 10dp open-keyboard gap", () => {
  const source = fs.readFileSync(path.join(__dirname, "../../app/chat.tsx"), "utf8");
  const parsed = ts.createSourceFile("chat.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let callback;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(parsed) === "dockKbStyle") {
      callback = node.initializer.arguments[0].getText(parsed);
    }
    ts.forEachChild(node, visit);
  }
  visit(parsed);
  assert.ok(callback);
  const getStyle = vm.runInNewContext(ts.transpileModule(
    `((kbH, bottomInset) => (${callback})())`,
    { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } },
  ).outputText);
  for (const inset of [0, 24, 48]) {
    for (const keyboardHeight of [0, 12, 24, 48, 240, 360]) {
      const style = getStyle({ value: -keyboardHeight }, inset);
      const progress = Math.min(1, keyboardHeight / 48);
      assert.equal(style.bottom, 0);
      assert.equal(style.transform.length, 1);
      assert.equal(style.transform[0].translateY, -keyboardHeight);
      assert.equal(style.paddingBottom, inset * (1 - progress) + 10 * progress);
      if (keyboardHeight >= 48) assert.equal(style.paddingBottom, 10);
    }
    assert.equal(getStyle({ value: 0 }, inset).paddingBottom, inset,
      "closing restores the original navigation inset without an extra gap");
  }
});

test("actual voice layout keeps scrolling messages outside the orb through keyboard and swipe transitions", () => {
  const source = fs.readFileSync(path.join(__dirname, "../../app/chat.tsx"), "utf8");
  const parsed = ts.createSourceFile("chat.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let geometry, diameter;
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === "voiceLayoutBottom") geometry = node;
    if (ts.isVariableDeclaration(node) && node.name.getText(parsed) === "orbSize") diameter = node.initializer;
    ts.forEachChild(node, visit);
  }
  visit(parsed); assert.ok(geometry && diameter);
  const transpile = code => ts.transpileModule(code, {
    compilerOptions: { target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const getBottom = vm.runInNewContext(transpile(`(${geometry.getText(parsed)})`));
  for (const [width, height, inset, keyboardHeight] of [
    [320, 568, 24, 260], [360, 640, 24, 280], [402, 874, 34, 320], [768, 1024, 24, 360],
  ]) {
    for (const keyboard of [0, keyboardHeight / 2, keyboardHeight]) {
      const size = vm.runInNewContext(diameter.getText(parsed), {
        kbVisible: keyboard > 0, winW: width, winH: height,
        keyboardTop: keyboard ? height - keyboard : null,
        topPad: 24, composerContentHeight: 72, bottomInset: inset,
      });
      assert.ok(size >= 0 && size <= 224 && size <= width - 64);
      // Actual stage controls: short keyboard layout; up to two transcript lines when closed.
      const stageHeight = size + (keyboard ? 68 : 110);
      for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
        const layout = getBottom(72, inset, stageHeight, -keyboard, height, 96, size, progress);
        const stageTop = height - layout.stageBottom - stageHeight + layout.stageTranslateY;
        const messagesBottom = height - layout.messageBottom;
        assert.ok(Math.abs(messagesBottom - stageTop) < 0.001, "list viewport must end at stage top");
        if (size) {
          assert.ok(stageTop + 8 >= 96 - 0.001, "orb stays below header");
          const composerTop = height - keyboard - 72 - (keyboard ? 0 : inset);
          assert.ok(stageTop + 8 + size <= composerTop, "orb stays above input and keyboard");
        }
      }
    }
  }
  assert.match(source, /testID="voice-orb-stage"[\s\S]*?backgroundColor: "transparent"/);
  assert.match(source, /minHeight: 0, overflow: "hidden"/);
  assert.match(source, /paddingTop: voiceStageEnabled \? 8/);
});
