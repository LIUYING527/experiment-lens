const { app, BrowserWindow } = require('electron');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');
const { EventStore } = require('./event-store');

const HOST = '127.0.0.1';
const PORT = 7337;
const events = [];
let windowRef;
let wss;
let eventStore;

function sendEvent(event) {
  events.push(event);
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
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
    if (req.method === 'GET' && req.url === '/health') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ ok: true, events: events.length })); }
    if (req.method === 'GET' && req.url === '/events') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify(events)); }
    if (req.method === 'POST' && req.url === '/events') {
      let body = '';
      req.on('data', chunk => { body += chunk; if (body.length > 20 * 1024 * 1024) req.destroy(); });
      req.on('end', () => {
        try { const event = JSON.parse(body); if (!event.type) throw new Error('event.type is required'); sendEvent(event); res.writeHead(202, { 'Content-Type': 'application/json' }); res.end('{"ok":true}'); }
        catch (error) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: error.message })); }
      });
      return;
    }
    res.writeHead(404); res.end('Not found');
  });
  wss = new WebSocketServer({ noServer: true });
  server.on('upgrade', (req, socket, head) => {
    if (req.url !== '/stream') return socket.destroy();
    wss.handleUpgrade(req, socket, head, ws => {
      wss.emit('connection', ws, req);
      ws.send(JSON.stringify({ kind: 'snapshot', events }));
    });
  });
  server.listen(PORT, HOST, () => console.log(`Experiment Lens event server listening on http://${HOST}:${PORT}`));
  server.on('error', err => console.error('Experiment Lens server error:', err.message));
}

function createWindow() {
  windowRef = new BrowserWindow({ width: 1440, height: 920, minWidth: 980, minHeight: 680, backgroundColor: '#080b12', title: 'Experiment Lens', webPreferences: { contextIsolation: true, nodeIntegration: false } });
  windowRef.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(() => { startServer(); createWindow(); app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); }); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
