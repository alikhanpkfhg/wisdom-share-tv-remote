# Testing Plan

Test classes are labeled explicitly. **Nothing in this repo has been tested against a real TV yet** — the sandbox cannot reach the user's home Wi-Fi — and no claim of real-TV success is made anywhere.

## 1. Automated (run in this repo / sandbox)

`npm test` runs node:test suites:

- `test/proto.test.js` — protobuf encoder golden bytes (key events, mouse click, keyboard text, pointer encoding, default-field omission). VERIFIED machine-level: our encoder reproduces the byte layout proven from the decompiled serializer.
- `test/validate.test.js` — input validation: keycode whitelist, text sanitization, IP/port parsing, package-name rule.

These prove message *encoding* and *input handling*, not TV acceptance.

## 2. Bridge-local (manual, no TV)

```sh
node bridge/server.js &
curl -s localhost:8787/api/status
curl -s -X POST localhost:8787/api/key -H 'content-type: application/json' -d '{"code":4}'   # expect ok:false, "not connected"
curl -s -X POST localhost:8787/api/key -H 'content-type: application/json' -d '{"code":999}' # expect 400
curl -s -X POST localhost:8787/api/connect -H 'content-type: application/json' -d '{"ip":"not-an-ip","port":1}' # 400
```

## 3. Real-TV test (requires the user's Wi-Fi) — PROCEDURE

1. Find the bridge host's IP (e.g. `ip addr` / `ifconfig`) and start it: `node bridge/server.js`.
2. On the phone (same Wi-Fi), open `http://<bridge-ip>:8787`.
3. Tap **Scan**. Expected: the TV appears with its name, IP, ports (this alone proves `_share._tcp` is advertised — INFERRED→VERIFIED if seen).
   - If scanning finds nothing: get IP+port from the official app (Settings → device info, or `dns-sd -B _share._tcp` on a Mac) and connect manually.
4. Tap the TV, then **Connect**. Expected: status pill turns green within ~3 s.
   - If it fails: the bridge logs the WS close code; try the other advertised port (UI shows both candidates).
5. Send **Back** (harmless). Expected: the TV leaves the current menu. This is the first real-TV acceptance test of a `KEY_EVENT` frame.
6. Then individually: OK (23), D-pad, Home (3), Menu (82), Volume ± (24/25), Power (26 — confirm), Input (178), text input via keyboard sheet.
7. EXPERIMENTAL keys one at a time: mute (164), play/pause (126/127). Record results in this file.
8. Resilience: kill the TV's remote session from the TV side / toggle Wi-Fi → the UI must show disconnect and reconnect when possible; send a command while disconnected → clear error.
9. `POST /api/app/open` with an installed package name (listed via a `GET` through `/api/app` list — to be surfaced in UI later).

Record each result as VERIFIED / FAILED / NO-RESPONSE in the table below.

| Command | Result | Notes |
|---|---|---|
| mDNS scan | pending | |
| WS connect | pending | |
| Back (4) | pending | |
| OK (23) | pending | |
| D-pad | pending | |
| Home (3) / Menu (82) | pending | |
| Vol 24/25 | pending | |
| Mute 164 | pending | |
| Media 126/127 | pending | |
| Text input (5) | pending | |
| App open | pending | |

## 4. Android app tests

- **Build/protocol tests (CI, free GitHub Actions runner):** `gradle testDebugUnitTest` runs the Kotlin golden-byte suite (`ProtoTest`) — the same wire-format assertions as the JS suite — plus keycode-whitelist tests (`KeyCodesTest`). The workflow then runs `assembleDebug` and uploads the debug APK as an artifact. Test job green = encoder and validation proven; TV acceptance still unproven.
- **Real-TV tests (user's Android phone on home Wi-Fi):** follow `docs/android-guide.md` — install the APK, Scan → Connect → **Back** tap first, then each button individually, noting results in the table above. No bridge needed on Android; the app speaks to the TV directly, exactly like the official app.

## 5. AI voice phase tests (after real-TV basics pass)

- Speech recognition produces text on the phone (Safari: on-device dictation; verify mic permission prompt).
- Grammar mapping unit table: "volume up/down", "mute", "press OK", "go back", "open <app>" (with confirmation), unknown → explicit rejection.
- Confirm no recognized text is ever sent unvalidated to the TV or executed locally.