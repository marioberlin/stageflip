// apps/stageflip-slide/src/components/ai-copilot/ai-variant-panel.test.tsx

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AiVariantPanel, type Variant } from './ai-variant-panel';

afterEach(() => cleanup());

describe('<AiVariantPanel>', () => {
  it('renders nothing when no variants and empty-state is not forced on', () => {
    const { container } = render(<AiVariantPanel variants={[]} onSelect={() => undefined} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the empty-state card when forced even with no variants', () => {
    render(<AiVariantPanel variants={[]} onSelect={() => undefined} showEmptyState />);
    expect(screen.getByTestId('ai-variant-panel-empty')).toBeTruthy();
  });

  it('renders a button per variant and invokes onSelect with the variant id', () => {
    const variants: Variant[] = [
      { id: 'v1', label: 'Option A' },
      { id: 'v2', label: 'Option B' },
    ];
    const onSelect = vi.fn();
    render(<AiVariantPanel variants={variants} onSelect={onSelect} />);
    expect(screen.getByTestId('ai-variant-v1')).toBeTruthy();
    expect(screen.getByTestId('ai-variant-v2')).toBeTruthy();
    fireEvent.click(screen.getByTestId('ai-variant-v2'));
    expect(onSelect).toHaveBeenCalledWith('v2');
  });
});
