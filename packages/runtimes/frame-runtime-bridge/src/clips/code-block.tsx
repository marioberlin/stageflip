// packages/runtimes/frame-runtime-bridge/src/clips/code-block.tsx
// T-131f.1 port of reference/slidemotion/.../clips/code-block.tsx.
// Syntax-highlighted code with line-by-line stagger reveal. Ships its own
// minimal tokenizer (keywords + strings + numbers + identifiers + function-
// call detection + line comments) — no external highlighter. The colour
// scheme is the reference's One-Dark-derived palette and is intentionally
// off-theme; code clips have a fixed editor look that should stay stable
// across StageFlip themes.

import {
  cubicBezier,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from '@stageflip/frame-runtime';
import type { ClipDefinition } from '@stageflip/runtimes-contract';
import type { ReactElement } from 'react';
import { z } from 'zod';

import { defineFrameClip } from '../index.js';

const codeLanguageSchema = z.enum(['typescript', 'javascript', 'python', 'bash', 'json']);
export type CodeLanguage = z.infer<typeof codeLanguageSchema>;

export const codeBlockPropsSchema = z
  .object({
    code: z.string(),
    language: codeLanguageSchema.optional(),
    filename: z.string().optional(),
    fontSize: z.number().positive().optional(),
  })
  .strict();

export type CodeBlockProps = z.infer<typeof codeBlockPropsSchema>;

const KEYWORDS: Record<CodeLanguage, readonly string[]> = {
  typescript: [
    'const',
    'let',
    'var',
    'function',
    'return',
    'if',
    'else',
    'for',
    'while',
    'class',
    'interface',
    'type',
    'import',
    'from',
    'export',
    'default',
    'async',
    'await',
    'new',
    'this',
    'extends',
    'implements',
    'public',
    'private',
    'protected',
    'readonly',
    'static',
    'true',
    'false',
    'null',
    'undefined',
    'void',
    'enum',
  ],
  javascript: [
    'const',
    'let',
    'var',
    'function',
    'return',
    'if',
    'else',
    'for',
    'while',
    'class',
    'import',
    'from',
    'export',
    'default',
    'async',
    'await',
    'new',
    'this',
    'extends',
    'true',
    'false',
    'null',
    'undefined',
  ],
  python: [
    'def',
    'class',
    'return',
    'if',
    'elif',
    'else',
    'for',
    'while',
    'import',
    'from',
    'as',
    'with',
    'try',
    'except',
    'finally',
    'raise',
    'lambda',
    'yield',
    'async',
    'await',
    'True',
    'False',
    'None',
    'self',
    'in',
    'not',
    'and',
    'or',
    'is',
    'pass',
  ],
  bash: [
    'if',
    'then',
    'else',
    'elif',
    'fi',
    'for',
    'do',
    'done',
    'while',
    'case',
    'esac',
    'function',
    'return',
    'export',
    'local',
    'echo',
    'cd',
    'ls',
    'mkdir',
    'rm',
    'cp',
    'mv',
  ],
  json: ['true', 'false', 'null'],
};

const COLORS = {
  bg: '#282c34',
  text: '#abb2bf',
  keyword: '#c678dd',
  string: '#98c379',
  comment: '#5c6370',
  number: '#d19a66',
  fn: '#61afef',
  chromeBar: '#21252b',
  chromeBorder: '#181a1f',
  trafficRed: '#ff5f56',
  trafficYellow: '#ffbd2e',
  trafficGreen: '#27c93f',
} as const;

const EASE_OUT_EXPO = cubicBezier(0.16, 1, 0.3, 1);
const LINE_ANIM_FRAMES = 10;

interface Token {
  text: string;
  color: string;
}

const TOKEN_PATTERN =
  /("(?:\\.|[^"\\])*")|('(?:\\.|[^'\\])*')|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][A-Za-z0-9_$]*)|(\s+)|([^\s"'A-Za-z0-9_$]+)/g;

