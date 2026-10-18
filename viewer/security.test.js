'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { isTrustedLocalOrigin } = require('./security');

test('allows SDK clients without an Origin header and local Electron origins', () => {
  assert.equal(isTrustedLocalOrigin(undefined), true);
  assert.equal(isTrustedLocalOrigin('file://'), true);
  assert.equal(isTrustedLocalOrigin('null'), true);
});

test('rejects network origins from browser pages', () => {
  assert.equal(isTrustedLocalOrigin('https://example.com'), false);
  assert.equal(isTrustedLocalOrigin('http://localhost:3000'), false);
});
