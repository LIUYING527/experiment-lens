'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { summarizeRunEvents, timestampMillis } = require('./analytics');

test('normalizes numeric seconds and ISO timestamps', () => {
  assert.equal(timestampMillis({ ts: 1700000000 }), 1700000000000);
  assert.equal(timestampMillis({ ts: '2024-01-01T00:00:00Z' }), Date.parse('2024-01-01T00:00:00Z'));
  assert.equal(timestampMillis({ ts: 'not-a-date' }), null);
});

test('summarizes duration, tools, errors, metrics, and event types', () => {
  const result = summarizeRunEvents([
    { type: 'run_start', ts: 1700000000 },
    { type: 'agent_tool_start', ts: 1700000001 },
    { type: 'agent_tool_error', ts: 1700000002 },
    { type: 'metric', ts: 1700000003, data: { value: 0.9 } },
    { type: 'run_end', ts: 1700000004 }
  ]);
  assert.equal(result.eventCount, 5);
  assert.equal(result.durationSeconds, 4);
  assert.equal(result.toolEvents, 2);
  assert.equal(result.errorEvents, 1);
  assert.equal(result.metricEvents, 1);
  assert.deepEqual(result.eventTypes, ['run_start', 'agent_tool_start', 'agent_tool_error', 'metric', 'run_end']);
});

test('returns null duration when timestamps are missing', () => {
  assert.equal(summarizeRunEvents([{ type: 'metric' }]).durationSeconds, null);
});
