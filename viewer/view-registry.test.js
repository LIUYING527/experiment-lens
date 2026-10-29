'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { listViews, recommendViews } = require('./view-registry');

test('exposes defensive copies of built-in view definitions', () => {
  const views = listViews();
  assert.ok(views.some(view => view.id === 'timeline'));
  views[0].label = 'mutated';
  assert.notEqual(listViews()[0].label, 'mutated');
});

test('recommends views based on observed event semantics and always includes event inspector', () => {
  const views = recommendViews([{type:'metric'},{type:'trajectory'},{type:'image'}]);
  const ids = views.map(view => view.id);
  assert.ok(ids.includes('events'));
  assert.ok(ids.includes('metrics'));
  assert.ok(ids.includes('spatial'));
  assert.ok(ids.includes('artifacts'));
  assert.ok(!ids.includes('pipeline'));
});
