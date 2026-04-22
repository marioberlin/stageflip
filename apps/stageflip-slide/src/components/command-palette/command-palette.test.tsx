// apps/stageflip-slide/src/components/command-palette/command-palette.test.tsx
// Open/close + filter + keyboard navigation for the T-127 palette.

import { DocumentProvider } from '@stageflip/editor-shell';
import type { Document } from '@stageflip/schema';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CommandPalette } from './command-palette';
import type { PaletteCommand } from './commands';

afterEach(() => {
  cleanup();
});

function wrap(children: React.ReactNode, initialDocument: Document | null = null) {
  return <DocumentProvider initialDocument={initialDocument}>{children}</DocumentProvider>;
}

function testCommand(id: string, overrides: Partial<PaletteCommand> = {}): PaletteCommand {
  return {
    id,
    label: overrides.label ?? `Run ${id}`,
    category: overrides.category ?? 'help',
    run: overrides.run ?? vi.fn().mockReturnValue(true),
    ...overrides,
  } as PaletteCommand;
}

describe('<CommandPalette> — visibility', () => {
  it('renders nothing when open=false', () => {
    const { container } = render(wrap(<CommandPalette open={false} onClose={() => {}} />));
    expect(container.firstChild).toBeNull();
  });

  it('mounts the dialog + input + list when open=true', () => {
    render(wrap(<CommandPalette open={true} onClose={() => {}} />));
    expect(screen.getByTestId('command-palette')).toBeTruthy();
    expect(screen.getByTestId('command-palette-input')).toBeTruthy();
    expect(screen.getByTestId('command-palette-list')).toBeTruthy();
  });

  it('closes when Escape is pressed on the dialog', () => {
    const onClose = vi.fn();
    render(wrap(<CommandPalette open={true} onClose={onClose} />));
    fireEvent.keyDown(screen.getByTestId('command-palette'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes when the backdrop is clicked but not when the panel is clicked', () => {
    const onClose = vi.fn();
    render(wrap(<CommandPalette open={true} onClose={onClose} />));
    fireEvent.click(screen.getByTestId('command-palette')); // backdrop
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId('command-palette-panel'));
    // still just the one call — panel clicks don't bubble.
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('<CommandPalette> — filter + navigation', () => {
  const cmds: PaletteCommand[] = [
    testCommand('slide.new', { label: 'New slide', category: 'slide' }),
    testCommand('slide.delete', { label: 'Delete slide', category: 'slide' }),
    testCommand('selection.clear', { label: 'Clear selection', category: 'selection' }),
  ];

  it('narrows the list by the query (case-insensitive substring)', () => {
    render(wrap(<CommandPalette open={true} onClose={() => {}} commands={cmds} />));
    const input = screen.getByTestId('command-palette-input');
    fireEvent.change(input, { target: { value: 'CLEAR' } });
    expect(screen.getByTestId('command-palette-item-selection.clear')).toBeTruthy();
    expect(screen.queryByTestId('command-palette-item-slide.new')).toBeNull();
    expect(screen.queryByTestId('command-palette-item-slide.delete')).toBeNull();
  });

  it('shows empty state when the filter excludes everything', () => {
    render(wrap(<CommandPalette open={true} onClose={() => {}} commands={cmds} />));
    const input = screen.getByTestId('command-palette-input');
    fireEvent.change(input, { target: { value: 'xxx' } });
    expect(screen.getByTestId('command-palette-empty')).toBeTruthy();
  });

  it('ArrowDown / ArrowUp move the cursor; Enter runs the command', () => {
    const slideNewRun = vi.fn().mockReturnValue(true);
    const slideDeleteRun = vi.fn().mockReturnValue(true);
    const onClose = vi.fn();
    render(
      wrap(
        <CommandPalette
          open={true}
          onClose={onClose}
          commands={[
            testCommand('slide.new', { label: 'New', category: 'slide', run: slideNewRun }),
            testCommand('slide.delete', {
              label: 'Delete',
              category: 'slide',
              run: slideDeleteRun,
            }),
          ]}
        />,
      ),
    );
    const host = screen.getByTestId('command-palette');
    // Initial cursor is on row 0; pressing ArrowDown moves to row 1.
    fireEvent.keyDown(host, { key: 'ArrowDown' });
    fireEvent.keyDown(host, { key: 'Enter' });
    expect(slideDeleteRun).toHaveBeenCalledTimes(1);
    expect(slideNewRun).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('clicking a row runs that row (regardless of cursor)', () => {
    const targetRun = vi.fn().mockReturnValue(true);
    const onClose = vi.fn();
    render(
      wrap(
        <CommandPalette
          open={true}
          onClose={onClose}
          commands={[
            testCommand('slide.new', { label: 'New', category: 'slide' }),
            testCommand('slide.delete', {
              label: 'Delete',
              category: 'slide',
              run: targetRun,
            }),
          ]}
        />,
      ),
    );
    fireEvent.click(screen.getByTestId('command-palette-item-slide.delete'));
    expect(targetRun).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalled();
  });

  it('a command that returns false keeps the palette open', () => {
    const failingRun = vi.fn().mockReturnValue(false);
    const onClose = vi.fn();
    render(
      wrap(
        <CommandPalette
          open={true}
          onClose={onClose}
          commands={[testCommand('slide.new', { run: failingRun })]}
        />,
      ),
    );
    fireEvent.keyDown(screen.getByTestId('command-palette'), { key: 'Enter' });
    expect(failingRun).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });
});