// Tokeniser is exported for testing — it's the only non-trivial logic in the
// clip that benefits from direct unit coverage.
//
// **Known limitation (preserved from reference)**: the comment scan runs
// against the raw line BEFORE string parsing, so a comment marker (`//`,
// `#`) inside a quoted string will be misclassified — e.g.
// `const url = "https://example.com"` is split at the `//` inside the
// quotes, leaving `"https:` as an unmatched-quote span and
// `//example.com"` as a "trailing comment". Real fix needs a string-
// aware pre-scan; out of scope for the reference port. Regression test
// in code-block.test.tsx pins the current behaviour so any future fix
// updates both.
export function tokenizeLine(line: string, language: CodeLanguage): Token[] {
  const keywords = KEYWORDS[language];
  const tokens: Token[] = [];

  const commentIdx = (() => {
    if (language === 'python' || language === 'bash') {
      const i = line.indexOf('#');
      return i >= 0 ? i : -1;
    }
    const i = line.indexOf('//');
    return i >= 0 ? i : -1;
  })();

  const workLine = commentIdx >= 0 ? line.slice(0, commentIdx) : line;
  const trailingComment = commentIdx >= 0 ? line.slice(commentIdx) : null;

  let lastIndex = 0;
  for (const match of workLine.matchAll(TOKEN_PATTERN)) {
    const matchIndex = match.index ?? 0;
    if (matchIndex > lastIndex) {
      tokens.push({ text: workLine.slice(lastIndex, matchIndex), color: COLORS.text });
    }
    const [full, dq, sq, num, ident] = match;
    if (dq !== undefined || sq !== undefined) {
      tokens.push({ text: full, color: COLORS.string });
    } else if (num !== undefined) {
      tokens.push({ text: full, color: COLORS.number });
    } else if (ident !== undefined) {
      if (keywords.includes(ident)) {
        tokens.push({ text: full, color: COLORS.keyword });
      } else {
        const next = workLine[matchIndex + full.length];
        tokens.push({ text: full, color: next === '(' ? COLORS.fn : COLORS.text });
      }
    } else {
      // whitespace + punctuation → plain text colour
      tokens.push({ text: full, color: COLORS.text });
    }
    lastIndex = matchIndex + full.length;
  }
  if (lastIndex < workLine.length) {
    tokens.push({ text: workLine.slice(lastIndex), color: COLORS.text });
  }

  if (trailingComment !== null) {
    tokens.push({ text: trailingComment, color: COLORS.comment });
  }

  return tokens;
}

export function CodeBlock({
  code,
  language = 'typescript',
  filename,
  fontSize = 22,
}: CodeBlockProps): ReactElement {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const lines = code.split('\n');
  const revealWindow = Math.max(1, Math.floor(durationInFrames * 0.6));
  const perLineDelay = lines.length > 1 ? revealWindow / lines.length : 0;

  return (
    <div
      data-testid="code-block-clip"
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: COLORS.bg,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      <div
        data-testid="code-block-chrome"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '14px 20px',
          backgroundColor: COLORS.chromeBar,
          borderBottom: `1px solid ${COLORS.chromeBorder}`,
        }}
      >
        <div
          style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: COLORS.trafficRed }}
        />
        <div
          style={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            backgroundColor: COLORS.trafficYellow,
          }}
        />
        <div
          style={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            backgroundColor: COLORS.trafficGreen,
          }}
        />
        {filename !== undefined && filename.length > 0 && (
          <span
            data-testid="code-block-filename"
            style={{
              marginLeft: 16,
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              fontSize: 14,
              fontWeight: 500,
              color: COLORS.text,
            }}
          >
            {filename}
          </span>
        )}
        <span
          data-testid="code-block-language"
          style={{
            marginLeft: 'auto',
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontSize: 11,
            fontWeight: 600,
            color: COLORS.comment,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
          }}
        >
          {language}
        </span>
      </div>

      <div
        style={{
          flex: 1,
          padding: '24px 32px',
          fontSize,
          lineHeight: 1.6,
          overflow: 'hidden',
        }}
      >
        {lines.map((line, i) => {
          const lineStart = i * perLineDelay;
          const opacity = interpolate(frame, [lineStart, lineStart + LINE_ANIM_FRAMES], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          const translateY = interpolate(frame, [lineStart, lineStart + LINE_ANIM_FRAMES], [8, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: EASE_OUT_EXPO,
          });
          const tokens = tokenizeLine(line, language);
          return (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: positional code line — slot i is the same line across renders.
              key={i}
              data-testid={`code-block-line-${i}`}
              style={{
                display: 'flex',
                opacity,
                transform: `translateY(${translateY}px)`,
                whiteSpace: 'pre',
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: 36,
                  color: COLORS.comment,
                  userSelect: 'none',
                  textAlign: 'right',
                  marginRight: 20,
                }}
              >
                {i + 1}
              </span>
              <span style={{ color: COLORS.text }}>
                {tokens.length === 0
                  ? ' '
                  : tokens.map((t, ti) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: positional token — slot ti is the same token within line i.
                      <span key={ti} style={{ color: t.color }}>
                        {t.text}
                      </span>
                    ))}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// No themeSlots — the editor look is intentionally fixed (One-Dark-derived).
// Code clips should stay visually stable across document themes; callers who
// want a themed editor should ship their own clip.
export const codeBlockClip: ClipDefinition<unknown> = defineFrameClip<CodeBlockProps>({
  kind: 'code-block',
  component: CodeBlock,
  propsSchema: codeBlockPropsSchema,
  fontRequirements: () => [{ family: 'Plus Jakarta Sans', weight: 500 }],
});
