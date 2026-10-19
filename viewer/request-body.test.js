'use strict';

const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const test = require('node:test');
const { readJsonBody } = require('./request-body');

function requestFrom(value) {
  return Readable.from([Buffer.from(value)]);
}

test('parses a valid JSON request body', async () => {
  assert.deepEqual(await readJsonBody(requestFrom('{"type":"metric","data":{"value":0.8}}')), {
    type: 'metric', data: { value: 0.8 }
  });
});

test('rejects malformed JSON with a client error status', async () => {
  await assert.rejects(readJsonBody(requestFrom('{oops')), error => {
    assert.equal(error.statusCode, 400);
    assert.match(error.message, /valid JSON/);
    return true;
  });
});

test('rejects bodies that exceed the configured byte limit', async () => {
  await assert.rejects(readJsonBody(requestFrom('123456789'), 8), error => {
    assert.equal(error.statusCode, 413);
    assert.match(error.message, /exceeds/);
    return true;
  });
});
