const fs = require('fs');
const path = require('path');

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

    const recent = events.slice(-this.maxEvents);
    if (events.length > recent.length || lines.length !== events.length) {
      this._writeSnapshot(recent);
    }
    return recent;
  }

  append(event, currentEvents) {
    const line = JSON.stringify(event) + '\n';
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

  async _writeSnapshot(events) {
    await fs.promises.mkdir(path.dirname(this.filePath), { recursive: true });
    const tempPath = this.filePath + '.tmp';
    const content = events.map(event => JSON.stringify(event)).join('\n');
    await fs.promises.writeFile(tempPath, content ? content + '\n' : '', 'utf8');
    await fs.promises.rename(tempPath, this.filePath);
  }
}

module.exports = { EventStore };
