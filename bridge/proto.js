// Binary command encoding for MessageProto.
// Recovered from com.stark.bytelloremote v6.4.1.0 (decompiled e/i/b/d.java, e/i/b/c.java).
// Wire rules (verified against the decompiled GeneratedMessageLite serializer):
//   field 1  varint   type     — omitted when 0 (RemoteEvent ordinal)
//   field 2  string   action   — omitted when "" (keycode as decimal string, text, …)
//   field 3  message  Pointer  — repeated; each is {1: float32 x, 2: float32 y} as
//                               little-endian fixed32, zero values omitted on the wire
//   field 4  bytes    payload  — omitted when empty (voice audio)
//   field 5  message  extra    — {1: int32} (purpose UNKNOWN in the app)

export const REMOTE_EVENT = Object.freeze({
  EVENT: 0,
  KEY_EVENT: 1,
  MOUSE_CLICK_EVENT: 4,
  KEYBOARD_INPUT_EVENT: 5,
  KEYBOARD_ACTION_EVENT: 8,
});

function varint(value) {
  const out = [];
  let v = value >>> 0;
  while (v > 0x7f) {
    out.push((v & 0x7f) | 0x80);
    v >>>= 7;
  }
  out.push(v);
  return Uint8Array.from(out);
}

function utf8(str) {
  return new TextEncoder().encode(str);
}

function f32bits(n) {
  const buf = new ArrayBuffer(4);
  new DataView(buf).setFloat32(0, n, true);
  return new Uint8Array(buf);
}

function concat(list) {
  let len = 0;
  for (const c of list) len += c.length;
  const out = new Uint8Array(len);
  let off = 0;
  for (const c of list) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}

export function encodeMessage({ type = 0, action = '', pointers = [], bytes = null, extra = null } = {}) {
  const parts = [];
  if (type !== 0) parts.push(Uint8Array.of(0x08), varint(type));
  if (action !== '' && action != null) {
    const a = utf8(String(action));
    parts.push(Uint8Array.of(0x12), varint(a.length), a);
  }
  for (const p of pointers || []) {
    const inner = [];
    const x = Number(p && p.x) || 0;
    const y = Number(p && p.y) || 0;
    if (x !== 0) inner.push(Uint8Array.of(0x0d), f32bits(x));
    if (y !== 0) inner.push(Uint8Array.of(0x15), f32bits(y));
    const body = concat(inner);
    parts.push(Uint8Array.of(0x1a), varint(body.length), body);
  }
  if (bytes && bytes.length) {
    const b = bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes);
    parts.push(Uint8Array.of(0x22), varint(b.length), b);
  }
  if (extra && extra.n) {
    const n = varint(extra.n);
    parts.push(Uint8Array.of(0x2a), varint(n.length), n);
  }
  return concat(parts);
}

// Helpers matching the exact call sites in the original app (RemoteViewModel.k,
// ControlWindow.d, e/i/b/h/d/i0.java).
export const keyEvent = (code) => encodeMessage({ type: REMOTE_EVENT.KEY_EVENT, action: String(code) });
export const mouseClick = () => encodeMessage({ type: REMOTE_EVENT.MOUSE_CLICK_EVENT });
export const keyboardInput = (text) => encodeMessage({ type: REMOTE_EVENT.KEYBOARD_INPUT_EVENT, action: text });
export const keyboardAction = (code) => encodeMessage({ type: REMOTE_EVENT.KEYBOARD_ACTION_EVENT, action: String(code) });