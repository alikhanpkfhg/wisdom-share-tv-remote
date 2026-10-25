// WebSocket client for the TV's control channel (ws://<ip>:<port>).
// Mirrors the original app's WebClient (e/i/b/e/g/h.java): RFC 6455, binary
// protobuf frames out, JSON ResultBody text frames in, reconnect on close.

import { EventEmitter } from 'node:events';
import { encodeMessage } from './proto.js';

export class TvClient extends EventEmitter {
  constructor() {
    super();
    this.ws = null;
    this.ip = null;
    this.port = null;
    this.wantConnected = false;
    this.attempts = 0;
    this._retryTimer = null;
  }

  get connected() {
    return !!this.ws && this.ws.readyState === 1;
  }

  // One connection attempt. Does NOT enable auto-reconnect; the caller sets
  // `wantConnected = true` after a successful connect (keeps candidate-port
  // probing in the bridge from spawning reconnect loops).
  connect(ip, port, { timeoutMs = 5000 } = {}) {
    if (typeof WebSocket === 'undefined') {
      return Promise.reject(new Error('Node.js 22+ is required (global WebSocket missing)'));
    }
    this.ip = ip;
    this.port = port;
    if (this.ws) {
      const old = this.ws;
      this.ws = null;
      try { old.close(); } catch { /* already dead */ }
    }
    const url = `ws://${ip}:${port}`;
    return new Promise((resolve, reject) => {
      let settled = false;
      let ws;
      try {
        ws = new WebSocket(url);
      } catch (err) {
        return reject(err);
      }
      ws.binaryType = 'arraybuffer';
      const timer = setTimeout(() => finish(new Error(`connect timeout to ${url}`)), timeoutMs);
      const finish = (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (err) {
          try { ws.close(); } catch { /* ignore */ }
          reject(err);
        } else {
          this.attempts = 0;
          this.ws = ws;
          this.emit('opened', { url });
          resolve();
        }
      };
      ws.addEventListener('open', () => finish(null));
      ws.addEventListener('message', (ev) => {
        const data = ev.data;
        if (typeof data === 'string') {
          // The TV answers with JSON ResultBody text frames (verified in the
          // original client's onMessage).
          let body = null;
          try { body = JSON.parse(data); } catch { /* not JSON */ }
          if (body) this.emit('response', body);
          else this.emit('text', data);
        } else {
          this.emit('binary', data);
        }
      });
      ws.addEventListener('close', (ev) => {
        this.ws = null;
        this.emit('closed', { code: ev.code, reason: ev.reason });
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(new Error(`connection closed (code ${ev.code})`));
        }
        if (this.wantConnected) this._scheduleReconnect();
      });
      ws.addEventListener('error', () => {
        this.emit('error', new Error('websocket error'));
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          try { ws.close(); } catch { /* ignore */ }
          reject(new Error('websocket error'));
        }
      });
    });
  }

  _scheduleReconnect() {
    if (!this.wantConnected || this._retryTimer || !this.ip) return;
    const delay = Math.min(15000, 1000 * 2 ** Math.min(this.attempts, 4));
    this.attempts += 1;
    this._retryTimer = setTimeout(() => {
      this._retryTimer = null;
      this.connect(this.ip, this.port).catch(() => { /* next backoff tick retries */ });
    }, delay);
  }

  send(type, { action = '', pointers = [], bytes = null, extra = null } = {}) {
    if (!this.connected) throw new Error('not connected to TV');
    this.ws.send(encodeMessage({ type, action, pointers, bytes, extra }));
  }

  stop() {
    this.wantConnected = false;
    if (this._retryTimer) {
      clearTimeout(this._retryTimer);
      this._retryTimer = null;
    }
    if (this.ws) {
      const w = this.ws;
      this.ws = null;
      try { w.close(); } catch { /* ignore */ }
    }
  }

  disconnect() {
    this.stop();
  }
}