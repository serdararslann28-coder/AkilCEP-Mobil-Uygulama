const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const source = fs.readFileSync(path.join(__dirname, "MarkdownText.tsx"), "utf8");
const copied = [], opened = [];
const moduleObject = { exports: {} };
const createElement = (type, props, ...children) => ({ type, props: { ...props, children } });
vm.runInNewContext(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React },
}).outputText + "\nexports.parseBlocks=parseBlocks;exports.parseInline=parseInline;", {
  module: moduleObject, exports: moduleObject.exports, URL,
  require: name => {
    if (name === "react") return { __esModule: true, default: { createElement }, memo: fn => fn };
    if (name === "expo-clipboard") return { setStringAsync: async text => copied.push(text) };
    if (name === "react-native") return {
      View: "View", Text: "Text", ScrollView: "ScrollView", Pressable: "Pressable",
      StyleSheet: { create: x => x, hairlineWidth: 1 },
      Platform: { select: x => x.default },
      Alert: { alert() {} }, Linking: { openURL: async url => opened.push(url) },
    };
    throw Error(name);
  },
});
const normalize = value => JSON.parse(JSON.stringify(value));
const blocks = text => normalize(moduleObject.exports.parseBlocks(text));
const inline = text => normalize(moduleObject.exports.parseInline(text));
function elements(node) {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!node || typeof node !== "object") return [];
  if (typeof node.type === "function") return elements(node.type(node.props));
  return [node, ...elements(node.props?.children)];
}
test("headings, lists, paragraphs and dividers retain their logical structure", () => {
  const result = blocks("# Başlık\nİlk satır\nikinci satır\n\nYeni paragraf\n- Madde\n2. Sıra\n---\n###### Alt başlık");
  assert.deepEqual(result.map(b => b.k), ["h1","para","para","bullet","numbered","divider","h3"]);
  assert.equal(result[1].text, "İlk satır\nikinci satır");
  assert.equal(result[4].n, 2);
});
test("bold/italic nesting, underscore bold, inline code and escapes preserve content", () => {
  const spans = inline("**kalın *eğik*** __önemli__ `a_b` \\*işaret\\*");
  assert.equal(spans.map(s => s.t).join(""), "kalın eğik önemli a_b *işaret*");
  assert.ok(spans.some(s => s.t === "önemli" && s.b));
  assert.ok(spans.some(s => s.t === "a_b" && s.c));
});
test("unclosed code fences remain a single code block with exact text", () => {
  assert.deepEqual(blocks("```js\nconst a = 1;\nconst b = 2;"), [{ k:"code", text:"const a = 1;\nconst b = 2;" }]);
});
test("matching fence lengths, language suffixes and tilde fences do not corrupt nested code examples", () => {
  const nested="````markdown\n# Başlık\n```js\nlet a=1;\n```\n````";
  assert.deepEqual(blocks(nested),[{k:"code",text:"# Başlık\n```js\nlet a=1;\n```"}]);
  assert.deepEqual(blocks("~~~js\nlet a=1;\n~~~"),[{k:"code",text:"let a=1;"}]);
});
test("tables retain columns, escaped pipes, row order and following paragraphs", () => {
  const parsed = blocks("| A | B |\n| :--- | ---: |\n| x\\|y | z |\n| 1 | 2 |\n\nSon");
  assert.deepEqual(parsed[0], { k:"table", headers:["A","B"], rows:[["x|y","z"],["1","2"]] });
  assert.equal(parsed[1].text, "Son");
});
test("only HTTP(S) Markdown links are actionable", () => {
  assert.equal(inline("[Güvenli](https://example.com)")[0].href, "https://example.com");
  for (const url of ["javascript:alert", "data:text/html", "file:///private", "exp://app"]) {
    assert.equal(inline(`[Etiket](${url})`)[0].href, undefined);
    assert.equal(inline(`[Etiket](${url})`)[0].t, "Etiket");
  }
});
test("real rendered code-copy and link handlers call the existing platform APIs", async () => {
  const tree = moduleObject.exports.default({ text:"```js\nlet a = 1;\n```\n\n[Site](https://example.com)", color:"#333", isDark:false });
  const nodes = elements(tree);
  await nodes.find(n => n.type === "Pressable").props.onPress();
  assert.equal(copied.at(-1), "let a = 1;");
  await nodes.find(n => n.props?.accessibilityRole === "link").props.onPress();
  assert.equal(opened.at(-1), "https://example.com");
});
test("long answers render without truncating or splitting logical messages", () => {
  const text = Array.from({length:200},(_,i)=>`Paragraf ${i}: **önemli**`).join("\n\n");
  const parsed = blocks(text);
  assert.equal(parsed.length,200);
  assert.ok(parsed.at(-1).text.includes("199"));
  assert.ok(elements(moduleObject.exports.default({text,color:"#333",isDark:false})).length > 200);
});
