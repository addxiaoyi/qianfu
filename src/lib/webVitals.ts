import type { Metric } from 'web-vitals';

const WEB_VITALS_ENDPOINT = '/api/v1/web-vitals';
const WEB_VITAL_EVENT = 'qianfu:web-vital';

type WebVitalPayload = Pick<
  Metric,
  'name' | 'value' | 'delta' | 'id' | 'rating' | 'navigationType'
>;

type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
};

let webVitalsScheduled = false;

function publishMetric(metric: Metric): void {
  const payload: WebVitalPayload = {
    name: metric.name,
    value: metric.value,
    delta: metric.delta,
    id: metric.id,
    rating: metric.rating,
    navigationType: metric.navigationType,
  };

  window.dispatchEvent(
    new CustomEvent<WebVitalPayload>(WEB_VITAL_EVENT, { detail: payload }),
  );

  const body = JSON.stringify(payload);
  if (
    typeof navigator.sendBeacon === 'function' &&
    navigator.sendBeacon(
      WEB_VITALS_ENDPOINT,
      new Blob([body], { type: 'application/json' }),
    )
  ) {
    return;
  }

  void fetch(WEB_VITALS_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
    credentials: 'same-origin',
    keepalive: true,
  }).catch(() => undefined);
}

export async function reportWebVitals(): Promise<void> {
  if (typeof window === 'undefined' || typeof performance === 'undefined') return;

  try {
    const { onCLS, onFCP, onINP, onLCP, onTTFB } = await import('web-vitals');
    const options = { reportAllChanges: false };
    onCLS(publishMetric, options);
    onFCP(publishMetric, options);
    onINP(publishMetric, options);
    onLCP(publishMetric, options);
    onTTFB(publishMetric, options);
  } catch {
    // Performance telemetry must never interfere with application startup.
  }
}

export function scheduleWebVitals(): void {
  if (
    typeof window === 'undefined' ||
    typeof document === 'undefined' ||
    webVitalsScheduled
  ) {
    return;
  }

  webVitalsScheduled = true;
  const idleWindow = window as IdleWindow;
  const start = () => {
    void reportWebVitals();
  };
  const scheduleAfterLoad = () => {
    if (idleWindow.requestIdleCallback) {
      idleWindow.requestIdleCallback(start, { timeout: 5000 });
      return;
    }
    window.setTimeout(start, 2000);
  };

  if (document.readyState === 'complete') {
    scheduleAfterLoad();
    return;
  }

  window.addEventListener('load', scheduleAfterLoad, { once: true });
}
