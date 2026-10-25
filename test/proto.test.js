// Golden-byte tests for the MessageProto encoder.
// Expected layouts are taken from the decompiled GeneratedMessageLite
// serializers (e/i/b/d.java, e/i/b/c.java) of com.stark.bytelloremote 6.4.1.0.

import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeMessage, keyEvent, mouseClick, keyboardInput, REMOTE_EVENT } from '../bridge/proto.js';

test('KEY_EVENT volume up (code 24) → 08 01 12 02 "24"', () => {
  assert.deepEqual(Buffer.from(keyEvent(24)), Buffer.from([0x08, 0x01, 0x12, 0x02, 0x32, 0x34]));
});

test('KEY_EVENT back (code 4) → 08 01 12 01 "4"', () => {
  assert.deepEqual(Buffer.from(keyEvent(4)), Buffer.from([0x08, 0x01, 0x12, 0x01, 0x34]));
});

test('MOUSE_CLICK_EVENT has no action field → 08 04', () => {
  assert.deepEqual(Buffer.from(mouseClick()), Buffer.from([0x08, 0x04]));
});

test('KEYBOARD_INPUT_EVENT "hi" → type 5 with text payload', () => {
  assert.deepEqual(Buffer.from(keyboardInput('hi')), Buffer.from([0x08, 0x05, 0x12, 0x02, 0x68, 0x69]));
});

test('default fields are omitted (type 0, no action) → empty frame', () => {
  assert.deepEqual(Buffer.from(encodeMessage({})), Buffer.alloc(0));
});

test('KEY_EVENT action is the decimal string, not the byte', () => {
  // code 178 must encode as three ASCII digits, like the app's String.valueOf.
  assert.deepEqual(
    Buffer.from(keyEvent(178)),
    Buffer.from([0x08, 0x01, 0x12, 0x03, 0x31, 0x37, 0x38]),
  );
});

test('Pointer x/y encode as little-endian fixed32 floats (0.5, 0.25)', () => {
  // 0.5f = 0x3F000000 → LE 00 00 00 3F ; 0.25f = 0x3E800000 → LE 00 00 80 3E
  const buf = encodeMessage({ type: 9, pointers: [{ x: 0.5, y: 0.25 }] });
  assert.deepEqual(
    Buffer.from(buf),
    Buffer.from([0x08, 0x09, 0x1a, 0x0a, 0x0d, 0x00, 0x00, 0x00, 0x3f, 0x15, 0x00, 0x00, 0x80, 0x3e]),
  );
});

test('zero-valued pointer floats are omitted from the inner message', () => {
  const buf = encodeMessage({ type: 9, pointers: [{ x: 0.5, y: 0 }] });
  assert.deepEqual(
    Buffer.from(buf),
    Buffer.from([0x08, 0x09, 0x1a, 0x05, 0x0d, 0x00, 0x00, 0x00, 0x3f]),
  );
});

test('bytes field (voice payload shape) encodes with tag 0x22', () => {
  const buf = encodeMessage({ type: 6, bytes: Uint8Array.of(1, 2) });
  assert.deepEqual(Buffer.from(buf), Buffer.from([0x08, 0x06, 0x22, 0x02, 0x01, 0x02]));
});

test('varint handles multi-byte values', () => {
  const buf = encodeMessage({ type: 300 });
  assert.deepEqual(Buffer.from(buf), Buffer.from([0x08, 0xac, 0x02]));
});

test('REMOTE_EVENT ordinals match the decompiled enum', () => {
  assert.equal(REMOTE_EVENT.KEY_EVENT, 1);
  assert.equal(REMOTE_EVENT.MOUSE_CLICK_EVENT, 4);
  assert.equal(REMOTE_EVENT.KEYBOARD_INPUT_EVENT, 5);
  assert.equal(REMOTE_EVENT.KEYBOARD_ACTION_EVENT, 8);
});