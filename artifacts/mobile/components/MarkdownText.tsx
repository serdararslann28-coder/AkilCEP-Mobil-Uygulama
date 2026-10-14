/**
 * MarkdownText — lightweight markdown renderer for AkılCEP chat.
 *
 * Blocks: headings, lists, copyable fenced code, tables, dividers and paragraphs.
 * Inline: bold, italic, code and HTTP(S) links. No HTML or executable URI schemes.
 * Keeps Inter font family and base typography consistent with aiText style.
 */
import React, { memo } from "react";
import * as Clipboard from "expo-clipboard";
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

interface Props {
  text:   string;
  color:  string;   // base text color from theme
  isDark: boolean;  // for code block background tint
}

// ── Inline span types ─────────────────────────────────────────────────────────
interface Span { t: string; b?: boolean; em?: boolean; c?: boolean; href?: string }

function safeLink(url: string): boolean {
  try { return ["https:", "http:"].includes(new URL(url).protocol); } catch { return false; }
}

function parseInline(raw: string): Span[] {
  const out: Span[] = [];
  let s = raw;
  while (s.length > 0) {
    const escaped = s.match(/^\\([\\`*_{}\[\]()#+\-.!>])/);
    if (escaped) { out.push({ t: escaped[1] }); s = s.slice(escaped[0].length); continue; }
    const link = s.match(/^\[([^\]]+)\]\(([^)\s]+)\)/);
    if (link) {
      out.push(...parseInline(link[1]).map(span => ({ ...span,
        ...(safeLink(link[2]) ? { href: link[2] } : {}) })));
      s = s.slice(link[0].length); continue;
    }
    // **bold** — must check before *italic*
    const bm = s.startsWith("**")
      ? s.match(/^(\*\*)(.+?)\1(?!\*)/s)
      : s.match(/^(__)(.+?)\1(?!_)/s);
    if (bm) { out.push(...parseInline(bm[2]).map(span => ({ ...span, b: true }))); s = s.slice(bm[0].length); continue; }
    // *italic*
    const previousCharacter = out[out.length - 1]?.t.slice(-1) ?? "";
    const im = s.startsWith("_") && /[\p{L}\p{N}]/u.test(previousCharacter)
      ? null : s.match(/^(\*|_)(.+?)\1/s);
    if (im) { out.push(...parseInline(im[2]).map(span => ({ ...span, em: true }))); s = s.slice(im[0].length); continue; }
    // `code`
    const cm = s.match(/^`(.+?)`/s);
    if (cm) { out.push({ t: cm[1], c: true }); s = s.slice(cm[0].length); continue; }
    // plain text until next special or end
    const nx = s.search(/\*\*|\*|`|\[|\\|_/);
    if (nx === -1) { out.push({ t: s }); break; }
    if (nx === 0)  { out.push({ t: s[0] }); s = s.slice(1); continue; }
    out.push({ t: s.slice(0, nx) });
    s = s.slice(nx);
  }
  return out;
}

// ── Block types ───────────────────────────────────────────────────────────────
type Block =
  | { k: 'h1' | 'h2' | 'h3'; text: string }
  | { k: 'bullet';   depth: number; text: string }
  | { k: 'numbered'; n: number;     text: string }
  | { k: 'code';    text: string }
  | { k: 'table'; headers: string[]; rows: string[][] }
  | { k: 'divider' }
  | { k: 'para';    text: string }

function tableCells(line: string): string[] {
  const source = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  const cells = [""];
  for (let i = 0; i < source.length; i++) {
    if (source[i] === "\\" && source[i + 1] === "|") {
      cells[cells.length - 1] += "|"; i++;
    } else if (source[i] === "|") {
      cells.push("");
    } else {
      cells[cells.length - 1] += source[i];
    }
  }
  return cells.map(cell => cell.trim());
}

function parseBlocks(raw: string): Block[] {
  const lines  = raw.split('\n');
  const blocks: Block[] = [];
  let inCode   = false;
  let codeFence = "";
  let codeBuf: string[] = [];

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    // Closing fences must match the opener and cannot have a language suffix.
    const fence = line.match(/^\s*(`{3,}|~{3,})(.*)$/);
    if (fence && (!inCode || (
      fence[1][0] === codeFence[0] && fence[1].length >= codeFence.length && !fence[2].trim()
    ))) {
      if (inCode) {
        blocks.push({ k: 'code', text: codeBuf.join('\n') });
        codeBuf = [];
        inCode  = false;
      } else {
        inCode = true;
        codeFence = fence[1];
      }
      continue;
    }
    if (inCode) { codeBuf.push(line); continue; }

    if (line.includes("|") && index + 1 < lines.length &&
        tableCells(lines[index + 1]).every(cell => /^:?-{3,}:?$/.test(cell))) {
      const headers = tableCells(line);
      if (headers.length === tableCells(lines[index + 1]).length) {
        const rows: string[][] = [];
        index++;
        while (index + 1 < lines.length && lines[index + 1].includes("|") && lines[index + 1].trim()) {
          rows.push(tableCells(lines[++index]));
        }
        blocks.push({ k: "table", headers, rows }); continue;
      }
    }

    // Headings (must check h3 before h2 before h1)
    const heading = line.match(/^(#{1,6}) (.+)/);
    if (heading) {
      blocks.push({ k: heading[1].length === 1 ? "h1" : heading[1].length === 2 ? "h2" : "h3", text: heading[2] });
      continue;
    }

    // Horizontal rule
    if (/^-{3,}$/.test(line.trim())) { blocks.push({ k: 'divider' }); continue; }

    // Bullet list  (-, *, +)
    const bl = line.match(/^(\s*)[*\-+] (.+)/);
    if (bl) {
      const depth = Math.floor((bl[1] ?? '').length / 2);
      blocks.push({ k: 'bullet', depth, text: bl[2] });
      continue;
    }

    // Numbered list
    const nl = line.match(/^(\d+)\. (.+)/);
    if (nl) { blocks.push({ k: 'numbered', n: parseInt(nl[1], 10), text: nl[2] }); continue; }

    // Skip blank lines
    if (line.trim() === '') continue;

    // Regular paragraph
    const previous = blocks[blocks.length - 1];
    if (previous?.k === "para" && index > 0 && lines[index - 1].trim() !== "") {
      previous.text += "\n" + line;
    } else {
      blocks.push({ k: 'para', text: line });
    }
  }

  // Close any unclosed code block
  if (inCode && codeBuf.length) blocks.push({ k: 'code', text: codeBuf.join('\n') });

  return blocks;
}

// ── Inline renderer ───────────────────────────────────────────────────────────
const MONO = Platform.select({ ios: 'Courier New', android: 'monospace', default: 'monospace' });

function InlineText({ spans, baseStyle, codeClr, codeBg }: {
  spans:     Span[];
  baseStyle: object | object[];
  codeClr:   string;
  codeBg:    string;
}) {
  return (
    <Text style={baseStyle}>
      {spans.map((sp, i) => (
        <Text key={i} accessibilityRole={sp.href ? "link" : undefined}
          onPress={sp.href ? () => Linking.openURL(sp.href!).catch(() =>
            Alert.alert("Bağlantı açılamadı", "Lütfen daha sonra tekrar deneyin.")) : undefined}
          style={[
            sp.b && { fontFamily: "Inter_700Bold" },
            sp.em && { fontStyle: "italic" },
            sp.c && { fontFamily: MONO, color: codeClr, backgroundColor: codeBg },
            sp.href && { color: "#267BD5", textDecorationLine: "underline" },
          ]}>{sp.t}</Text>
      ))}
    </Text>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
const MarkdownText = memo(function MarkdownText({ text, color, isDark }: Props) {
  const codeClr = isDark ? "rgba(237,235,231,0.85)" : "#2D2D2D";
  const codeBg  = isDark ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.06)";
  const divClr  = isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)";

  const base: object[] = [ss.base, { color }];

  const blocks = parseBlocks(text);

  return (
    <View style={ss.container}>
      {blocks.map((block, i) => {
        switch (block.k) {

          case 'h1':
            return (
              <InlineText key={i}
                spans={parseInline(block.text)}
                baseStyle={[ss.h1, { color }]}
                codeClr={codeClr} codeBg={codeBg}
              />
            );

          case 'h2':
            return (
              <InlineText key={i}
                spans={parseInline(block.text)}
                baseStyle={[ss.h2, { color }]}
                codeClr={codeClr} codeBg={codeBg}
              />
            );

          case 'h3':
            return (
              <InlineText key={i}
                spans={parseInline(block.text)}
                baseStyle={[ss.h3, { color }]}
                codeClr={codeClr} codeBg={codeBg}
              />
            );

          case 'bullet':
            return (
              <View key={i} style={[ss.listRow, { marginLeft: block.depth * 14 }]}>
                <Text style={[ss.bulletDot, { color }]}>•</Text>
                <InlineText
                  spans={parseInline(block.text)}
                  baseStyle={[ss.listText, { color }]}
                  codeClr={codeClr} codeBg={codeBg}
                />
              </View>
            );

          case 'numbered':
            return (
              <View key={i} style={ss.listRow}>
                <Text style={[ss.numLabel, { color }]}>{block.n}.</Text>
                <InlineText
                  spans={parseInline(block.text)}
                  baseStyle={[ss.listText, { color }]}
                  codeClr={codeClr} codeBg={codeBg}
                />
              </View>
            );

          case 'code':
            return (
              <View key={i} style={[ss.codeBlock, { backgroundColor: codeBg }]}>
                <Pressable accessibilityRole="button" accessibilityLabel="Kodu kopyala"
                  hitSlop={8}
                  onPress={() => Clipboard.setStringAsync(block.text).catch(() =>
                    Alert.alert("Kod kopyalanamadı", "Lütfen tekrar deneyin."))}
                  style={{ alignSelf: "flex-end", paddingHorizontal: 14, paddingVertical: 8 }}>
                  <Text style={{ color: codeClr, fontSize: 12 }}>Kopyala</Text>
                </Pressable>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={ss.codeContent}
              >
                <Text style={[ss.codeText, { color: codeClr }]}>{block.text}</Text>
              </ScrollView>
              </View>
            );

          case 'table':
            return (
              <ScrollView key={i} horizontal showsHorizontalScrollIndicator>
                <View>
                  {[block.headers, ...block.rows].map((row, rowIndex) => (
                    <View key={rowIndex} style={{ flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth, borderColor: divClr }}>
                      {block.headers.map((_, column) => (
                        <View key={column} style={{ width: 150, paddingVertical: 8, paddingHorizontal: 10 }}>
                          <InlineText spans={parseInline(row[column] ?? "")}
                            baseStyle={[ss.base, { color }, rowIndex === 0 && { fontFamily: "Inter_700Bold" }]}
                            codeClr={codeClr} codeBg={codeBg} />
                        </View>
                      ))}
                    </View>
                  ))}
                </View>
              </ScrollView>
            );

          case 'divider':
            return <View key={i} style={[ss.divider, { backgroundColor: divClr }]} />;

          default:
            return (
              <InlineText key={i}
                spans={parseInline(block.text)}
                baseStyle={base}
                codeClr={codeClr} codeBg={codeBg}
              />
            );
        }
      })}
    </View>
  );
});

export default MarkdownText;

// ── Styles ─────────────────────────────────────────────────────────────────────
const ss = StyleSheet.create({
  container: {
    gap: 5,
  },

  // Base paragraph — matches existing aiText style exactly
  base: {
    fontSize:      15.5,
    fontFamily:    'Inter_400Regular',
    lineHeight:    26,
    letterSpacing: -0.1,
  },

  // Headings
  h1: {
    fontSize:      20,
    fontFamily:    'Inter_700Bold',
    lineHeight:    28,
    letterSpacing: -0.6,
    marginTop:     6,
    marginBottom:  2,
  },
  h2: {
    fontSize:      17,
    fontFamily:    'Inter_600SemiBold',
    lineHeight:    25,
    letterSpacing: -0.3,
    marginTop:     4,
    marginBottom:  1,
  },
  h3: {
    fontSize:      15.5,
    fontFamily:    'Inter_600SemiBold',
    lineHeight:    24,
    letterSpacing: -0.2,
    marginTop:     2,
  },

  // Lists
  listRow: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           8,
  },
  bulletDot: {
    fontSize:   15.5,
    fontFamily: 'Inter_400Regular',
    lineHeight: 26,
  },
  numLabel: {
    fontSize:   15,
    fontFamily: 'Inter_500Medium',
    lineHeight: 26,
    minWidth:   22,
  },
  listText: {
    flex:          1,
    fontSize:      15.5,
    fontFamily:    'Inter_400Regular',
    lineHeight:    26,
    letterSpacing: -0.1,
  },

  // Code block
  codeBlock: {
    borderRadius:  10,
    marginVertical: 3,
  },
  codeContent: {
    paddingVertical:   10,
    paddingHorizontal: 14,
  },
  codeText: {
    fontSize:   13,
    fontFamily: MONO ?? 'monospace',
    lineHeight: 20,
  },

  // Divider
  divider: {
    height:         StyleSheet.hairlineWidth,
    marginVertical: 6,
  },
});
