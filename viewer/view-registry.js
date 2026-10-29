'use strict';

(function (root, factory) {
  const semantics = typeof module === 'object' && module.exports
    ? require('./semantic-registry')
    : root.ViziverseSemantics;
  const api = factory(semantics);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ViziverseViews = api;
})(typeof window !== 'undefined' ? window : globalThis, function (semantics) {
  const BUILT_IN_VIEWS = [
    { id: 'timeline', label: 'Timeline', description: 'Chronological agent and process activity', supportsReplay: true },
    { id: 'metrics', label: 'Metric curves', description: 'Numeric values over step, epoch, or time', supportsReplay: true },
    { id: 'events', label: 'Event inspector', description: 'Filterable structured event records', supportsReplay: true },
    { id: 'artifacts', label: 'Artifacts', description: 'Images and file-like outputs', supportsReplay: false },
    { id: 'spatial', label: 'Spatial view', description: 'Trajectory and coordinate data', supportsReplay: true },
    { id: 'pipeline', label: 'Pipeline graph', description: 'Stages and dependencies', supportsReplay: true }
  ];

  function listViews() { return BUILT_IN_VIEWS.map(view => ({ ...view })); }

  function recommendViews(events) {
    const ids = new Set(['events']);
    for (const event of events || []) {
      const classification = semantics.classifyEvent(event);
      ids.add(classification.view);
    }
    return BUILT_IN_VIEWS.filter(view => ids.has(view.id)).map(view => ({ ...view }));
  }

  return { listViews, recommendViews };
});
