// Golden-byte tests for the MessageProto encoder (mirrors test/proto.test.js).
// Expected layouts are taken from the decompiled GeneratedMessageLite
// serializers of com.stark.bytelloremote 6.4.1.0.

package com.wisdomshare.remote

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Test

class ProtoTest {
    @Test fun `key event volume up code 24`() {
        assertArrayEquals(
            byteArrayOf(0x08, 0x01, 0x12, 0x02, 0x32, 0x34),
            Proto.keyEvent(24),
        )
    }

    @Test fun `key event back code 4`() {
        assertArrayEquals(
            byteArrayOf(0x08, 0x01, 0x12, 0x01, 0x34),
            Proto.keyEvent(4),
        )
    }

    @Test fun `mouse click event has no action field`() {
        assertArrayEquals(byteArrayOf(0x08, 0x04), Proto.mouseClick())
    }

    @Test fun `keyboard input hi`() {
        assertArrayEquals(
            byteArrayOf(0x08, 0x05, 0x12, 0x02, 0x68, 0x69),
            Proto.keyboardInput("hi"),
        )
    }

    @Test fun `default fields are omitted`() {
        assertArrayEquals(ByteArray(0), Proto.encodeMessage())
    }

    @Test fun `key event action is the decimal string`() {
        assertArrayEquals(
            byteArrayOf(0x08, 0x01, 0x12, 0x03, 0x31, 0x37, 0x38),
            Proto.keyEvent(178),
        )
    }

    @Test fun `pointer encodes as little-endian fixed32 floats`() {
        // 0.5f = 0x3F000000 → LE 00 00 00 3F ; 0.25f = 0x3E800000 → LE 00 00 80 3E
        val buf = Proto.encodeMessage(type = 9, pointers = listOf(Proto.Pointer(0.5f, 0.25f)))
        assertArrayEquals(
            byteArrayOf(0x08, 0x09, 0x1a, 0x0a, 0x0d, 0x00, 0x00, 0x00, 0x3f, 0x15, 0x00, 0x00, 0x80, 0x3e),
            buf,
        )
    }

    @Test fun `zero pointer floats are omitted`() {
        val buf = Proto.encodeMessage(type = 9, pointers = listOf(Proto.Pointer(0.5f)))
        assertArrayEquals(
            byteArrayOf(0x08, 0x09, 0x1a, 0x05, 0x0d, 0x00, 0x00, 0x00, 0x3f),
            buf,
        )
    }

    @Test fun `varint handles multi-byte values`() {
        assertArrayEquals(
            byteArrayOf(0x08, 0xac.toByte(), 0x02),
            Proto.encodeMessage(type = 300),
        )
    }

    @Test fun `remote event ordinals match the decompiled enum`() {
        assertEquals(1, Proto.KEY_EVENT)
        assertEquals(4, Proto.MOUSE_CLICK_EVENT)
        assertEquals(5, Proto.KEYBOARD_INPUT_EVENT)
        assertEquals(8, Proto.KEYBOARD_ACTION_EVENT)
    }
}