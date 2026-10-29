'use strict';

const { randomUUID } = require('node:crypto');

class Viziverse {
  constructor(options = {}) {
    this.baseUrl = String(options.baseUrl || 'http://127.0.0.1:7337').replace(/\/+$/, '');
    this.runId = String(options.runId || randomUUID().slice(0, 8));
    this.runName = String(options.runName || 'javascript-run');
    this.timeoutMs = Number.isFinite(options.timeoutMs) && options.timeoutMs > 0 ? options.timeoutMs : 1000;
    this.failSilently = options.failSilently !== false;
    this._step = 0;
    this._transport = typeof options.transport === 'function' ? options.transport : null;
  }

  async emit(type, data = {}, metadata = {}) {
    if (typeof type !== 'string' || !type.trim()) throw new TypeError('event type must be a non-empty string');
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new TypeError('event data must be an object');
    const event = {
      schema_version: '1',
      event_id: randomUUID(),
      ts: Date.now() / 1000,
      run_id: this.runId,
      run_name: this.runName,
      type: type.trim(),
      step: this._step,
      data: { ...data },
      ...metadata
    };
    try {
      if (this._transport) {
        await this._transport(event);
        return true;
      }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await fetch(this.baseUrl + '/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(event),
          signal: controller.signal
        });
        if (!response.ok) throw new Error('Viziverse returned HTTP ' + response.status);
        return true;
      } finally {
        clearTimeout(timeout);
      }
    } catch (error) {
      if (!this.failSilently) throw error;
      return false;
    }
  }

  startRun(metadata = {}) { return this.emit('run_start', { status: 'running', ...metadata }); }
  endRun(status = 'completed', metadata = {}) { return this.emit('run_end', { status, ...metadata }); }

  step(data = {}, index) {
    this._step = index === undefined ? this._step + 1 : Number(index);
    if (!Number.isFinite(this._step) || this._step < 0) throw new TypeError('step index must be a non-negative finite number');
    return this.emit('step', data);
  }

  metric(name, value, metadata = {}) {
    return this.emit('metric', { name: String(name), value, ...metadata });
  }

  trainingMetric(name, value, metadata = {}) {
    return this.metric(name, value, { split: 'train', phase: 'training', ...metadata });
  }

  evaluationMetric(name, value, metadata = {}) {
    return this.metric(name, value, { split: 'validation', phase: 'evaluation', ...metadata });
  }

  action(name, metadata = {}) { return this.emit('action', { name, ...metadata }); }
  goal(x, y, metadata = {}) { return this.emit('goal', { x, y, ...metadata }); }
  trajectory(points, metadata = {}) { return this.emit('trajectory', { points, ...metadata }); }
}

module.exports = { Viziverse };
