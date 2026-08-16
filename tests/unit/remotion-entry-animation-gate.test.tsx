import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ENTRY_ANIMATION_STORAGE_KEY } from '../../qianfu-liandeng/src/components/entry/entryAnimationState';
import EntryAnimationGate, { type EntryAnimationPlayerProps } from '../../qianfu-liandeng/src/components/entry/EntryAnimationGate';

const playerState: { props: EntryAnimationPlayerProps | null } = { props: null };

const MockPlayer: React.FC<EntryAnimationPlayerProps> = (props) => {
  playerState.props = props;
  return <div data-testid="mock-player" />;
};

const setReducedMotion = (matches: boolean) => {
  window.matchMedia = vi.fn().mockReturnValue({
    matches,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
};

describe('EntryAnimationGate', () => {
  let root: Root | null = null;

  beforeEach(() => {
    sessionStorage.clear();
    playerState.props = null;
    setReducedMotion(false);
    root?.unmount();
    root = null;
    document.body.innerHTML = '';
  });

  const renderGate = async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root?.render(
        <EntryAnimationGate playerComponent={MockPlayer}>
          <div>page</div>
        </EntryAnimationGate>,
      );
    });
    return container;
  };

  it('renders the player only for an unplayed session', async () => {
    const container = await renderGate();

    expect(container.querySelector('[data-testid="entry-animation"]')).not.toBeNull();
    expect(container.textContent).toContain('page');
    expect(container.querySelector('[data-testid="mock-player"]')).not.toBeNull();
    expect(playerState.props?.initiallyMuted).toBe(true);
  });

  it('removes the overlay after skip and writes the completion marker', async () => {
    const container = await renderGate();
    const skipButton = container.querySelector('button[aria-label="跳过入场动画"]');
    expect(skipButton).not.toBeNull();

    await act(async () => {
      skipButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.querySelector('[data-testid="entry-animation"]')).toBeNull();
    expect(sessionStorage.getItem(ENTRY_ANIMATION_STORAGE_KEY)).toBe('played');
  });

  it('removes the overlay when Escape, completion, or player error occurs', async () => {
    let container = await renderGate();

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(container.querySelector('[data-testid="entry-animation"]')).toBeNull();

    sessionStorage.clear();
    root?.unmount();
    container = await renderGate();
    await act(async () => playerState.props?.onEnded());
    expect(container.querySelector('[data-testid="entry-animation"]')).toBeNull();

    sessionStorage.clear();
    root?.unmount();
    container = await renderGate();
    await act(async () => playerState.props?.onError());
    expect(container.querySelector('[data-testid="entry-animation"]')).toBeNull();
  });

  it('skips the player for a completed session or reduced motion preference', async () => {
    sessionStorage.setItem(ENTRY_ANIMATION_STORAGE_KEY, 'played');
    let container = await renderGate();
    expect(container.querySelector('[data-testid="entry-animation"]')).toBeNull();

    sessionStorage.clear();
    setReducedMotion(true);
    root?.unmount();
    container = await renderGate();
    expect(container.querySelector('[data-testid="entry-animation"]')).toBeNull();
  });
});
