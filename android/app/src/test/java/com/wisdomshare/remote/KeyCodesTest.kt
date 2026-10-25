package com.wisdomshare.remote

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class KeyCodesTest {
    @Test fun `whitelist accepts confirmed and experimental codes`() {
        assertEquals(true, KeyCodes.isAllowed(23))
        assertEquals(true, KeyCodes.isAllowed(24))
        assertEquals(true, KeyCodes.isAllowed(178))
        assertEquals(true, KeyCodes.isAllowed(164))
    }

    @Test fun `whitelist rejects unknown codes`() {
        assertEquals(false, KeyCodes.isAllowed(999))
        assertEquals(false, KeyCodes.isAllowed(-1))
    }

    @Test fun `confirmed set does not include experimental keys`() {
        assertTrue(KeyCodes.CONFIRMED.contains(23))
        assertFalse(KeyCodes.CONFIRMED.contains(164))
        assertFalse(KeyCodes.CONFIRMED.contains(126))
    }
}