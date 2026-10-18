'use strict';
const $ = id => document.getElementById(id);
const MAX_EVENTS = 3000;
let allEvents = [];
let runs = new Map();
let points = [];
let lastImage = null;
let selectedRunId = null;
let replayEvents = [];
let replayIndex = 0;
let replayTimer = null;
let connected = false;

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
function eventTime(e) {
  const raw = Number(e.ts);
  return Number.isFinite(raw) && raw > 0 ? new Date(raw < 1e12 ? raw * 1000 : raw) : null;
}
function runId(e) { return String(e.run_id || e.session_id || 'unassigned'); }
function summarizeRun(id, events) {
  const first = events[0] || {};
  const last = events[events.length - 1] || {};
  let status = 'running';
  for (const e of events) {
    if (e.type === 'run_end' || e.type === 'agent_turn_end' || e.type === 'SessionEnd') {
      const s = String(e.data?.status || e.data?.reason || 'completed').toLowerCase();
      status = /fail|error|crash/.test(s) ? 'failed' : 'completed';
    }
    if (e.type === 'run_start' || e.type === 'SessionStart') status = 'running';
  }
  return {id, name:first.run_name || first.data?.cwd || id, events, status, firstTs:first.ts, lastTs:last.ts};
}
function rebuildRuns() {
  const grouped = new Map();
  for (const e of allEvents) {
    const id = runId(e);
    if (!grouped.has(id)) grouped.set(id, []);
    grouped.get(id).push(e);
  }
  runs = new Map([...grouped.entries()].map(([id, events]) => [id, summarizeRun(id, events)]));
}
function ingest(e, shouldRender = true) {
  if (!e || typeof e.type !== 'string') return;
  const historyEvent = JSON.parse(JSON.stringify(e));
  if (historyEvent.data && typeof historyEvent.data === 'object' && typeof historyEvent.data.data_url === 'string') {
    delete historyEvent.data.data_url;
    historyEvent.data.payload_omitted = true;
  }
  allEvents.push(historyEvent);
  if (allEvents.length > MAX_EVENTS) allEvents.shift();
  if (e.type === 'trajectory' && Array.isArray(e.data?.points)) {
    points = e.data.points.map(p => Array.isArray(p) ? p : [p.x ?? 0, p.y ?? 0]);
  }
  if (e.type === 'image' && e.data?.data_url) lastImage = e.data;
  else if (e.type === 'image' && e.data?.payload_omitted) lastImage = { name: e.data.name || 'Image artifact', payload_omitted: true };
  if (shouldRender) { rebuildRuns(); render(); }
}
function render() {
  $('eventCount').textContent = allEvents.length.toLocaleString();
  $('runCount').textContent = [...runs.values()].filter(r => r.status === 'running').length;
  $('agentCount').textContent = allEvents.filter(e => String(e.type).startsWith('agent_') || e.data?.source === 'claude-code').length;
  $('lastEvent').textContent = allEvents.length ? allEvents[allEvents.length - 1].type : '—';
  const query = ($('eventSearch')?.value || '').toLowerCase().trim();
  const visible = allEvents.filter(e => !query || JSON.stringify(e).toLowerCase().includes(query)).slice(-150).reverse();
  $('events').innerHTML = visible.map(e => {
    const dt = eventTime(e);
    return '<div class="event"><span class="time">' + esc(dt ? dt.toLocaleTimeString() : 'time n/a') + '</span> <span class="kind">' + esc(e.type) + '</span> <span style="color:#aebbd1">' + esc(e.run_name || runId(e)) + '</span><br><span style="color:#7f8ba1">' + esc(JSON.stringify(e.data || {}).slice(0,240)) + '</span></div>';
  }).join('') || '<div class="empty">No events match this filter.</div>';
  const runQuery = ($('runSearch')?.value || '').toLowerCase().trim();
  const visibleRuns = [...runs.values()].reverse().filter(r => (r.name + ' ' + r.id + ' ' + r.status).toLowerCase().includes(runQuery));
  $('historyCount').textContent = runs.size + ' runs';
  $('runHistory').innerHTML = visibleRuns.map(r => {
    const dt = eventTime({ts:r.lastTs});
    const dot = r.status === 'failed' ? 'failed' : r.status === 'running' ? 'running' : '';
    return '<button class="run-item ' + (r.id === selectedRunId ? 'selected' : '') + '" data-run-id="' + esc(r.id) + '"><div class="run-title"><span class="status-dot ' + dot + '"></span>' + esc(r.name) + '</div><div class="run-meta">' + esc(r.status) + ' · ' + r.events.length + ' events<br>' + esc(dt ? dt.toLocaleString() : 'timestamp unavailable') + '</div></button>';
  }).join('') || '<div class="empty">No matching runs.</div>';
  $('runHistory').querySelectorAll('[data-run-id]').forEach(btn => btn.addEventListener('click', () => selectRun(btn.dataset.runId)));
  $('runDetails').innerHTML = [...runs.values()].reverse().slice(0,8).map(r =>
    '<div style="padding:9px 0;border-bottom:1px solid #202738"><div style="color:#dce5f6">' + esc(r.name) + '</div><div class="sub">' + esc(r.id) + ' · ' + esc(r.status) + ' · ' + r.events.length + ' events</div></div>'
  ).join('') || 'No runs detected yet.';
  const agentEvents = allEvents.filter(e => String(e.type).startsWith('agent_') || e.data?.source === 'claude-code').slice(-8).reverse();
  $('agentActivity').innerHTML = agentEvents.map(e => {
    const d=e.data||{}, label=d.tool_name ? d.tool_name + ' · ' + e.type : e.type;
    const detail=[d.hook,d.notification_type,d.status].filter(Boolean).join(' · ');
    return '<div class="agent-row"><div class="agent-name">' + esc(label) + '</div><div class="sub">' + esc(e.run_name || d.cwd || 'Agent') + (detail ? ' · ' + esc(detail) : '') + '</div></div>';
  }).join('') || 'No agent events yet. Connect Claude Code to see tool activity.';
  if (lastImage) { if (lastImage.data_url) $('preview').src = lastImage.data_url; $('imageName').textContent = lastImage.payload_omitted ? (lastImage.name + ' · image data not stored in history') : (lastImage.name || 'Image artifact'); }
  drawTrajectory();
  if (selectedRunId && runs.has(selectedRunId)) {
    const latest = runs.get(selectedRunId);
    replayEvents = latest.events;
    updateReplay();
  }
}
function selectRun(id) {
  stopReplay();
  selectedRunId = id;
  replayEvents = runs.get(id)?.events || [];
  replayIndex = 0;
  render();
  updateReplay();
}
function updateReplay() {
  const has = replayEvents.length > 0;
  $('replayTitle').textContent = runs.get(selectedRunId)?.name || 'Select a run to inspect';
  $('replayStatus').textContent = has ? (runs.get(selectedRunId)?.status || 'RUN') .toUpperCase() : 'IDLE';
  $('replayRange').disabled = !has;
  $('replayRange').max = String(Math.max(0, replayEvents.length - 1));
  $('replayRange').value = String(Math.min(replayIndex, Math.max(0,replayEvents.length-1)));
  $('replayPrev').disabled = !has || replayIndex <= 0;
  $('replayNext').disabled = !has || replayIndex >= replayEvents.length - 1;
  $('replayToggle').disabled = !has;
  if (!has) {
    $('replayEvent').innerHTML = '<div class="empty">Select a run to replay its recorded events.</div>';
    $('replayPosition').textContent = 'No events'; $('replayTime').textContent = '—'; return;
  }
  const e = replayEvents[replayIndex];
  const dt = eventTime(e);
  $('replayEvent').innerHTML = '<div class="kind">' + esc(e.type) + '</div><div class="sub" style="margin:5px 0 12px">' + esc(dt ? dt.toLocaleString() : 'timestamp unavailable') + ' · ' + esc(runId(e)) + '</div><pre style="white-space:pre-wrap;font:12px/1.5 ui-monospace,Consolas,monospace;margin:0">' + esc(JSON.stringify(e.data || {},null,2)) + '</pre>';
  $('replayPosition').textContent = 'Event ' + (replayIndex+1) + ' of ' + replayEvents.length;
  $('replayTime').textContent = dt ? dt.toLocaleTimeString() : '—';
  $('replayPrev').disabled = replayIndex <= 0;
  $('replayNext').disabled = replayIndex >= replayEvents.length-1;
}
function stepReplay(delta) {
  replayIndex = Math.max(0, Math.min(replayEvents.length-1, replayIndex+delta));
  updateReplay();
  if (replayIndex >= replayEvents.length-1) stopReplay();
}
function stopReplay() {
  if (replayTimer) clearInterval(replayTimer);
  replayTimer = null;
  if ($('replayToggle')) $('replayToggle').textContent = '▶ Play';
}
function toggleReplay() {
  if (replayTimer) { stopReplay(); return; }
  if (!replayEvents.length) return;
  if (replayIndex >= replayEvents.length-1) replayIndex = 0;
  $('replayToggle').textContent = 'Ⅱ Pause';
  replayTimer = setInterval(() => {
    if (replayIndex >= replayEvents.length-1) { stopReplay(); return; }
    stepReplay(1);
  }, 900);
  updateReplay();
  $('replayToggle').textContent = 'Ⅱ Pause';
}
function drawTrajectory() {
  const c=$('trajectory'), ctx=c.getContext('2d'), w=c.clientWidth, h=c.clientHeight, dpr=window.devicePixelRatio||1;
  c.width=Math.max(1,w*dpr); c.height=Math.max(1,h*dpr); ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,w,h);
  ctx.strokeStyle='#1e293b';ctx.lineWidth=1;
  for(let x=20;x<w;x+=30){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}
  for(let y=20;y<h;y+=30){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
  if(!points.length)return;
  const xs=points.map(p=>Number(p[0])||0),ys=points.map(p=>Number(p[1])||0),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys),pad=28;
  const px=x=>pad+(x-minX)/(maxX-minX||1)*(w-2*pad),py=y=>h-pad-(y-minY)/(maxY-minY||1)*(h-2*pad);
  ctx.strokeStyle='#9aa9ff';ctx.lineWidth=2.5;ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(px(Number(p[0])||0),py(Number(p[1])||0)):ctx.moveTo(px(Number(p[0])||0),py(Number(p[1])||0)));ctx.stroke();
  points.forEach((p,i)=>{ctx.fillStyle=i===points.length-1?'#60e0b0':'#a8b4ff';ctx.beginPath();ctx.arc(px(Number(p[0])||0),py(Number(p[1])||0),i===points.length-1?5:3,0,Math.PI*2);ctx.fill();});
  $('trajectoryCount').textContent=points.length+' points';
}
function exportHistory() {
  const payload = JSON.stringify({ exported_at: new Date().toISOString(), event_count: allEvents.length, events: allEvents }, null, 2);
  const blob = new Blob([payload], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'experiment-lens-history-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function connect() {
  const ws=new WebSocket('ws://127.0.0.1:7337/stream');
  ws.onopen=()=>{$('connection').textContent='● Connected';$('connection').style.color='#58d6a2';connected=true;};
  ws.onclose=()=>{$('connection').textContent='● Reconnecting';$('connection').style.color='#ffc879';connected=false;setTimeout(connect,1500);};
  ws.onerror=()=>ws.close();
  ws.onmessage=msg=>{
    try {
      const data=JSON.parse(msg.data);
      if(data.kind==='snapshot') {
        allEvents=[];runs.clear();points=[];lastImage=null;
        data.events.forEach(e=>ingest(e,false)); rebuildRuns(); render();
        if(selectedRunId && runs.has(selectedRunId)) selectRun(selectedRunId);
      } else if(data.kind==='event') { ingest(data.event); }
    } catch(err) { console.error('Experiment Lens could not process an event:',err); }
  };
}
$('eventSearch').addEventListener('input',render);
$('exportEvents').addEventListener('click',exportHistory);
$('runSearch').addEventListener('input',render);
$('replayPrev').addEventListener('click',()=>stepReplay(-1));
$('replayNext').addEventListener('click',()=>stepReplay(1));
$('replayToggle').addEventListener('click',toggleReplay);
$('replayRange').addEventListener('input',()=>{replayIndex=Number($('replayRange').value)||0;updateReplay();});
window.addEventListener('resize',drawTrajectory);
$('preview').src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="220"><rect width="100%" height="100%" fill="#090e17"/><text x="50%" y="50%" fill="#536079" text-anchor="middle" font-family="sans-serif" font-size="13">No image event yet</text></svg>');
render();connect();
