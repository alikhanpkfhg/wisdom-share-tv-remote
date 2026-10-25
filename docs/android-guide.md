# Android App Guide (beginner)

The Android app controls the Wisdom Share TV **directly over your home Wi-Fi** — it speaks the exact protocol the official Bytello remote uses (mDNS discovery + WebSocket + protobuf key events). No Node.js bridge, no laptop, no website needed.

Requirements: an Android phone with **Android 5.0 or newer**, on the **same Wi-Fi** as the TV.

## 1. Download the APK

1. Open https://github.com/alikhanpkfhg/wisdom-share-tv-remote in a browser.
2. Go to the **Actions** tab (top of the repo).
3. Click the latest run of **"Android CI (tests + debug APK)"** that shows a green check.
4. Scroll to the **Artifacts** section at the bottom and download **wisdom-remote-debug-apk**. It arrives as a ZIP.
5. Unzip it — inside is `app-debug.apk`.

## 2. Install it on the Android phone

1. Copy `app-debug.apk` to the phone (email it to yourself, send via a messenger, or use a USB cable).
2. On the phone, tap the APK in your Files/Downloads app.
3. Android will say installing unknown apps is blocked: tap **Settings** on that popup and enable **"Allow from this source"** for the app you're opening the file with (this is normal for any app installed outside the Play Store), then go back and tap **Install**.
4. Open **Wisdom Share Remote**. If Android asks you to allow **nearby devices / local network** access, tap **Allow** (some phones show this prompt, some don't).

Note: this is a **debug-signed test build** — fine for personal testing, not a Play Store release.

## 3. Connect to your TV

1. Make sure the phone and the TV are on the **same Wi-Fi network**.
2. In the app, tap **Scan for TVs**. The TV appears within a few seconds (this is the same `_share._tcp` mDNS discovery the official app uses).
3. Tap the TV in the list, then tap **Connect**. The status pill at the top turns green: "Connected ✓".
   - Nothing found? Enter the TV's IP manually — you can read it in the official Bytello remote app's device-info screen. A port is usually filled in from the scan; otherwise try the port shown there.

## 4. First test: one harmless command

Tap **Back** once. Expected: the TV leaves the current menu/screen. That single tap proves the whole chain (mDNS → WebSocket → protobuf KEY_EVENT). Then try OK, D-pad (hold to repeat), Home, Menu, Volume (hold to repeat), Power, Input, and keyboard text.

Buttons labeled **~** (Mute, Play, Pause) are **experimental**: they use standard Android media/mute keycodes that exist in the official app's code but are not proven on this TV — test them one at a time.

## 5. Troubleshooting

| Symptom | Fix |
|---|---|
| Scan finds nothing | Open the official Bytello remote app once (wakes the TV receiver), then scan again; or enter the TV IP manually. |
| "discovery start failed" | Some Wi-Fi networks block device-to-device traffic (guest/hotel networks). Use your home Wi-Fi. |
| Connect fails with timeout | The TV receiver may be asleep — wake the TV, check the port, retry. The app auto-reconnects once connected. |
| Connected but buttons do nothing | The TV accepted the socket but ignored the command — note which button and what happened; that's exactly what `docs/testing-plan.md` records. |
| Status shows "Reconnecting…" | The Wi-Fi or the TV dropped — the app retries automatically every few seconds. |

## 6. What the app deliberately does NOT do

- **App launching** — the TV's HTTP `POST /app/open` endpoint is evidenced in the original app, but its request body shape is UNKNOWN, so it was not guessed. It can be added once verified.
- **Voice control** — the voice event ordinals in the protocol are still UNKNOWN.
- Nothing here exposes the TV to the internet: everything is local Wi-Fi, plain `ws://` to the TV's own port.