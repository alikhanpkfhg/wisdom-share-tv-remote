import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseKeyCode,
  sanitizeText,
  parseHost,
  parsePort,
  isValidPackageName,
  CONFIRMED_KEY_CODES,
} from '../bridge/validate.js';

test('keycode whitelist accepts numbers and numeric strings', () => {
  assert.equal(parseKeyCode(23), 23);
  assert.equal(parseKeyCode('24'), 24);
  assert.equal(parseKeyCode(178), 178);
});

test('keycode whitelist rejects unknown / malformed values', () => {
  assert.equal(parseKeyCode(999), null);
  assert.equal(parseKeyCode(-1), null);
  assert.equal(parseKeyCode('abc'), null);
  assert.equal(parseKeyCode(''), null);
  assert.equal(parseKeyCode(null), null);
  assert.equal(parseKeyCode(23.5), null);
  assert.equal(parseKeyCode('24; rm -rf /'), null);
});

test('confirmed vs experimental key sets are disjoint and sane', () => {
  for (const c of CONFIRMED_KEY_CODES) assert.notEqual(parseKeyCode(c), null);
  assert.ok(CONFIRMED_KEY_CODES.has(23));
  assert.ok(!CONFIRMED_KEY_CODES.has(164));
});

test('sanitizeText strips control characters and enforces the length cap', () => {
  assert.equal(sanitizeText('hi\u0000there\u001b'), 'hithere');
  assert.equal(sanitizeText(42), '');
  assert.equal(sanitizeText('a'.repeat(600)).length, 500);
  assert.equal(sanitizeText('hello world'), 'hello world');
});

test('parseHost accepts valid IPv4 and rejects everything else', () => {
  assert.equal(parseHost('192.168.1.23'), '192.168.1.23');
  assert.equal(parseHost(' 10.0.0.2 '), '10.0.0.2');
  assert.equal(parseHost('999.1.1.1'), null);
  assert.equal(parseHost('1.2.3'), null);
  assert.equal(parseHost('abc'), null);
  assert.equal(parseHost('1.2.3.4; curl evil'), null);
  assert.equal(parseHost('::1'), null);
});

test('parsePort bounds-checks ports', () => {
  assert.equal(parsePort(5353), 5353);
  assert.equal(parsePort('8000'), 8000);
  assert.equal(parsePort(0), null);
  assert.equal(parsePort(65536), null);
  assert.equal(parsePort('ws://x'), null);
});

test('package names must be real Android package identifiers', () => {
  assert.equal(isValidPackageName('com.google.android.youtube'), true);
  assert.equal(isValidPackageName('com.netflix.mediaclient'), true);
  assert.equal(isValidPackageName('youtube'), false);
  assert.equal(isValidPackageName('../etc/passwd'), false);
  assert.equal(isValidPackageName('com.example;ls'), false);
  assert.equal(isValidPackageName(42), false);
});