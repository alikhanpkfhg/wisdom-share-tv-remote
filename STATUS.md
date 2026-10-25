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
- [ ] **GitHub publish blocked on sign-in**: `github_repo`/push attempts returned HTTP 401 (GitHub token expired/revoked in the FreeMilk app). The user must re-sign-in to GitHub in the app's settings; after that, publishing is: create public repo (Pages requires a public repo on the free plan) → push `main` → Actions runs tests → Pages goes live → verify URL → record it here.
- [ ] Bridge server end-to-end smoke test — **not run**: the sandbox became unresponsive (run_command/write_file failing on every call, including `echo`) before the server smoke test could execute; `node --check` syntax validation of the server also couldn't run. First-run checks are built into the real-TV procedure (`docs/testing-plan.md` §2/§3) and the Pages CI will run the test suite on push.
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
- This project's usage: ≈38 minutes ≈ **$0.06** (account-level 30-day total $0.374 across all sandboxes; balance $4.63 free credit remaining). Well under the authorized **$1.00** maximum.
- Cleanup: sandbox `sbx_85f15310e3668b5d72` **destroyed** (provider confirmed `status: deleted`). Nothing recurring remains; the work lives entirely in this repository.

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

1. **Re-sign-in to GitHub** in the app settings (token expired — 401), then I can create the public repository, push `main` (commits `aa450f5`, `1e9bb20`, + this), watch CI, and verify the Pages URL.
2. Real-TV validation following `docs/testing-plan.md` §3 / `docs/iphone-guide.md` (needs a bridge host on the home Wi-Fi; the sandbox could never reach it).
3. If the WebSocket port from mDNS does not accept connections, try the TXT `websocket_port` vs the SRV port (bridge tries both automatically).
4. Voice phase: capture the voice event ordinals (small follow-up decompilation) or sniff the official app once, then enable `web/voice.js`.