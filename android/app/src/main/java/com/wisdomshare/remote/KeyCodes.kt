// Keycode whitelist — port of bridge/validate.js. Codes confirmed in the
// original app's button listeners (RemoteFragment lines 560–858) are in
// CONFIRMED; everything else is EXPERIMENTAL (framework-standard codes the
// TV most likely accepts but not yet proven).

package com.wisdomshare.remote

object KeyCodes {
    val NAMES: Map<Int, String> = mapOf(
        3 to "HOME",
        4 to "BACK",
        19 to "DPAD_UP",
        20 to "DPAD_DOWN",
        21 to "DPAD_LEFT",
        22 to "DPAD_RIGHT",
        23 to "DPAD_CENTER_OK",
        24 to "VOLUME_UP",
        25 to "VOLUME_DOWN",
        26 to "POWER",
        82 to "MENU",
        85 to "MEDIA_PLAY_PAUSE",
        87 to "MEDIA_NEXT",
        88 to "MEDIA_PREVIOUS",
        126 to "MEDIA_PLAY",
        127 to "MEDIA_PAUSE",
        164 to "VOLUME_MUTE",
        178 to "INPUT_SOURCE",
    )

    val CONFIRMED: Set<Int> = setOf(3, 4, 19, 20, 21, 22, 23, 24, 25, 26, 82, 178)

    fun isAllowed(code: Int): Boolean = NAMES.containsKey(code)
}