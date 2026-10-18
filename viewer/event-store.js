const fs = require('fs');
const path = require('path');

function sanitizeEvent(event) {
  const copy = JSON.parse(JSON.stringify(event));
  if (copy.data && typeof copy.data === 'object' && typeof copy.data.data_url === 'string') {
    delete copy.data.data_url;
    copy.data.payload_omitted = true;
  }
  return copy;
}

class EventStore {
  constructor(filePath, maxEvents = 3000, compactEvery = 100) {
    this.filePath = filePath;
    this.maxEvents = maxEvents;
    this.compactEvery = compactEvery;
    this.writesSinceCompact = 0;
    this.pending = Promise.resolve();
  }

  load() {
    let lines = [];
    try {
      lines = fs.readFileSync(this.filePath, 'utf8').split('\n').filter(Boolean);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      return [];
    }

    const events = [];
    for (const line of lines) {
      try {
        const event = JSON.parse(line);
        if (event && typeof event.type === 'string') events.push(event);
      } catch (_) {
        // Ignore a truncated or malformed final line and continue recovering.
      }
    }

    const recent = events.slice(-this.maxEvents).map(sanitizeEvent);
    const hasLegacyImagePayloads = events.some(event => event.data && typeof event.data.data_url === 'string');
    if (events.length > recent.length || lines.length !== events.length || hasLegacyImagePayloads) {
      this._writeSnapshotSync(recent);
    }
    return recent;
  }

  append(event, currentEvents) {
    const line = JSON.stringify(sanitizeEvent(event)) + '\n';
    this.pending = this.pending.then(async () => {
      await fs.promises.mkdir(path.dirname(this.filePath), { recursive: true });
      await fs.promises.appendFile(this.filePath, line, 'utf8');
      this.writesSinceCompact += 1;
      if (this.writesSinceCompact >= this.compactEvery) {
        await this._writeSnapshot(currentEvents.slice(-this.maxEvents));
        this.writesSinceCompact = 0;
      }
    }).catch(error => {
      console.error('Experiment Lens could not persist an event:', error.message);
    });
    return this.pending;
  }

  async flush() {
    await this.pending;
  }

  _writeSnapshotSync(events) {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const content = events.map(event => JSON.stringify(sanitizeEvent(event))).join('\n');
    fs.writeFileSync(this.filePath, content ? content + '\n' : '', 'utf8');
  }

  async _writeSnapshot(events) {
    await fs.promises.mkdir(path.dirname(this.filePath), { recursive: true });
    const tempPath = this.filePath + '.tmp';
    const content = events.map(event => JSON.stringify(sanitizeEvent(event))).join('\n');
    await fs.promises.writeFile(tempPath, content ? content + '\n' : '', 'utf8');
    await fs.promises.rename(tempPath, this.filePath);
  }
}

module.exports = { EventStore, sanitizeEvent };
