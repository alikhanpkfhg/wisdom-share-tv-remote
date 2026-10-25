// The bridge: static web UI + validated REST API → TV protocol client.
// No shell execution, no dynamic URLs from unvalidated input, optional shared
// token (BRIDGE_TOKEN env), binds to the LAN by default and never needs to be
// exposed to the internet.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverServices } from './discovery.js';
import { TvClient } from './tv-client.js';
import { REMOTE_EVENT } from './proto.js';
import { parseKeyCode, sanitizeText, parseHost, parsePort, isValidPackageName } from './validate.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_DIR = path.join(__dirname, '..', 'web');
const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '0.0.0.0';
const TOKEN = process.env.BRIDGE_TOKEN || '';

const tv = new TvClient();
const state = { device: null, lastResponse: null, lastError: null, lastScan: [] };

tv.on('response', (body) => {
  state.lastResponse = { at: new Date().toISOString(), body };
});
tv.on('closed', (info) => {
  state.lastError = `TV websocket closed (code ${info.code ?? 'n/a'})`;
});
tv.on('error', (err) => {
  state.lastError = String((err && err.message) || err);
});

function json(res, code, obj) {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > 10240) {
        reject(new Error('request body too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new Error('invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function authorized(req) {
  if (!TOKEN) return true;
  return req.headers.authorization === `Bearer ${TOKEN}`;
}

async function handleApi(req, res, url) {
  if (!authorized(req)) return json(res, 401, { error: 'bridge token required' });
  const p = url.pathname;
  try {
    if (req.method === 'GET' && p === '/api/status') {
      return json(res, 200, {
        ok: true,
        connected: tv.connected,
        reconnecting: tv.wantConnected && !tv.connected,
        device: state.device,
        lastResponse: state.lastResponse,
        lastError: state.lastError,
      });
    }

    if (req.method === 'GET' && p === '/api/discover') {
      const devices = await discoverServices({ timeoutMs: 4500 });
      state.lastScan = devices;
      return json(res, 200, { ok: true, devices });
    }

    if (req.method === 'POST' && p === '/api/connect') {
      const body = await readJson(req);
      const ip = parseHost(body.ip);
      if (!ip) return json(res, 400, { error: 'invalid TV IP address' });
      const candidates = [];
      if (body.port !== undefined && body.port !== null && body.port !== '') {
        const port = parsePort(body.port);
        if (!port) return json(res, 400, { error: 'invalid port' });
        candidates.push(port);
      } else {
        const d = state.lastScan.find((x) => x.ip === ip);
        if (d) {
          for (const q of [d.websocketPort, d.port]) {
            const v = parsePort(q);
            if (v && !candidates.includes(v)) candidates.push(v);
          }
        }
        if (!candidates.length) {
          return json(res, 400, { error: 'no port known for this IP — scan first or enter the port' });
        }
      }
      tv.stop();
      const errors = [];
      for (const port of candidates) {
        try {
          await tv.connect(ip, port, { timeoutMs: 5000 });
          tv.wantConnected = true; // enable auto-reconnect only after success
          const d = state.lastScan.find((x) => x.ip === ip);
          state.device = { ip, port, name: (d && d.name) || null, httpPort: (d && d.httpPort) || null };
          state.lastError = null;
          return json(res, 200, { ok: true, device: state.device });
        } catch (e) {
          errors.push(`port ${port}: ${e.message}`);
        }
      }
      return json(res, 502, { ok: false, error: 'could not reach the TV', detail: errors });
    }

    if (req.method === 'POST' && p === '/api/disconnect') {
      tv.stop();
      state.device = null;
      return json(res, 200, { ok: true });
    }

    if (!tv.connected) return json(res, 409, { ok: false, error: 'not connected to a TV' });

    if (req.method === 'POST' && p === '/api/key') {
      const body = await readJson(req);
      const code = parseKeyCode(body.code);
      if (code === null) return json(res, 400, { error: 'unsupported key code' });
      tv.send(REMOTE_EVENT.KEY_EVENT, { action: String(code) });
      return json(res, 200, { ok: true, code, confirmed: parseKeyCode(code) !== null });
    }

    if (req.method === 'POST' && p === '/api/text') {
      const body = await readJson(req);
      const text = sanitizeText(body.text);
      if (!text.trim()) return json(res, 400, { error: 'empty or invalid text' });
      tv.send(REMOTE_EVENT.KEYBOARD_INPUT_EVENT, { action: text });
      return json(res, 200, { ok: true, length: text.length });
    }

    if (req.method === 'POST' && p === '/api/mouse') {
      tv.send(REMOTE_EVENT.MOUSE_CLICK_EVENT);
      return json(res, 200, { ok: true });
    }

    if (req.method === 'POST' && p === '/api/app/open') {
      const body = await readJson(req);
      const pkg = isValidPackageName(body.package) ? body.package : null;
      if (!pkg) return json(res, 400, { error: 'invalid Android package name (e.g. com.google.android.youtube)' });
      const dev = state.device;
      const httpPort = dev ? parsePort(dev.httpPort) : null;
      if (!dev || !httpPort) return json(res, 409, { ok: false, error: 'TV http_port unknown — run discovery first' });
      // Endpoint evidenced in the original app (POST /app/open); body shape
      // UNKNOWN — forwarded as-is and reported back for testing.
      const r = await fetch(`http://${dev.ip}:${httpPort}/app/open`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ packageName: pkg }),
      });
      const text = await r.text();
      return json(res, 200, { ok: r.ok, status: r.status, body: text.slice(0, 500) });
    }

    if (req.method === 'POST' && p === '/api/voice-text') {
      return json(res, 501, { error: 'voice passthrough pending: GOOGLE_VOICE_FINISH ordinal not yet confirmed' });
    }

    return json(res, 404, { error: 'unknown API endpoint' });
  } catch (e) {
    return json(res, 500, { error: e.message || 'internal error' });
  }
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function serveStatic(res, url) {
  const rel = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
  const file = path.normalize(path.join(WEB_DIR, rel));
  if (!file.startsWith(WEB_DIR + path.sep)) {
    res.writeHead(403, { 'content-type': 'text/plain' });
    return res.end('forbidden');
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      return res.end('not found');
    }
    res.writeHead(200, {
      'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-cache',
    });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://bridge.local');
  if (url.pathname.startsWith('/api/')) {
    handleApi(req, res, url);
    return;
  }
  if (req.method !== 'GET') {
    res.writeHead(405, { 'content-type': 'text/plain' });
    res.end('method not allowed');
    return;
  }
  serveStatic(res, url);
});

server.listen(PORT, HOST, () => {
  console.log(`Wisdom Share bridge listening on http://${HOST}:${PORT}`);
  console.log(`Open http://<this-machine-ip>:${PORT} on your phone (same Wi-Fi as the TV).`);
  if (TOKEN) console.log('Bridge token auth: enabled.');
});