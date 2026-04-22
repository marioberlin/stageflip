// packages/editor-shell/src/zodform/zod-form.test.tsx
// Behavioural tests for <ZodForm> (T-125b).

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { ZodForm } from './zod-form';

afterEach(() => cleanup());

describe('<ZodForm> — fallback', () => {
  it('renders the "nothing to render" message when schema is not a ZodObject', () => {
    render(<ZodForm schema={z.string()} value={{}} onChange={() => undefined} />);
    expect(screen.getByTestId('zodform-empty')).toBeTruthy();
  });
});

describe('<ZodForm> — text', () => {
  it('renders a text input populated from value', () => {
    const schema = z.object({ label: z.string() });
    render(<ZodForm schema={schema} value={{ label: 'hello' }} onChange={() => undefined} />);
    const input = screen.getByTestId('zodform-field-label') as HTMLInputElement;
    expect(input.value).toBe('hello');
  });

  it('does not emit onChange until blur or Enter', () => {
    const schema = z.object({ label: z.string() });
    const onChange = vi.fn();
    render(<ZodForm schema={schema} value={{ label: '' }} onChange={onChange} />);
    const input = screen.getByTestId('zodform-field-label') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'a' } });
    fireEvent.change(input, { target: { value: 'ab' } });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith({ label: 'ab' });
  });

  it('commits on Enter', () => {
    const schema = z.object({ label: z.string() });
    const onChange = vi.fn();
    render(<ZodForm schema={schema} value={{ label: '' }} onChange={onChange} />);
    const input = screen.getByTestId('zodform-field-label') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'done' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenLastCalledWith({ label: 'done' });
  });

  it('reverts on Escape without committing', () => {
    const schema = z.object({ label: z.string() });
    const onChange = vi.fn();
    render(<ZodForm schema={schema} value={{ label: 'original' }} onChange={onChange} />);
    const input = screen.getByTestId('zodform-field-label') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'intermediate' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onChange).not.toHaveBeenCalled();
    expect(input.value).toBe('original');
  });
});

describe('<ZodForm> — number + slider', () => {
  it('commits numbers on blur', () => {
    const schema = z.object({ size: z.number() });
    const onChange = vi.fn();
    render(<ZodForm schema={schema} value={{ size: 10 }} onChange={onChange} />);
    const input = screen.getByTestId('zodform-field-size') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '42' } });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.blur(input);
    expect(onChange).toHaveBeenLastCalledWith({ size: 42 });
  });

  it('slider commits on pointerup, not per onChange tick', () => {
    const schema = z.object({ opacity: z.number().min(0).max(1) });
    const onChange = vi.fn();
    render(<ZodForm schema={schema} value={{ opacity: 0.5 }} onChange={onChange} />);
    const input = screen.getByTestId('zodform-field-opacity') as HTMLInputElement;
    expect(input.type).toBe('range');
    fireEvent.change(input, { target: { value: '0.7' } });
    fireEvent.change(input, { target: { value: '0.9' } });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.pointerUp(input);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith({ opacity: 0.9 });
  });
});

