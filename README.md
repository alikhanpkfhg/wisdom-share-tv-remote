# Wisdom Share TV Remote

An original, evidence-based replacement for the Wisdom Share (Bytello) phone remote.

- **Android app** (primary): native Kotlin app that discovers the TV over mDNS and sends the recovered protobuf commands **directly** over Wi-Fi — no bridge needed. Debug APK is built by CI (Actions tab → latest "Android CI" run → artifact). Guide: `docs/android-guide.md`.
- **Web remote** (iPhone-friendly): mobile-first dark UI served by a small Node bridge that speaks the TV's WebSocket protocol for the phone's browser.
- **Documented protocol**: mDNS `_share._tcp` discovery, TV HTTP/WebSocket ports, binary protobuf messages, verified keycodes — all with source-level evidence and confidence labels.

## Quickstart (Android)

```sh
# CI builds it for you: Actions tab → "Android CI (tests + debug APK)" → Artifacts → wisdom-remote-debug-apk
```

Install `app-debug.apk` on an Android 5.0+ phone on the TV's Wi-Fi, open the app, tap **Scan**, pick the TV, **Connect**, and try **Back** first. Full steps: `docs/android-guide.md`.

## Quickstart (web, any phone browser)

Prerequisites: Node.js 18+ (developed on Node 22), any laptop or Raspberry Pi on the **same Wi-Fi** as the TV.

```sh
npm test                 # run the offline protocol/validation tests
node bridge/server.js    # start the bridge (listens on :8787)
```

Then open `http://<bridge-machine-ip>:8787` on your phone and:

1. Tap **Scan** and pick your TV (or type its IP and port manually).
2. Tap **Connect** — the bridge opens the TV's WebSocket (`ws://<tv-ip>:<port>`).
3. Use the remote. Status, errors and reconnection are shown in the UI.

A hosted preview lives at https://alikhanpkfhg.github.io/wisdom-share-tv-remote/ — because browsers block HTTPS pages from reaching local networks, the working web remote is always the bridge's own address. Running the bridge on the same phone as the browser is not possible in a plain browser app; see `docs/architecture.md`.

## Repository layout

```
STATUS.md                     current state, spending, cleanup
docs/
  reverse-engineering-report.md   APK identity, tools, findings + source locations
  protocol-findings.md            the phone→TV wire protocol, with confidence labels
  architecture.md                 system design + browser constraints (Mermaid)
  testing-plan.md                 test matrix incl. real-TV procedure
bridge/                       zero-dependency Node bridge (discovery, TV client, REST API)
web/                          the web remote (static, served by the bridge)
test/                         node:test suites for encoding + validation
```

Security notes: the bridge never executes shell commands, validates every command and parameter, binds to the LAN only (no public exposure), and supports an optional shared token via `BRIDGE_TOKEN`. The APK and any credentials are kept out of Git.