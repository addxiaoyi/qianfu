import { act, createElement, type ReactNode, useEffect } from '../../qianfu-liandeng/node_modules/react';
import { createRoot, type Root } from '../../qianfu-liandeng/node_modules/react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSSE } from '../../qianfu-liandeng/src/hooks/useSSE';

class TestEventSource {
  static instances: TestEventSource[] = [];
  static readonly CLOSED = 2;

  readonly url: string;
  readyState = 0;
  onerror: ((event: Event) => void) | null = null;
  private readonly listeners = new Map<string, EventListener[]>();

  constructor(url: string) {
    this.url = url;
    TestEventSource.instances.push(this);
  }

  addEventListener(event: string, listener: EventListener): void {
    const listeners = this.listeners.get(event) ?? [];
    listeners.push(listener);
    this.listeners.set(event, listeners);
  }

  removeEventListener(event: string, listener: EventListener): void {
    const listeners = this.listeners.get(event) ?? [];
    this.listeners.set(event, listeners.filter((registered) => registered !== listener));
  }

  close(): void {
    this.readyState = TestEventSource.CLOSED;
  }

  fail(): void {
    this.readyState = TestEventSource.CLOSED;
    this.onerror?.(new Event('error'));
  }
}

describe('useSSE lifecycle', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    TestEventSource.instances = [];
    vi.stubGlobal('EventSource', TestEventSource);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const mount = (onValue: (value: ReturnType<typeof useSSE>) => void) => {
    function Probe(): ReactNode {
      const value = useSSE({
        url: '/api/events',
        reconnectInterval: 10,
        maxReconnectAttempts: 2,
      });
      useEffect(() => onValue(value), [value]);
      return null;
    }

    act(() => root.render(createElement(Probe)));
  };

  it('increments reconnect attempts and stops after the configured maximum', () => {
    let current: ReturnType<typeof useSSE> | undefined;
    mount((value) => { current = value; });

    act(() => TestEventSource.instances[0].fail());
    expect(current?.state.reconnectAttempts).toBe(1);

    act(() => vi.advanceTimersByTime(10));
    expect(TestEventSource.instances).toHaveLength(2);

    act(() => TestEventSource.instances[1].fail());
    act(() => vi.advanceTimersByTime(10));
    expect(TestEventSource.instances).toHaveLength(3);
    expect(current?.state.reconnectAttempts).toBe(2);

    act(() => TestEventSource.instances[2].fail());
    expect(current?.state.error).toBe('Max reconnection attempts reached');
    act(() => vi.advanceTimersByTime(100));
    expect(TestEventSource.instances).toHaveLength(3);
  });

  it('cancels pending reconnects when the hook is unmounted', () => {
    mount(() => undefined);

    act(() => TestEventSource.instances[0].fail());
    act(() => root.unmount());
    act(() => vi.advanceTimersByTime(100));

    expect(TestEventSource.instances).toHaveLength(1);
    expect(TestEventSource.instances[0].readyState).toBe(TestEventSource.CLOSED);
  });

  it('removes registered listeners before closing an SSE connection', () => {
    mount(() => undefined);

    const source = TestEventSource.instances[0];
    const removeSpy = vi.spyOn(source, 'removeEventListener');

    act(() => root.unmount());

    expect(removeSpy).toHaveBeenCalledWith('connected', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('heartbeat', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('notification', expect.any(Function));
  });
});
