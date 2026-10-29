const { app, BrowserWindow, dialog } = require('electron');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');
const { pathToFileURL } = require('url');
const { EventStore, sanitizeEvent } = require('./event-store');
const { isTrustedLocalOrigin } = require('./security');
const { readJsonBody } = require('./request-body');
const { normalizeEvent } = require('./event-schema');

const HOST = '127.0.0.1';
const PORT = 7337;
const events = [];
let windowRef;
let wss;
let eventStore;
let quitAfterFlush = false;

function sendEvent(event) {
  events.push(sanitizeEvent(event));
  if (events.length > 3000) events.shift();
  if (eventStore) eventStore.append(event, events);
  if (wss) for (const client of wss.clients) if (client.readyState === 1) client.send(JSON.stringify({ kind: 'event', event }));
}

function startServer() {
  const historyPath = path.join(app.getPath('userData'), 'events.jsonl');
  eventStore = new EventStore(historyPath, 3000);
  try {
    events.push(...eventStore.load());
    console.log(`Restored ${events.length} events from local history`);
  } catch (error) {
    console.error('Experiment Lens could not load local history:', error.message);
  }
  const server = http.createServer((req, res) => {
    const origin = req.headers.origin;
    if (!isTrustedLocalOrigin(origin)) { res.writeHead(403, { 'Content-Type': 'application/json' }); return res.end('{\"error\":\"Cross-origin requests are not allowed\"}'); }
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
    if (req.method === 'GET' && req.url === '/health') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ ok: true, events: events.length })); }
    if (req.method === 'GET' && req.url === '/events') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify(events)); }
    if (req.method === 'POST' && req.url === '/events') {
      readJsonBody(req).then(event => {
        if (!event || typeof event !== 'object' || Array.isArray(event)) {
          const error = new Error('Request body must be a JSON object');
          error.statusCode = 400;
          throw error;
        }
        if (typeof event.type !== 'string' || !event.type.trim()) {
          const error = new Error('event.type must be a non-empty string');
          error.statusCode = 400;
          throw error;
        }
        const normalized = normalizeEvent(event);
        sendEvent(normalized);
        res.writeHead(202, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
      }).catch(error => {
        if (res.headersSent || res.destroyed) return;
        const statusCode = error.statusCode || 400;
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
      });
      return;
    }
    res.writeHead(404); res.end('Not found');
  });
  wss = new WebSocketServer({ noServer: true });
  server.on('upgrade', (req, socket, head) => {
    const origin = req.headers.origin;
    if (!isTrustedLocalOrigin(origin) || req.url !== '/stream') return socket.destroy();
    wss.handleUpgrade(req, socket, head, ws => {
      wss.emit('connection', ws, req);
      ws.send(JSON.stringify({ kind: 'snapshot', events }));
    });
  });
  server.listen(PORT, HOST, () => console.log(`Experiment Lens event server listening on http://${HOST}:${PORT}`));
  server.on('error', err => {
    console.error('Experiment Lens server error:', err.message);
    if (err.code === 'EADDRINUSE') {
      dialog.showErrorBox(
        'Experiment Lens cannot start its local service',
        'Port 7337 is already in use. Close the other application using this port, then restart Experiment Lens.'
      );
      app.quit();
    }
  });
}

function createWindow() {
  windowRef = new BrowserWindow({ width: 1440, height: 920, minWidth: 980, minHeight: 680, backgroundColor: '#080b12', title: 'Viziverse', webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true } });
  const dashboardUrl = pathToFileURL(path.join(__dirname, 'index.html')).href;
  windowRef.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  windowRef.webContents.on('will-navigate', (event, url) => {
    if (url !== dashboardUrl) event.preventDefault();
  });
  windowRef.loadURL(dashboardUrl);
}

app.whenReady().then(() => { startServer(); createWindow(); app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); }); });
app.on('before-quit', event => {
  if (quitAfterFlush || !eventStore) return;
  event.preventDefault();
  quitAfterFlush = true;
  eventStore.flush().finally(() => app.quit());
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
