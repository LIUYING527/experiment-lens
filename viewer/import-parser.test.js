'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseCsv, parseImportedText } = require('./import-parser');

test('imports JSON arrays and JSONL while preserving event types', () => {
  const json = parseImportedText('[{"type":"metric","data":{"name":"loss","value":1}}]', 'x.json', 10);
  assert.equal(json[0].type, 'metric');
  assert.equal(json[0].ts, 10);
  const lines = parseImportedText('{"type":"run_start"}\n{"type":"error","data":{"message":"bad"}}', 'x.jsonl', 20);
  assert.deepEqual(lines.map(e => e.type), ['run_start', 'error']);
});

test('imports TensorBoard scalar CSV and recognizes split prefixes', () => {
  const events = parseImportedText('Wall time,Step,Value,Tag\n1.2,10,0.5,train/loss\n1.3,10,0.7,eval/accuracy', 'scalars.csv', 100);
  assert.equal(events.length, 2);
  assert.equal(events[0].data.name, 'train/loss');
  assert.equal(events[0].data.split, 'train');
  assert.equal(events[1].data.split, 'validation');
  assert.equal(events[1].data.value, 0.7);
});

test('imports wide-format CSV with quoted commas and separate numeric metrics', () => {
  const events = parseImportedText('step,loss,accuracy,note\n1,2.5,0.7,"hello, world"\n2,1.8,0.8,done', 'wide.csv', 100);
  assert.equal(events.length, 4);
  assert.deepEqual(events.map(e => e.data.name), ['loss', 'accuracy', 'loss', 'accuracy']);
  assert.equal(events[2].data.step, 2);
});

test('parses escaped quotes and rejects malformed or unhelpful files', () => {
  assert.deepEqual(parseCsv('a,b\n1,"a ""quote"""'), [['a','b'],['1','a "quote"']]);
  assert.throws(() => parseCsv('a,b\n1,"unfinished'), /unclosed/);
  assert.throws(() => parseImportedText('hello world', 'bad.txt'), /Could not recognize|No usable/);
});
