'use strict';

function timestampMillis(event) {
  const raw = event?.ts;
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
    return raw < 1e12 ? raw * 1000 : raw;
  }
  if (typeof raw === 'string') {
    const parsed = Date.parse(raw);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function summarizeRunEvents(events) {
  const times = events.map(timestampMillis).filter(value => value !== null);
  const durationSeconds = times.length > 1
    ? Math.max(0, (Math.max(...times) - Math.min(...times)) / 1000)
    : null;
  return {
    eventCount: events.length,
    durationSeconds,
    toolEvents: events.filter(event => /tool/i.test(String(event.type))).length,
    errorEvents: events.filter(event => /error|failure|exception/i.test(String(event.type))).length,
    metricEvents: events.filter(event => event.type === 'metric').length,
    eventTypes: [...new Set(events.map(event => event.type))].slice(0, 6)
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { timestampMillis, summarizeRunEvents };
}
if (typeof window !== 'undefined') {
  window.ExperimentLensAnalytics = { timestampMillis, summarizeRunEvents };
}
