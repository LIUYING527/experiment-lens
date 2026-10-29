'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Viziverse } = require('../index');

test('emits a versioned event with run metadata', async () => {
  const events = [];
  const viz = new Viziverse({ runId: 'r1', runName: 'unit-test', transport: event => events.push(event) });
  assert.equal(await viz.metric('loss', 0.25, { split: 'train' }), true);
  assert.equal(events.length, 1);
  assert.equal(events[0].schema_version, '1');
  assert.ok(events[0].event_id);
  assert.equal(events[0].run_id, 'r1');
  assert.equal(events[0].run_name, 'unit-test');
  assert.equal(events[0].type, 'metric');
  assert.deepEqual(events[0].data, { name: 'loss', value: 0.25, split: 'train' });
});

test('training, evaluation, and trajectory helpers preserve semantic metadata', async () => {
  const events = [];
  const viz = new Viziverse({ transport: event => events.push(event) });
  await viz.trainingMetric('loss', 1.2, { epoch: 2 });
  await viz.evaluationMetric('success_rate', 0.7, { epoch: 2 });
  await viz.trajectory([[0, 0], [1, 2]], { frame: 'map' });
  assert.equal(events[0].data.split, 'train');
  assert.equal(events[1].data.split, 'validation');
  assert.equal(events[2].data.frame, 'map');
});

test('step increments by default and accepts an explicit index', async () => {
  const events = [];
  const viz = new Viziverse({ transport: event => events.push(event) });
  await viz.step({ phase: 'load' });
  await viz.step({ phase: 'train' }, 40);
  assert.equal(events[0].step, 1);
  assert.equal(events[1].step, 40);
});

test('validates event input and propagates errors when failSilently is disabled', async () => {
  const viz = new Viziverse({ transport: () => { throw new Error('offline'); }, failSilently: false });
  await assert.rejects(viz.emit('', {}), /non-empty/);
  await assert.rejects(viz.emit('custom', []), /must be an object/);
  await assert.rejects(viz.emit('custom', {}), /offline/);
});


test('extra metadata cannot overwrite protocol envelope fields', async () => {
  const events = [];
  const viz = new Viziverse({ runId: 'stable-run', transport: event => events.push(event) });
  await viz.emit('custom', { safe: true }, { type: 'overridden', run_id: 'wrong', schema_version: '99', data: { unsafe: true } });
  assert.equal(events[0].type, 'custom');
  assert.equal(events[0].run_id, 'stable-run');
  assert.equal(events[0].schema_version, '1');
  assert.deepEqual(events[0].data, { safe: true });
});
