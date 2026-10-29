'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeEvent, SCHEMA_VERSION } = require('./event-schema');

test('adds a versioned envelope while preserving producer-specific fields', () => {
  const event = normalizeEvent({ id: 'legacy-id', type: ' metric ', run_id: 'r1', data: { name: 'loss', value: 0.2 } }, { now: 123.5 });
  assert.equal(event.schema_version, SCHEMA_VERSION);
  assert.equal(event.event_id, 'legacy-id');
  assert.equal(event.type, 'metric');
  assert.equal(event.ts, 123.5);
  assert.deepEqual(event.data, { name: 'loss', value: 0.2 });
  assert.equal(event.run_id, 'r1');
});

test('preserves explicit event ids, schema versions, and timestamps', () => {
  const event = normalizeEvent({ schema_version: '2', event_id: 'evt-2', type: 'custom', ts: 1700000000, data: {} });
  assert.equal(event.schema_version, '2');
  assert.equal(event.event_id, 'evt-2');
  assert.equal(event.ts, 1700000000);
});

test('normalizes missing data to an empty object and generates an event id', () => {
  const event = normalizeEvent({ type: 'run_start' }, { now: 100, createId: () => 'generated' });
  assert.equal(event.event_id, 'generated');
  assert.deepEqual(event.data, {});
  assert.equal(event.ts, 100);
});

test('rejects malformed event types, data, and timestamps with client errors', () => {
  for (const input of [null, [], { type: '' }, { type: 'x'.repeat(129) }, { type: 'x', data: 'not-an-object' }, { type: 'x', ts: Infinity }, { type: 'x', ts: -1 }]) {
    assert.throws(() => normalizeEvent(input), error => error.statusCode === 400);
  }
});
