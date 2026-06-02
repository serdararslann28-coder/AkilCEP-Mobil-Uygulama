/**
 * MarkdownText — lightweight markdown renderer for AkılCEP chat.
 *
 * Block-level: # h1, ## h2, ### h3, - bullet, 1. numbered, ``` code, --- divider, paragraphs.
 * Inline:      **bold**, *italic*, `code`.
 * Keeps Inter font family and base typography consistent with aiText style.
 */
import React, { memo } from "react";
import {
  Platform,
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
interface Span { t: string; b?: boolean; em?: boolean; c?: boolean }

function parseInline(raw: string): Span[] {
  const out: Span[] = [];
  let s = raw;
  while (s.length > 0) {
    // **bold** — must check before *italic*
    const bm = s.match(/^\*\*(.+?)\*\*/s);
    if (bm) { out.push({ t: bm[1], b: true }); s = s.slice(bm[0].length); continue; }
    // *italic*
    const im = s.match(/^\*(.+?)\*/s);
    if (im) { out.push({ t: im[1], em: true }); s = s.slice(im[0].length); continue; }
    // `code`
    const cm = s.match(/^`(.+?)`/s);
    if (cm) { out.push({ t: cm[1], c: true }); s = s.slice(cm[0].length); continue; }
    // plain text until next special or end
    const nx = s.search(/\*\*|\*|`/);
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
  | { k: 'divider' }
  | { k: 'para';    text: string }

function parseBlocks(raw: string): Block[] {
  const lines  = raw.split('\n');
  const blocks: Block[] = [];
  let inCode   = false;
  let codeBuf: string[] = [];

  for (const line of lines) {
    // Code fence
    if (line.trimStart().startsWith('```')) {
      if (inCode) {
        blocks.push({ k: 'code', text: codeBuf.join('\n') });
        codeBuf = [];
        inCode  = false;
      } else {
        inCode = true;
      }
      continue;
    }
    if (inCode) { codeBuf.push(line); continue; }

    // Headings (must check h3 before h2 before h1)
    const h3 = line.match(/^### (.+)/); if (h3) { blocks.push({ k: 'h3', text: h3[1] }); continue; }
    const h2 = line.match(/^## (.+)/);  if (h2) { blocks.push({ k: 'h2', text: h2[1] }); continue; }
    const h1 = line.match(/^# (.+)/);   if (h1) { blocks.push({ k: 'h1', text: h1[1] }); continue; }

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
    blocks.push({ k: 'para', text: line });
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
      {spans.map((sp, i) =>
        sp.c ? (
          <Text key={i} style={{ fontFamily: MONO, color: codeClr, backgroundColor: codeBg }}>
            {` ${sp.t} `}
          </Text>
        ) : sp.b ? (
          <Text key={i} style={{ fontFamily: 'Inter_700Bold' }}>{sp.t}</Text>
        ) : sp.em ? (
          <Text key={i} style={{ fontStyle: 'italic' as const }}>{sp.t}</Text>
        ) : (
          <Text key={i}>{sp.t}</Text>
        )
      )}
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
              <ScrollView
                key={i}
                horizontal
                showsHorizontalScrollIndicator={false}
                style={[ss.codeBlock, { backgroundColor: codeBg }]}
                contentContainerStyle={ss.codeContent}
              >
                <Text style={[ss.codeText, { color: codeClr }]}>{block.text}</Text>
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
