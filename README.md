# Wisdom Share TV Remote

An original, evidence-based web replacement for the Wisdom Share (Bytello) phone remote.

- **Discovery** — mDNS/DNS-SD browse of `_share._tcp` on the home Wi-Fi (or manual IP entry).
- **Transport** — the TV speaks a WebSocket protocol carrying **binary protobuf** commands; this repo implements it faithfully in a small Node bridge that the phone browser talks to.
- **Web UI** — mobile-first, dark, touch-friendly remote (D-pad, back/home/menu, volume, power, input, text input, media keys).

## Quickstart

Prerequisites: Node.js 18+ (developed on Node 22), any laptop or Raspberry Pi on the **same Wi-Fi** as the TV.

```sh
npm test                 # run the offline protocol/validation tests
node bridge/server.js    # start the bridge (listens on :8787)
```

Then open `http://<bridge-machine-ip>:8787` on your phone and:

1. Tap **Scan** and pick your TV (or type its IP and port manually).
2. Tap **Connect** — the bridge opens the TV's WebSocket (`ws://<tv-ip>:<port>`).
3. Use the remote. Status, errors and reconnection are shown in the UI.

Running the bridge on the same phone as the browser is not possible in a plain browser app; a tiny always-on machine (laptop, Pi, old Android with Termux) is the practical host. See `docs/architecture.md`.

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