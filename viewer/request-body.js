'use strict';

const MAX_EVENT_BYTES = 20 * 1024 * 1024;

function readJsonBody(request, maxBytes = MAX_EVENT_BYTES) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let bytes = 0;
    let settled = false;

    const fail = (message, statusCode) => {
      if (settled) return;
      settled = true;
      chunks.length = 0;
      const error = new Error(message);
      error.statusCode = statusCode;
      reject(error);
    };

    request.on('data', chunk => {
      if (settled) return;
      bytes += chunk.length;
      if (bytes > maxBytes) {
        fail(`Request body exceeds the ${maxBytes}-byte limit`, 413);
        request.resume();
        return;
      }
      chunks.push(chunk);
    });

    request.on('end', () => {
      if (settled) return;
      try {
        const body = Buffer.concat(chunks).toString('utf8');
        const parsed = JSON.parse(body);
        settled = true;
        resolve(parsed);
      } catch (_) {
        fail('Request body must contain valid JSON', 400);
      }
    });

    request.on('error', error => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    });

    request.on('aborted', () => fail('Request was aborted before the body was complete', 400));
  });
}

module.exports = { MAX_EVENT_BYTES, readJsonBody };
