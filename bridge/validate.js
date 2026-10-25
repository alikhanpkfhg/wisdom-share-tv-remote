// Whitelists and strict input parsing. Every bridge API parameter passes through
// one of these functions before it can reach the TV.

export const KEY_CODES = Object.freeze({
  3: 'HOME',
  4: 'BACK',
  19: 'DPAD_UP',
  20: 'DPAD_DOWN',
  21: 'DPAD_LEFT',
  22: 'DPAD_RIGHT',
  23: 'DPAD_CENTER_OK',
  24: 'VOLUME_UP',
  25: 'VOLUME_DOWN',
  26: 'POWER',
  82: 'MENU',
  85: 'MEDIA_PLAY_PAUSE',
  87: 'MEDIA_NEXT',
  88: 'MEDIA_PREVIOUS',
  126: 'MEDIA_PLAY',
  127: 'MEDIA_PAUSE',
  164: 'VOLUME_MUTE',
  178: 'INPUT_SOURCE',
});

// Codes seen on the original app's own button listeners (RemoteFragment lines
// 560–858). Everything else in KEY_CODES is EXPERIMENTAL (framework-standard
// codes the TV pipeline most likely accepts, but not yet proven).
export const CONFIRMED_KEY_CODES = new Set([3, 4, 19, 20, 21, 22, 23, 24, 25, 26, 82, 178]);

export function parseKeyCode(value) {
  if (typeof value === 'string' && value !== '' && /^\d+$/.test(value)) value = Number(value);
  if (typeof value !== 'number' || !Number.isInteger(value)) return null;
  return Object.prototype.hasOwnProperty.call(KEY_CODES, value) ? value : null;
}

// Keyboard passthrough text (KEYBOARD_INPUT_EVENT): strip C0 control characters,
// cap length at 500 like a sane input field.
export function sanitizeText(value) {
  if (typeof value !== 'string') return '';
  const cleaned = value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '');
  return cleaned.length > 500 ? cleaned.slice(0, 500) : cleaned;
}

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
export function parseHost(value) {
  const m = IPV4.exec(String(value || '').trim());
  if (!m) return null;
  const octets = m.slice(1).map(Number);
  if (octets.some((n) => n > 255)) return null;
  return octets.join('.');
}

export function parsePort(value) {
  let n = value;
  if (typeof n === 'string' && /^\d+$/.test(n)) n = Number(n);
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > 65535) return null;
  return n;
}

export function isValidPackageName(value) {
  return (
    typeof value === 'string' &&
    value.length <= 128 &&
    /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/.test(value)
  );
}