'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { classifyEvent, summarizeEventTypes } = require('./semantic-registry');

test('classifies common event families without rejecting unknown events', () => {
  assert.equal(classifyEvent({type:'metric',data:{name:'loss'}}).kind, 'metric');
  assert.equal(classifyEvent({type:'image',data:{name:'frame'}}).view, 'artifacts');
  assert.equal(classifyEvent({type:'trajectory',data:{points:[]}}).kind, 'spatial');
  assert.equal(classifyEvent({type:'agent_tool_start'}).kind, 'agent');
  assert.equal(classifyEvent({type:'custom_domain_event'}).kind, 'event');
});

test('summarizes semantic kinds across a stream', () => {
  const kinds = summarizeEventTypes([{type:'metric'},{type:'image'},{type:'custom'}]);
  assert.deepEqual([...kinds].sort(), ['artifact','event','metric']);
});
