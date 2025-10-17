export function track(event: string, payload?: Record<string, any>) {
  try {
    const body = JSON.stringify({ event, payload, ts: Date.now() });
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' });
      navigator.sendBeacon('/api/analytics', blob);
    } else {
      fetch('/api/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body
      });
    }
  } catch {}
}
