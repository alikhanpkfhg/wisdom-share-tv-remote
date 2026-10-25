// Pure-Node mDNS/DNS-SD browser for the TV's `_share._tcp` service.
// Mirrors SearchApi.java: browse `_share._tcp`, read SRV port + TXT attributes
// (device_mac, device_name, device_code, device_ip, http_port, websocket_port,
// screen_width/height, config).

import dgram from 'node:dgram';

const MDNS_ADDR = '224.0.0.251';
const MDNS_PORT = 5353;
const TYPE_PTR = 12;
const TYPE_TXT = 16;
const TYPE_SRV = 33;
const TYPE_A = 1;

function readName(buf, offset) {
  const labels = [];
  let jumped = false;
  let end = offset;
  let guard = 0;
  let pos = offset;
  while (guard++ < 128) {
    const len = buf[pos];
    if (len === 0) {
      if (!jumped) end = pos + 1;
      break;
    }
    if ((len & 0xc0) === 0xc0) {
      const ptr = ((len & 0x3f) << 8) | buf[pos + 1];
      if (!jumped) end = pos + 2;
      pos = ptr;
      jumped = true;
      continue;
    }
    labels.push(buf.toString('latin1', pos + 1, pos + 1 + len));
    pos += 1 + len;
  }
  return { name: labels.join('.'), end };
}

function parseTxt(rdata) {
  const entries = {};
  let off = 0;
  while (off < rdata.length) {
    const len = rdata[off];
    if (len === 0) break;
    const s = rdata.toString('utf8', off + 1, off + 1 + len);
    off += 1 + len;
    const eq = s.indexOf('=');
    if (eq > 0) entries[s.slice(0, eq)] = s.slice(eq + 1);
    else entries[s] = '';
  }
  return entries;
}

function handleRecord(name, type, rdata, records) {
  if (type === TYPE_PTR) {
    const instance = readName(rdata, 0).name;
    if (instance) records.instances.add(instance);
  } else if (type === TYPE_SRV) {
    if (rdata.length < 8) return;
    const port = rdata.readUInt16BE(6);
    const target = readName(rdata, 8).name;
    records.srv.set(name, { port, target });
  } else if (type === TYPE_TXT) {
    records.txt.set(name, parseTxt(rdata));
  } else if (type === TYPE_A && rdata.length === 4) {
    records.a.set(name.replace(/\.?local\.?$/i, ''), `${rdata[0]}.${rdata[1]}.${rdata[2]}.${rdata[3]}`);
  }
}

function parsePacket(buf, records) {
  if (buf.length < 12) return;
  const qd = buf.readUInt16BE(4);
  const total = buf.readUInt16BE(6) + buf.readUInt16BE(8) + buf.readUInt16BE(10);
  let off = 12;
  for (let i = 0; i < qd; i++) {
    const { end } = readName(buf, off);
    off = end + 4;
    if (off > buf.length) return;
  }
  for (let i = 0; i < total; i++) {
    const { name, end } = readName(buf, off);
    off = end;
    if (off + 10 > buf.length) return;
    const type = buf.readUInt16BE(off);
    const rdlen = buf.readUInt16BE(off + 8);
    off += 10;
    if (off + rdlen > buf.length) return;
    handleRecord(name, type, buf.subarray(off, off + rdlen), records);
    off += rdlen;
  }
}

function buildQuery(service) {
  const labels = service.split('.');
  const parts = [Buffer.alloc(12)];
  parts[0].writeUInt16BE(1, 4); // one question
  for (const label of labels) {
    const l = Buffer.from(label, 'latin1');
    parts.push(Buffer.of(l.length), l);
  }
  parts.push(Buffer.of(0), Buffer.from([0x00, TYPE_PTR, 0x00, 0x01])); // PTR, IN
  return Buffer.concat(parts);
}

function buildDevices(records) {
  const out = [];
  const seen = new Set();
  for (const [instance, srv] of records.srv) {
    const host = srv.target.replace(/\.?local\.?$/i, '');
    const txt = records.txt.get(instance) || {};
    const ip = records.a.get(host) || records.a.get(srv.target) || txt.device_ip || null;
    const key = `${ip}:${srv.port}`;
    if (!ip || seen.has(key)) continue;
    seen.add(key);
    out.push({
      name: txt.device_name || instance.split('.')[0] || host,
      ip,
      port: srv.port,
      httpPort: txt.http_port ? Number(txt.http_port) : null,
      websocketPort: txt.websocket_port ? Number(txt.websocket_port) : null,
      mac: txt.device_mac || null,
      deviceCode: txt.device_code || null,
      txt,
    });
  }
  return out;
}

export function discoverServices({ service = '_share._tcp.local', timeoutMs = 4000, interface_: undefinedInterface } = {}) {
  return new Promise((resolve) => {
    const records = { instances: new Set(), srv: new Map(), txt: new Map(), a: new Map() };
    const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    let closed = false;
    const finish = () => {
      if (closed) return;
      closed = true;
      clearTimeout(timer);
      try { socket.close(); } catch { /* not open */ }
      resolve(buildDevices(records));
    };
    const timer = setTimeout(finish, timeoutMs);

    socket.on('message', (msg) => {
      try { parsePacket(msg, records); } catch { /* tolerate malformed packets */ }
    });
    socket.on('error', () => { /* keep scanning; binding fallback below */ });

    const bind = (attempt) => {
      socket.once('error', () => {
        if (attempt === 0) {
          socket.removeAllListeners('error');
          socket.on('error', () => {});
          bind(1);
        } else {
          finish(); // multicast unavailable — report empty result
        }
      });
      socket.bind(attempt === 0 ? MDNS_PORT : 0, undefinedInterface || undefined, () => {
        try { socket.addMembership(MDNS_ADDR); } catch { /* single-interface hosts may throw */ }
        try { socket.setMulticastTTL(255); } catch { /* optional */ }
        const query = buildQuery(service);
        socket.send(query, MDNS_PORT, MDNS_ADDR, () => {});
        setTimeout(() => {
          if (!closed) socket.send(query, MDNS_PORT, MDNS_ADDR, () => {});
        }, 1200); // re-ask once for reliability
      });
    };
    bind(0);
  });
}