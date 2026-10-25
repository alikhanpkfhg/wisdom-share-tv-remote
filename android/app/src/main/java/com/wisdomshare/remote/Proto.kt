// Binary command encoding for MessageProto.
// Port of bridge/proto.js — byte layouts verified against the decompiled
// GeneratedMessageLite serializers (e/i/b/d.java, e/i/b/c.java) of
// com.stark.bytelloremote 6.4.1.0, and locked by golden-byte unit tests.
//
//   field 1  varint   type     — omitted when 0 (RemoteEvent ordinal)
//   field 2  string   action   — omitted when "" (keycode as decimal string, text, …)
//   field 3  message  Pointer  — repeated; {1: float32 x, 2: float32 y} fixed32 LE,
//                               zero values omitted
//   field 4  bytes    payload  — omitted when empty (voice audio)

object Proto {
    const val EVENT = 0
    const val KEY_EVENT = 1
    const val MOUSE_CLICK_EVENT = 4
    const val KEYBOARD_INPUT_EVENT = 5
    const val KEYBOARD_ACTION_EVENT = 8

    data class Pointer(val x: Float = 0f, val y: Float = 0f)

    fun encodeMessage(
        type: Int = 0,
        action: String = "",
        pointers: List<Pointer> = emptyList(),
        bytes: ByteArray? = null,
    ): ByteArray {
        val out = ArrayList<Byte>()
        if (type != 0) {
            out.add(0x08)
            addVarint(out, type)
        }
        if (action.isNotEmpty()) {
            val a = action.toByteArray(Charsets.UTF_8)
            out.add(0x12)
            addVarint(out, a.size)
            for (b in a) out.add(b)
        }
        for (p in pointers) {
            val inner = ArrayList<Byte>()
            if (p.x != 0f) {
                inner.add(0x0d)
                addFixed32(inner, p.x)
            }
            if (p.y != 0f) {
                inner.add(0x15)
                addFixed32(inner, p.y)
            }
            out.add(0x1a)
            addVarint(out, inner.size)
            out.addAll(inner)
        }
        if (bytes != null && bytes.isNotEmpty()) {
            out.add(0x22)
            addVarint(out, bytes.size)
            for (b in bytes) out.add(b)
        }
        return out.toByteArray()
    }

    // Mirrors the exact call sites in the original app (RemoteViewModel.k,
    // ControlWindow.d, e/i/b/h/d/i0.java).
    fun keyEvent(code: Int): ByteArray = encodeMessage(type = KEY_EVENT, action = code.toString())
    fun mouseClick(): ByteArray = encodeMessage(type = MOUSE_CLICK_EVENT)
    fun keyboardInput(text: String): ByteArray = encodeMessage(type = KEYBOARD_INPUT_EVENT, action = text)
    fun keyboardAction(code: Int): ByteArray = encodeMessage(type = KEYBOARD_ACTION_EVENT, action = code.toString())

    private fun addVarint(out: MutableList<Byte>, value: Int) {
        var v = value
        while (v > 0x7f) {
            out.add(((v and 0x7f) or 0x80).toByte())
            v = v ushr 7
        }
        out.add((v and 0xff).toByte())
    }

    private fun addFixed32(out: MutableList<Byte>, f: Float) {
        val bits = f.toRawBits()
        for (i in 0..3) out.add(((bits ushr (8 * i)) and 0xff).toByte())
    }
}