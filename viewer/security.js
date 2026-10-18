'use strict';

function isTrustedLocalOrigin(origin) {
  return !origin || origin === 'file://' || origin === 'null';
}

module.exports = { isTrustedLocalOrigin };
