// Web remote logic. All TV communication goes through the bridge's validated
// REST API; nothing here speaks the TV protocol directly.

const $ = (id) => document.getElementById(id);
let token = localStorage.getItem('bridgeToken') || '';
let statusTimer = null;

function toast(msg, isErr) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.toggle('error', !!isErr);
  t.classList.remove('hidden');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.add('hidden'), 2800);
}

async function api(path, body) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = 'Bearer ' + token;
  const res = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 401) {
    $('tokenInput').classList.remove('hidden');
    throw new Error('Bridge token required');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'HTTP ' + res.status);
  return data;
}

function setStatus(mode, text) {
  const pill = $('statusPill');
  pill.classList.remove('online', 'offline', 'busy');
  pill.classList.add(mode);
  $('statusText').textContent = text;
}

async function pollStatus() {
  let st;
  try {
    st = await api('/api/status');
  } catch (e) {
    setStatus('offline', 'Bridge unreachable');
    return;
  }
  if (st.connected) {
    setStatus('online', st.device && st.device.name ? st.device.name : 'Connected');
    $('connectPanel').classList.add('hidden');
    $('remotePanel').classList.remove('hidden');
  } else {
    setStatus(st.reconnecting ? 'busy' : 'offline', st.reconnecting ? 'Reconnecting…' : 'Offline');
    $('remotePanel').classList.add('hidden');
    $('connectPanel').classList.remove('hidden');
  }
}

function startPolling() {
  clearInterval(statusTimer);
  pollStatus();
  statusTimer = setInterval(pollStatus, 2500);
}

async function scan() {
  const btn = $('scanBtn');
  btn.disabled = true;
  btn.textContent = 'Scanning…';
  $('deviceList').innerHTML = '';
  try {
    const { devices } = await api('/api/discover');
    if (!devices.length) {
      $('deviceList').innerHTML =
        '<p class="hint">No TVs found. Enter the IP manually — you can read it in the official app\'s device info, or run <code>dns-sd -B _share._tcp</code> on a Mac.</p>';
    }
    devices.forEach((d) => {
      const b = document.createElement('button');
      b.className = 'dev';
      const portHint = d.websocketPort || d.port;
      b.textContent = `${d.name || 'TV'} — ${d.ip}` + (portHint ? ` :${portHint}` : '');
      b.onclick = () => {
        $('ipInput').value = d.ip;
        $('portInput').value = d.websocketPort || d.port || '';
        document.querySelectorAll('.dev').forEach((x) => x.classList.remove('sel'));
        b.classList.add('sel');
      };
      $('deviceList').appendChild(b);
    });
  } catch (e) {
    toast(e.message, true);
  }
  btn.disabled = false;
  btn.textContent = 'Scan for TVs';
}

async function connect() {
  const ip = $('ipInput').value.trim();
  const port = $('portInput').value.trim();
  setStatus('busy', 'Connecting…');
  try {
    const st = await api('/api/connect', { ip, port: port ? Number(port) : undefined });
    if (st.ok) {
      toast('Connected to TV');
      pollStatus();
    } else {
      setStatus('offline', 'Offline');
      toast(st.error + (st.detail ? ' — ' + st.detail.join('; ') : ''), true);
    }
  } catch (e) {
    setStatus('offline', 'Offline');
    toast(e.message, true);
  }
}

// Buttons: single-tap for fixed keys, hold-to-repeat for D-pad and volume.
function bindKeys() {
  document.querySelectorAll('[data-code]').forEach((btn) => {
    const code = Number(btn.dataset.code);
    const send = () =>
      api('/api/key', { code }).catch((e) => toast(e.message, true));
    let t1 = null;
    let t2 = null;
    if (btn.dataset.repeat !== undefined) {
      btn.addEventListener('pointerdown', (ev) => {
        ev.preventDefault();
        send();
        t1 = setTimeout(() => {
          t2 = setInterval(send, 160);
        }, 420);
      });
      const stop = () => {
        clearTimeout(t1);
        clearInterval(t2);
        t1 = t2 = null;
      };
      btn.addEventListener('pointerup', stop);
      btn.addEventListener('pointercancel', stop);
      btn.addEventListener('pointerleave', stop);
    } else {
      btn.addEventListener('click', send);
    }
  });
}

function bindChrome() {
  $('scanBtn').onclick = scan;
  $('connectBtn').onclick = connect;
  $('disconnectBtn').onclick = async () => {
    try {
      await api('/api/disconnect', {});
      toast('Disconnected');
    } catch (e) {
      toast(e.message, true);
    }
    pollStatus();
  };
  $('kbdBtn').onclick = () => {
    $('kbdSheet').classList.remove('hidden');
    $('kbdText').focus();
  };
  $('kbdClose').onclick = () => $('kbdSheet').classList.add('hidden');
  $('kbdSend').onclick = async () => {
    const text = $('kbdText').value;
    if (!text.trim()) return;
    try {
      await api('/api/text', { text });
      $('kbdText').value = '';
      toast('Text sent to TV');
    } catch (e) {
      toast(e.message, true);
    }
  };
  $('tokenInput').addEventListener('change', (ev) => {
    token = ev.target.value.trim();
    localStorage.setItem('bridgeToken', token);
    pollStatus();
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) pollStatus();
  });
}

function init() {
  if (token) $('tokenInput').value = token;
  bindKeys();
  bindChrome();
  startPolling();
  // Voice phase (opt-in, browser speech recognition). Set up only if supported.
  if (typeof setupVoice === 'function') {
    const ok = setupVoice({
      sendKey: (code) => api('/api/key', { code }).catch((e) => toast(e.message, true)),
      api,
      toast,
      confirmFn: (msg) => window.confirm(msg),
    });
    if (!ok) $('voiceBtn').classList.add('hidden');
  }
}

init();