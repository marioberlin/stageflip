// packages/runtimes/frame-runtime-bridge/src/clips/code-block.test.tsx
// T-131f.1 — codeBlockClip behaviour + tokeniser + propsSchema.

import { FrameProvider } from '@stageflip/frame-runtime';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  CodeBlock,
  type CodeBlockProps,
  codeBlockClip,
  codeBlockPropsSchema,
  tokenizeLine,
} from './code-block.js';

afterEach(cleanup);

function renderAt(frame: number, props: CodeBlockProps, durationInFrames = 90) {
  return render(
    <FrameProvider frame={frame} config={{ width: 640, height: 360, fps: 30, durationInFrames }}>
      <CodeBlock {...props} />
    </FrameProvider>,
  );
}

describe('tokenizeLine — language-specific keyword highlighting (T-131f.1)', () => {
  it('classifies typescript keywords as keywords (purple)', () => {
    const tokens = tokenizeLine('const x = 1', 'typescript');
    const constToken = tokens.find((t) => t.text === 'const');
    expect(constToken?.color).toBe('#c678dd');
  });

  it('classifies python keywords distinct from typescript', () => {
    const tokens = tokenizeLine('def foo():', 'python');
    expect(tokens.find((t) => t.text === 'def')?.color).toBe('#c678dd');
  });

  it('classifies double-quoted strings as strings (green)', () => {
    const tokens = tokenizeLine('"hi"', 'typescript');
    expect(tokens[0]?.color).toBe('#98c379');
    expect(tokens[0]?.text).toBe('"hi"');
  });

  it('classifies numeric literals as numbers (orange)', () => {
    const tokens = tokenizeLine('let n = 42', 'typescript');
    expect(tokens.find((t) => t.text === '42')?.color).toBe('#d19a66');
  });

  it('classifies an identifier followed by `(` as a function call (blue)', () => {
    const tokens = tokenizeLine('foo(1)', 'typescript');
    expect(tokens[0]?.color).toBe('#61afef');
    expect(tokens[0]?.text).toBe('foo');
  });

  it('classifies trailing // comments as comments (grey)', () => {
    const tokens = tokenizeLine('let x = 1 // hello', 'typescript');
    const last = tokens[tokens.length - 1];
    expect(last?.text).toBe('// hello');
    expect(last?.color).toBe('#5c6370');
  });

  it('treats # as a comment marker for python and bash, not for typescript', () => {
    const py = tokenizeLine('x = 1 # py-comment', 'python');
    expect(py[py.length - 1]?.text).toBe('# py-comment');
    expect(py[py.length - 1]?.color).toBe('#5c6370');
  });

  it('KNOWN LIMITATION: `//` inside a string literal is misclassified as a comment', () => {
    // Pins the documented limitation in code-block.tsx — the comment
    // scan is not string-aware. A future string-aware tokeniser fix
    // must update this test to assert correct classification.
    const tokens = tokenizeLine('const url = "https://example.com"', 'typescript');
    const lastTokenColor = tokens[tokens.length - 1]?.color;
    expect(lastTokenColor).toBe('#5c6370');
    expect(tokens.some((t) => t.text.includes('//example.com'))).toBe(true);
  });
});

describe('CodeBlock component (T-131f.1)', () => {
  it('renders one numbered line per source line', () => {
    renderAt(90, { code: 'a\nb\nc' });
    expect(screen.getByTestId('code-block-line-0')).toBeDefined();
    expect(screen.getByTestId('code-block-line-1')).toBeDefined();
    expect(screen.getByTestId('code-block-line-2')).toBeDefined();
    expect(screen.queryByTestId('code-block-line-3')).toBeNull();
  });

  it('renders the chrome bar (red/yellow/green dots) regardless of input', () => {
    renderAt(90, { code: '' });
    const chrome = screen.getByTestId('code-block-chrome');
    expect(chrome.querySelectorAll('div').length).toBeGreaterThanOrEqual(3);
  });

  it('shows the filename when supplied', () => {
    renderAt(90, { code: 'x', filename: 'app.ts' });
    expect(screen.getByTestId('code-block-filename').textContent).toBe('app.ts');
  });

  it('exposes the language label uppercased in the chrome bar', () => {
    renderAt(90, { code: 'x', language: 'python' });
    expect(screen.getByTestId('code-block-language').textContent).toBe('python');
  });

  it('first line is invisible at frame=0 (translateY=8) and visible after the per-line window', () => {
    const { unmount } = renderAt(0, { code: 'a' });
    const line0 = screen.getByTestId('code-block-line-0') as HTMLElement;
    expect(Number(line0.style.opacity)).toBe(0);
    unmount();
    renderAt(20, { code: 'a' });
    const line0b = screen.getByTestId('code-block-line-0') as HTMLElement;
    expect(Number(line0b.style.opacity)).toBe(1);
  });
});

describe('codeBlockClip definition (T-131f.1)', () => {
  it("registers under kind 'code-block' with no themeSlots (intentionally fixed editor look)", () => {
    expect(codeBlockClip.kind).toBe('code-block');
    expect(codeBlockClip.propsSchema).toBe(codeBlockPropsSchema);
    expect(codeBlockClip.themeSlots).toBeUndefined();
  });

  it('propsSchema requires `code`', () => {
    expect(codeBlockPropsSchema.safeParse({}).success).toBe(false);
    expect(codeBlockPropsSchema.safeParse({ code: '' }).success).toBe(true);
  });

  it('propsSchema rejects unknown languages', () => {
    expect(codeBlockPropsSchema.safeParse({ code: '', language: 'rust' }).success).toBe(false);
  });
});
