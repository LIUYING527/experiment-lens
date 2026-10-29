'use strict';

(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ViziverseSemantics = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  const TYPE_RULES = [
    { match: e => e.type === 'metric' || e.type === 'training_metric' || e.type === 'evaluation_metric', kind: 'metric', label: 'Metric', view: 'metrics' },
    { match: e => e.type === 'image' || e.type === 'artifact' || e.type === 'file_artifact', kind: 'artifact', label: 'Artifact', view: 'artifacts' },
    { match: e => ['trajectory', 'pose', 'spatial_point', 'map'].includes(e.type), kind: 'spatial', label: 'Spatial data', view: 'spatial' },
    { match: e => /^agent_/.test(e.type) || e.data?.source === 'claude-code' || ['tool_call', 'tool_result', 'span', 'trace'].includes(e.type), kind: 'agent', label: 'Agent activity', view: 'timeline' },
    { match: e => ['pipeline_stage', 'task_stage', 'dependency_edge'].includes(e.type), kind: 'pipeline', label: 'Pipeline event', view: 'pipeline' },
    { match: e => ['error', 'exception', 'log', 'warning'].includes(e.type), kind: 'log', label: 'Log / error', view: 'events' }
  ];

  function classifyEvent(event) {
    if (!event || typeof event.type !== 'string') return { kind: 'unknown', label: 'Unknown event', view: 'events' };
    const rule = TYPE_RULES.find(candidate => candidate.match(event));
    return rule ? { kind: rule.kind, label: rule.label, view: rule.view } : { kind: 'event', label: 'Structured event', view: 'events' };
  }

  function summarizeEventTypes(events) {
    const kinds = new Set();
    for (const event of events || []) kinds.add(classifyEvent(event).kind);
    return kinds;
  }

  return { classifyEvent, summarizeEventTypes };
});
