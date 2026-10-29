'use strict';

(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ViziverseImportParser = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  const SPECIAL_COLUMNS = new Set(['step', 'epoch', 'timestamp', 'time', 'wall time', 'wall_time', 'run_id', 'run_name', 'split', 'phase', 'type', 'event_type', 'name', 'tag', 'value', 'data']);

  function parseCsv(text) {
    const rows = [];
    let row = [], cell = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (quoted) {
        if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (ch === '"') quoted = false;
        else cell += ch;
      } else if (ch === '"' && cell.length === 0) quoted = true;
      else if (ch === ',') { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); cell = '';
        if (row.some(value => value.trim() !== '')) rows.push(row);
        row = [];
      } else cell += ch;
    }
    if (cell.length || row.length) { row.push(cell); if (row.some(value => value.trim() !== '')) rows.push(row); }
    if (quoted) throw new Error('CSV contains an unclosed quoted field');
    return rows;
  }

  function asNumber(value) {
    if (value === undefined || value === null || String(value).trim() === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function splitFor(name, row) {
    const explicit = row.split || row.phase;
    if (explicit) return String(explicit).toLowerCase().replace(/^eval$/, 'validation');
    const prefix = String(name).match(/^(train|eval|validation|val|test)[/_](.+)$/i);
    if (!prefix) return 'metric';
    return { train: 'train', eval: 'validation', validation: 'validation', val: 'validation', test: 'test' }[prefix[1].toLowerCase()];
  }

  function parseImportedText(text, filename = 'imported-log', now = Date.now() / 1000) {
    const source = String(text || '').replace(/^\uFEFF/, '').trim();
    if (!source) throw new Error('The selected file is empty');
    const base = { schema_version: '1', run_id: 'import-' + String(filename).replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80), run_name: filename, source: { name: 'file-import', filename } };
    const normalize = (e, i) => ({ ...base, ...e, event_id: e.event_id || e.id || ('import-' + i), ts: asNumber(e.ts) ?? now + i / 1000, data: e.data && typeof e.data === 'object' && !Array.isArray(e.data) ? e.data : {} });

    try {
      const parsed = JSON.parse(source);
      const values = Array.isArray(parsed) ? parsed : Array.isArray(parsed.events) ? parsed.events : [parsed];
      const events = values.filter(e => e && typeof e === 'object' && !Array.isArray(e) && typeof e.type === 'string').map(normalize);
      if (events.length) return events;
    } catch (_) {}

    const lines = source.split(/\r?\n/).filter(line => line.trim());
    const jsonEvents = [];
    let jsonLinesOnly = true;
    for (const line of lines) {
      try {
        const value = JSON.parse(line);
        if (!value || typeof value !== 'object' || Array.isArray(value) || typeof value.type !== 'string') { jsonLinesOnly = false; break; }
        jsonEvents.push(value);
      } catch (_) { jsonLinesOnly = false; break; }
    }
    if (jsonLinesOnly && jsonEvents.length) return jsonEvents.map(normalize);

    const rows = parseCsv(source);
    if (rows.length < 2) throw new Error('Could not recognize this file. Expected event JSON, JSONL, NDJSON, or CSV with a header and rows.');
    const headers = rows[0].map(h => h.trim());
    const lower = headers.map(h => h.toLowerCase());
    const objects = rows.slice(1).map(row => Object.fromEntries(headers.map((header, i) => [header, row[i] ?? ''])));
    const find = (...names) => names.map(name => lower.indexOf(name)).find(i => i >= 0) ?? -1;
    const typeCol = find('type', 'event_type');
    if (typeCol >= 0) {
      const get = (row, names) => { const col = names.map(name => lower.indexOf(name)).find(index => index >= 0); return col === undefined ? undefined : row[headers[col]]; };
      return objects.map((row, i) => {
        const data = {};
        for (const [key, value] of Object.entries(row)) {
          if (!['type', 'event_type', 'ts', 'timestamp', 'time', 'run_id', 'run_name', 'event_id', 'id', 'step'].includes(key.toLowerCase())) data[key] = value;
        }
        const rawData = get(row, ['data']);
        if (typeof rawData === 'string' && rawData.trim()) { try { Object.assign(data, JSON.parse(rawData)); } catch (_) {} }
        return { ...base, event_id: get(row, ['event_id', 'id']) || ('import-' + i), type: get(row, ['type', 'event_type']), ts: asNumber(get(row, ['ts', 'timestamp', 'time'])) ?? now + i / 1000, run_id: get(row, ['run_id']) || base.run_id, run_name: get(row, ['run_name']) || filename, step: asNumber(get(row, ['step'])) ?? undefined, data };
      });
    }

    const nameCol = find('name', 'tag', 'metric'), valueCol = find('value'), stepCol = find('step'), epochCol = find('epoch');
    const tsCol = find('wall time', 'wall_time', 'timestamp', 'time'), splitCol = find('split', 'phase');
    const events = [];
    if (nameCol >= 0 && valueCol >= 0) {
      objects.forEach((row, i) => {
        const name = row[headers[nameCol]], value = asNumber(row[headers[valueCol]]);
        if (!name || value === null) return;
        const split = splitCol >= 0 ? splitFor(name, { split: row[headers[splitCol]] }) : splitFor(name, {});
        const data = { name, value, split };
        if (stepCol >= 0 && asNumber(row[headers[stepCol]]) !== null) data.step = asNumber(row[headers[stepCol]]);
        if (epochCol >= 0 && asNumber(row[headers[epochCol]]) !== null) data.epoch = asNumber(row[headers[epochCol]]);
        const ts = tsCol >= 0 ? asNumber(row[headers[tsCol]]) : null;
        events.push({ ...base, event_id: 'import-' + i, type: 'metric', ts: ts === null ? now + i / 1000 : ts, step: data.step, data });
      });
    } else {
      const xCol = stepCol >= 0 ? stepCol : epochCol;
      for (let i = 0; i < objects.length; i++) {
        const row = objects[i];
        for (let j = 0; j < headers.length; j++) {
          const key = headers[j], value = asNumber(row[key]);
          if (value === null || SPECIAL_COLUMNS.has(lower[j]) || j === xCol || j === tsCol) continue;
          const data = { name: key, value, split: splitFor(key, row) };
          if (stepCol >= 0 && asNumber(row[headers[stepCol]]) !== null) data.step = asNumber(row[headers[stepCol]]);
          if (epochCol >= 0 && asNumber(row[headers[epochCol]]) !== null) data.epoch = asNumber(row[headers[epochCol]]);
          const ts = tsCol >= 0 ? asNumber(row[headers[tsCol]]) : null;
          events.push({ ...base, event_id: 'import-' + i + '-' + j, type: 'metric', ts: ts === null ? now + i / 1000 : ts, step: data.step, data });
        }
      }
    }
    if (!events.length) throw new Error('No usable events or numeric metrics were found in this file');
    return events;
  }
  return { parseCsv, parseImportedText };
});
