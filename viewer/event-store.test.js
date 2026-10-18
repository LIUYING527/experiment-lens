const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { EventStore } = require('./event-store');

function tempFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'experiment-lens-'));
  return { dir, file: path.join(dir, 'events.jsonl') };
}

test('loads persisted events after a new store instance is created', async () => {
  const { dir, file } = tempFile();
  try {
    const first = new EventStore(file);
    const events = [{ type: 'run_start', run_id: 'a' }, { type: 'metric', run_id: 'a', data: { score: 1 } }];
    for (const event of events) await first.append(event, events);
    await first.flush();

    const second = new EventStore(file);
    assert.deepEqual(second.load(), events);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('recovers valid lines and keeps only the newest maxEvents', async () => {
  const { dir, file } = tempFile();
  try {
    fs.writeFileSync(file, [
      JSON.stringify({ type: 'step', n: 1 }),
      'not valid json',
      JSON.stringify({ type: 'step', n: 2 }),
      JSON.stringify({ type: 'step', n: 3 }),
      ''
    ].join('\n'));

    const store = new EventStore(file, 2);
    assert.deepEqual(store.load(), [{ type: 'step', n: 2 }, { type: 'step', n: 3 }]);
    const persisted = fs.readFileSync(file, 'utf8').trim().split('\n').map(JSON.parse);
    assert.deepEqual(persisted, [{ type: 'step', n: 2 }, { type: 'step', n: 3 }]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('compacts the log to the current in-memory event window', async () => {
  const { dir, file } = tempFile();
  try {
    const store = new EventStore(file, 3, 2);
    let events = [];
    for (let n = 1; n <= 6; n += 1) {
      events.push({ type: 'step', n });
      if (events.length > 3) events.shift();
      await store.append(events[events.length - 1], events);
    }
    await store.flush();
    const persisted = fs.readFileSync(file, 'utf8').trim().split('\n').map(JSON.parse);
    assert.deepEqual(persisted, [{ type: 'step', n: 4 }, { type: 'step', n: 5 }, { type: 'step', n: 6 }]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
