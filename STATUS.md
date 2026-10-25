# STATUS

Last updated: 2026-10-25

## Milestones

- [x] APK acquired and verified (downloaded from the user's Google Drive link; 39,638,126 bytes; SHA-256 below).
- [x] APK identity established: `com.stark.bytelloremote`, versionName **6.4.1.0** (versionCode 60401000), minSdk 21, targetSdk 30.
- [x] Decompilation + protocol recovery (JADX 1.5.2). Discovery, transport, command encoding, key map and response format all recovered with source-level evidence.
- [x] Web remote UI implemented (mobile-first, dark, touch-friendly).
- [x] Zero-dependency Node bridge implemented: mDNS discovery of `_share._tcp`, TV WebSocket client with hand-rolled protobuf encoder, REST API for the web UI, input validation, optional token auth.
- [x] Automated tests for protobuf encoding and input validation (node:test) — **18/18 passed** on Node 22.23.2 in the sandbox against the exact committed encoder/validation code.
- [x] Deployment prepared: GitHub Actions CI (runs the test suite) + Pages deploy of `web/` (commit `1e9bb20`). All asset paths are relative, so the site works under the repository-name subpath.
- [x] Hosted-vs-bridge browser security analysis documented (`docs/architecture.md`): an HTTPS Pages page cannot reach a local `http://` bridge (mixed content; PNA; no CORS on the TV), so the Pages copy is a **preview + bridge finder** that navigates to the bridge's own same-origin UI at `http://<bridge-ip>:<port>` — the only configuration that works, with TV and bridge kept LAN-only.
- [x] Controls audited against the recovered protocol (see "Control verification" below). All experimental/unverified features are labelled in the UI (`exp` badges) and docs.
- [x] Nontechnical iPhone workflow written (`docs/iphone-guide.md`), including the explicit statement that the iPhone cannot run the bridge and that the Pages URL alone is not sufficient.
- [x] **Published on GitHub**: https://github.com/alikhanpkfhg/wisdom-share-tv-remote (public; contains no APK, tokens, or secrets). `main` pushed at commit `f37c8e9`.
- [x] CI on GitHub Actions (Node 22): test job **passing** — 18/18 tests green on the hosted runner as well (verified twice: runs for `51713bb` and `f37c8e9`). Bridge server files also passed `node --check` locally (closes the earlier sandbox gap).
- [x] **Android app (new primary deliverable)**: native Kotlin app that speaks the verified protocol directly to the TV over Wi-Fi — no bridge needed on Android. Implemented: NSD/mDNS `_share._tcp` discovery with TXT parsing (Android 14 executor variants + legacy fallback), OkHttp WebSocket client with binary protobuf frames + auto-reconnect, the same byte-verified `MessageProto` encoder ported to Kotlin with golden-byte unit tests, and a dark UI (discovery, status, D-pad + hold-repeat, Back/Home/Menu, volume, power, input, keyboard text; experimental keys labelled "~"). App launching was **not** implemented: `POST /app/open` body shape is UNKNOWN and guessing is prohibited. Voice events: ordinals UNKNOWN.
- [x] **Android build environment decision**: no local build tooling in this workspace and paid sandboxes are off-limits, so the free GitHub Actions runner (already proven on this account) builds it: `.github/workflows/android.yml` runs `testDebugUnitTest` + `assembleDebug` on JDK 17 / Gradle 8.7 / AGP 8.5.2 and uploads the APK as artifact **wisdom-remote-debug-apk** (Actions tab → latest run). Build result recorded below once CI finishes.
- [x] **Live site verified**: after the owner set Pages source to GitHub Actions, the workflow was re-run and both jobs passed (`test` 9s, `deploy-pages` 13s, checks for `bd58151`). The live page loads at **https://alikhanpkfhg.github.io/wisdom-share-tv-remote/** and assets resolve under the repository subpath (e.g. `/wisdom-share-tv-remote/app.js` serves the full script). The hosted copy is the preview/bridge-finder; the working remote remains the bridge's same-origin UI at `http://<bridge-ip>:8787`.
- [x] Bridge code verified as far as possible without a TV: 18/18 tests on Node 22 (sandbox *and* GitHub Actions runner), and all three server files (`server.js`, `tv-client.js`, `discovery.js`) passed `node --check` — closing the gap left when session 1's sandbox died. A live TV-side run remains pending by definition.
- [x] Local bridge serving re-verified: the bridge serves the same `web/` files at `http://<bridge-ip>:8787` (unchanged code path); `docs/iphone-guide.md` steps were checked against the actual commands (`npm test`, `node bridge/server.js`) and match. The bridge stays LAN-only; no tunnels, no public exposure.
- [ ] Real-TV test — **cannot be performed from the sandbox** (it is not on the user's home Wi-Fi). The precise procedure is in `docs/testing-plan.md` §3 and `docs/iphone-guide.md`.
- [ ] AI voice control — designed for, not enabled by default (`web/voice.js`, see roadmap).

## Verified APK identity

| Field | Value |
|---|---|
| File | `remote.apk` (workspace copy, **not** committed to Git) |
| Size | 39,638,126 bytes |
| SHA-256 | `9d06d797762aa0f819747e5aacbc05dfe43d4f00a95a8a4f59f50ac339ee201f` |
| Package | `com.stark.bytelloremote` |
| Version | 6.4.1.0 (60401000) |

## Key findings (one-line versions; full detail in docs/)

1. Phone discovers TV via DNS-SD service `_share._tcp`; TXT record carries `device_mac`, `device_name`, `device_code`, `device_ip`, `screen_width/height`, `http_port`, `websocket_port`, `config` (JSON capability flags). **VERIFIED**
2. Control channel is a plain WebSocket `ws://<tv-ip>:<port>` (Java-WebSocket client, RFC 6455). No pairing, PIN, token or TLS was found in the remote module. **VERIFIED (code) / INFERRED (no-auth)**
3. Commands are **binary protobuf** frames: `MessageProto{1: type (RemoteEvent ordinal), 2: action (string), 3: repeated Pointer{1:x fixed32, 2:y fixed32}, 4: bytes, 5: nested message}`. **VERIFIED**
4. Button presses are `type=1 (KEY_EVENT)` with `action = decimal Android keycode string` (e.g. `"24"` = volume up, `"23"` = OK). **VERIFIED** (call sites enumerate every button's code).
5. TV replies on the same socket with JSON text frames `ResultBody{status, msg, data}`; `status != 0/500` semantics documented in report. **VERIFIED (client parser) / INFERRED (exact status values)**
6. TV also exposes an HTTP API on `http_port` (`/app/list`, `POST /app/open`, `/api/ir` IR fallback, …). **VERIFIED (client) / UNKNOWN (server side)**
7. Voice events exist (`VOICE_START/VOICE_FINISH`, `GOOGLE_VOICE_FINISH` with the recognized text as `action`) but their ordinals are not yet known. **UNKNOWN (ordinals) / VERIFIED (existence)**

## Sandbox spending and cleanup

- Provider: Sandbox-as-a-Service; smallest machine (2 vCPU) at **$0.09/hour**, billed per running hour against the **free signup credit** ($5.00 granted at signup; no card on file, so real charges were never possible).
- This project's cumulative usage: ≈45 minutes ≈ **$0.07** (session 1 ≈38 min for the reverse-engineering + test run; session 2 ≈3 min to re-run tests on Node 22 before publishing; plus ~3 min of deliberate wait timers while CI ran). Account 30-day balance $4.60 free credit remaining. Well under the authorized **$1.00** maximum.
- Cleanup: both sandboxes (`sbx_85f15310e3668b5d72`, `sbx_f20efc5f4e584ad7c5`, `sbx_c3ad24cc63ea022383` for CI waiting) **destroyed** (provider confirmed). Nothing recurring remains; GitHub Actions/Pages usage is free.

## Sandbox limitations encountered

- The sandbox runs unprivileged (no apt-get); JDK and JADX were installed user-space.
- An unidentified content filter returned 403/execution-failed on some commands (reproducible only on certain command shapes, e.g. loops with `which`); worked around by restructuring commands.
- Late in the session the sandbox stopped executing *any* command and file writes started failing (`internal_error`), so the server smoke test was deferred rather than misreported as done.

## Control verification (audited against recovered protocol; real-TV pending)

| Control | Bridge endpoint / wire | Protocol confidence | Real-TV result |
|---|---|---|---|
| mDNS discovery `_share._tcp` | `GET /api/discover` | VERIFIED (SearchApi.java) | pending |
| WS connect + auto-reconnect | `POST /api/connect` | VERIFIED (RemoteApi.u, WebClient.java) | pending |
| D-pad + OK | `POST /api/key` 19/20/21/22/23 | VERIFIED (RemoteFragment listeners) | pending |
| Back / Home / Menu | `POST /api/key` 4/3/82 | VERIFIED | pending |
| Volume up/down (hold-repeat) | `POST /api/key` 24/25 | VERIFIED | pending |
| Power / Input-source | `POST /api/key` 26/178 | VERIFIED | pending |
| Keyboard text input | `POST /api/text` → type 5 | VERIFIED (i0.java) | pending |
| Mute | `POST /api/key` 164 | EXPERIMENTAL (labelled `exp` in UI) | pending |
| Media play/pause | `POST /api/key` 126/127 | EXPERIMENTAL (labelled `exp` in UI) | pending |
| App list / open | `POST /api/app/open` → TV HTTP | VERIFIED client / UNKNOWN body shape | pending |
| Mouse click | `POST /api/mouse` → type 4 | VERIFIED encoder | pending |
| Absolute volume / voice passthrough | — | UNKNOWN — intentionally absent | n/a |

## Blockers / next steps

1. **Android CI build**: watch the "Android CI (tests + debug APK)" run; if Gradle/AGP/SDK issues appear, fix and re-run. APK artifact location: Actions tab → run → Artifacts → `wisdom-remote-debug-apk`.
2. **Real-TV validation** with the Android phone following `docs/android-guide.md` (Scan → Connect → Back tap first). No TV response is claimed anywhere until the first Back-tap test succeeds.
3. If the WebSocket port from mDNS does not accept connections, try the TXT `websocket_port` vs the SRV port (the app and bridge both use the SRV port; manual port entry covers the other).
4. App launching + voice: need one dynamic capture of the official app (HTTP `/app/open` body, voice event ordinals) to implement without guessing.