describe('<ZodForm> — boolean / enum / color', () => {
  it('boolean toggles commit immediately', () => {
    const schema = z.object({ on: z.boolean() });
    const onChange = vi.fn();
    render(<ZodForm schema={schema} value={{ on: false }} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('zodform-field-on'));
    expect(onChange).toHaveBeenLastCalledWith({ on: true });
  });

  it('enum select commits on change', () => {
    const schema = z.object({ align: z.enum(['left', 'center', 'right']) });
    const onChange = vi.fn();
    render(<ZodForm schema={schema} value={{ align: 'left' }} onChange={onChange} />);
    const select = screen.getByTestId('zodform-field-align') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'right' } });
    expect(onChange).toHaveBeenLastCalledWith({ align: 'right' });
  });

  it('color input commits on blur of hex textbox', () => {
    const schema = z.object({ stroke: z.string().regex(/^#[0-9a-fA-F]{6}$/) });
    const onChange = vi.fn();
    render(<ZodForm schema={schema} value={{ stroke: '#ff0000' }} onChange={onChange} />);
    const hex = screen.getByTestId('zodform-field-stroke-hex') as HTMLInputElement;
    fireEvent.change(hex, { target: { value: '#00ff00' } });
    fireEvent.blur(hex);
    expect(onChange).toHaveBeenLastCalledWith({ stroke: '#00ff00' });
  });

  it('native color picker buffers per-tick and commits once on blur', () => {
    // The native <input type="color"> fires onChange continuously during the
    // OS picker drag; commit-per-tick would flood T-133's undo stack. This
    // test guards that we buffer in draft and commit once on blur.
    const schema = z.object({ stroke: z.string().regex(/^#[0-9a-fA-F]{6}$/) });
    const onChange = vi.fn();
    render(<ZodForm schema={schema} value={{ stroke: '#ff0000' }} onChange={onChange} />);
    const picker = screen.getByTestId('zodform-field-stroke-picker') as HTMLInputElement;
    fireEvent.change(picker, { target: { value: '#aa0000' } });
    fireEvent.change(picker, { target: { value: '#550000' } });
    fireEvent.change(picker, { target: { value: '#000000' } });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.blur(picker);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith({ stroke: '#000000' });
  });
});

describe('<ZodForm> — tag-list + number-list', () => {
  it('tag-list commits a new tag on Enter and removes on ✕', () => {
    const schema = z.object({ tags: z.array(z.string()) });
    const onChange = vi.fn();
    const { rerender } = render(
      <ZodForm schema={schema} value={{ tags: ['one'] }} onChange={onChange} />,
    );
    const input = screen.getByTestId('zodform-field-tags-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'two' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenLastCalledWith({ tags: ['one', 'two'] });

    rerender(<ZodForm schema={schema} value={{ tags: ['one', 'two'] }} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('zodform-field-tags-remove-0'));
    expect(onChange).toHaveBeenLastCalledWith({ tags: ['two'] });
  });

  it('number-list parses comma-separated numbers on blur', () => {
    const schema = z.object({ xs: z.array(z.number()) });
    const onChange = vi.fn();
    render(<ZodForm schema={schema} value={{ xs: [1, 2] }} onChange={onChange} />);
    const input = screen.getByTestId('zodform-field-xs') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '3, 4, 5' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenLastCalledWith({ xs: [3, 4, 5] });
  });
});

describe('<ZodForm> — nested object', () => {
  it('nested object commits shallow-merge onto parent', () => {
    const schema = z.object({
      meta: z.object({ author: z.string(), year: z.number() }),
    });
    const onChange = vi.fn();
    render(
      <ZodForm schema={schema} value={{ meta: { author: 'a', year: 2026 } }} onChange={onChange} />,
    );
    const author = screen.getByTestId('zodform-field-meta.author') as HTMLInputElement;
    fireEvent.change(author, { target: { value: 'b' } });
    fireEvent.blur(author);
    expect(onChange).toHaveBeenLastCalledWith({
      meta: { author: 'b', year: 2026 },
    });
  });
});

describe('<ZodForm> — discriminated union', () => {
  const shape = z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('circle'), radius: z.number() }),
    z.object({ kind: z.literal('square'), side: z.number() }),
  ]);
  const schema = z.object({ shape });

  it('renders the branch selected by the discriminator', () => {
    const onChange = vi.fn();
    render(
      <ZodForm
        schema={schema}
        value={{ shape: { kind: 'circle', radius: 5 } }}
        onChange={onChange}
      />,
    );
    expect(screen.getByTestId('zodform-field-shape.radius')).toBeTruthy();
    expect(screen.queryByTestId('zodform-field-shape.side')).toBeNull();
  });

  it('changing the tag rebuilds the value with the new branch shape', () => {
    const onChange = vi.fn();
    render(
      <ZodForm
        schema={schema}
        value={{ shape: { kind: 'circle', radius: 5 } }}
        onChange={onChange}
      />,
    );
    const picker = screen.getByTestId('zodform-field-shape-kind') as HTMLSelectElement;
    fireEvent.change(picker, { target: { value: 'square' } });
    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0]?.[0] as { shape: Record<string, unknown> };
    expect(next.shape.kind).toBe('square');
    // Non-discriminator fields reset (no `radius` leaks through).
    expect(next.shape.radius).toBeUndefined();
  });
});

describe('<ZodForm> — disabled + optional marker', () => {
  it('respects the disabled prop', () => {
    const schema = z.object({ label: z.string() });
    render(<ZodForm schema={schema} value={{ label: 'a' }} onChange={() => undefined} disabled />);
    const input = screen.getByTestId('zodform-field-label') as HTMLInputElement;
    expect(input.disabled).toBe(true);
  });

  it('shows an "(optional)" marker on optional fields', () => {
    const schema = z.object({ note: z.string().optional() });
    render(<ZodForm schema={schema} value={{}} onChange={() => undefined} />);
    expect(screen.getByText(/optional/i)).toBeTruthy();
  });
});
