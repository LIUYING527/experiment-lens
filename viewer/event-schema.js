'use strict';

const { randomUUID } = require('node:crypto');

const SCHEMA_VERSION = '1';
const MAX_TYPE_LENGTH = 128;
const MAX_ID_LENGTH = 256;

function schemaError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

/**
 * Normalize legacy and current events into the version-1 envelope.
 * Unknown event types and source-specific fields are deliberately preserved.
 */
function normalizeEvent(input, options = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw schemaError('Event must be a JSON object');
  }
  if (typeof input.type !== 'string' || !input.type.trim()) {
    throw schemaError('event.type must be a non-empty string');
  }
  const type = input.type.trim();
  if (type.length > MAX_TYPE_LENGTH) {
    throw schemaError('event.type exceeds 128 characters');
  }
  if (input.data !== undefined && (input.data === null || typeof input.data !== 'object' || Array.isArray(input.data))) {
    throw schemaError('event.data must be an object when provided');
  }

  const timestamp = input.ts === undefined || input.ts === null
    ? (options.now === undefined ? Date.now() / 1000 : options.now)
    : Number(input.ts);
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    throw schemaError('event.ts must be a positive finite timestamp');
  }

  const legacyId = typeof input.id === 'string' && input.id.trim() ? input.id.trim() : null;
  const eventId = typeof input.event_id === 'string' && input.event_id.trim()
    ? input.event_id.trim()
    : legacyId || (typeof options.createId === 'function' ? options.createId() : randomUUID());
  if (eventId.length > MAX_ID_LENGTH) throw schemaError('event_id exceeds 256 characters');

  return {
    ...input,
    schema_version: String(input.schema_version || SCHEMA_VERSION),
    event_id: eventId,
    type,
    ts: timestamp,
    data: input.data === undefined ? {} : input.data
  };
}

module.exports = { SCHEMA_VERSION, normalizeEvent };
