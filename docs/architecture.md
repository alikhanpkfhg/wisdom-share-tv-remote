# Architecture

## Hosted frontend (GitHub Pages) vs the local bridge

The project is published as a static site on GitHub Pages, but the Pages copy **cannot** drive the TV. The browser security model forbids it:

| Restriction | Consequence |
|---|---|
| Mixed content | A `https://` Pages page is blocked from calling the bridge's `http://<lan-ip>:8787` API and `ws://<lan-ip>` sockets. Non-negotiable in Safari and Chrome. |
| Private Network Access | Even without mixed content, Chrome requires the local server to answer a special CORS preflight (`Access-Control-Allow-Private-Network`); the TV answers no CORS headers at all. |
| Secure context / mDNS | `webkitResolveLocalWebResources`, multicast UDP and raw sockets are unavailable to web pages, so browser-only discovery is impossible. |
| CORS | The bridge deliberately sends no CORS headers; it is meant to be opened same-origin at `http://<bridge-ip>:8787`, which needs no CORS. |

Therefore the deployment is deliberately split:

- **GitHub Pages** (public, HTTPS): preview of the UI, project documentation, and a "bridge finder" — the user types their bridge's IP and the page navigates to `http://<bridge-ip>:8787`, which is a plain HTTP LAN page that Safari happily opens.
- **The bridge itself** serves the identical UI **same-origin** over the LAN. This is the only configuration that works, and it requires the bridge host to be on the home Wi-Fi. The TV and bridge stay LAN-only; nothing is tunneled to the internet.

**Practical result:** the URL to use daily is the bridge's own `http://<bridge-ip>:8787`. The Pages URL is documentation/preview. If the bridge cannot run anywhere, the remote cannot work — that limitation is stated in the iPhone guide rather than papered over.

## Why a bridge

A browser tab cannot speak the TV's protocol directly:

- Discovery needs mDNS multicast UDP 5353 — browsers cannot join multicast groups or open raw UDP.
- The TV's WebSocket is plain `ws://` on a raw LAN IP; a page served from HTTPS or from a different origin cannot connect without mixed-content/CORS relief, and the TV's server sends no CORS headers.
- Commands are **binary protobuf** frames — fine for browsers, but the discovery/connectivity constraints make direct browser↔TV unreliable at best.

So the phone browser talks to a tiny **bridge** (Node.js, zero dependencies) that lives on the same Wi-Fi and speaks the TV's protocol natively. The bridge is the only network component; the web UI is static files served by the bridge itself (same-origin → no CORS issues at all).

## Diagram

```mermaid
flowchart LR
    subgraph phone["Phone (iPhone browser)"]
        UI[Web remote UI\nstatic HTML/JS/CSS]
    end
    subgraph bridgehost["Bridge host (laptop / Pi / Termux)"]
        B[Node bridge\nREST API + static files\ndiscovery.js + tv-client.js + proto.js]
    end
    subgraph lan["Home Wi-Fi"]
        TV((Wisdom Share TV\nreceiver app\nws://ip:port + http://ip:http_port))
    end
    UI -- "HTTP fetch (same origin)\nPOST /api/key {code:23}" --> B
    B -- "mDNS browse _share._tcp" --> TV
    B -- "WebSocket ws://ip:port\nbinary protobuf frames" --> TV
    TV -- "text frames ResultBody JSON" --> B
```

## Bridge components

| File | Role |
|---|---|
| `bridge/proto.js` | hand-rolled protobuf `MessageProto` encoder matching the decompiled serializer (default fields omitted) |
| `bridge/tv-client.js` | WebSocket client to the TV (Node 22 global WebSocket), connect timeout, auto-reconnect, JSON text-frame responses surfaced as events |
| `bridge/discovery.js` | pure-Node mDNS browser: PTR query for `_share._tcp.local`, SRV/TXT/A parsing, TXT decode |
| `bridge/validate.js` | every inbound parameter is validated against whitelists (keycodes, text shape, IP/port, package names) |
| `bridge/server.js` | HTTP server: static UI + REST API; optional `BRIDGE_TOKEN`; binds `0.0.0.0` (LAN) by default, `HOST=127.0.0.1` for loopback-only |

API surface (all JSON; all validated; no shell, no arbitrary URLs):

- `GET /api/status` — connection state + last TV response
- `GET /api/discover` — run an mDNS scan and return devices
- `POST /api/connect` `{ip, port?}` — open the TV socket (port auto-fallbacks: given → TXT websocket_port → SRV port)
- `POST /api/disconnect`
- `POST /api/key` `{code}` — KEY_EVENT with whitelisted keycode
- `POST /api/text` `{text}` — KEYBOARD_INPUT_EVENT
- `POST /api/mouse` `{}` — MOUSE_CLICK_EVENT
- `POST /api/app/open` `{package}` — HTTP /app/open on the TV (package name regex-validated)
- `POST /api/voice-text` `{text}` — reserved for phase 2 (returns 501 until voice ordinals are confirmed)

## Practical phone-first workflow

1. Bridge host: any always-on machine on the home Wi-Fi (laptop, Raspberry Pi, NAS, or an old Android with Termux). `node bridge/server.js`.
2. Phone: open `http://<bridge-host-ip>:8787`. Add to home screen for an app-like experience.
3. The bridge host must stay awake for the remote to work; when it's off, the UI shows a clear offline error.

## Security posture

- Bridge binds to the LAN; it is never exposed to the internet (no tunnels in this design).
- Optional shared token (`BRIDGE_TOKEN` env) required on all `/api/*` calls when set.
- Strict input validation; only whitelisted keycodes and fixed endpoints; no dynamic URL construction from user input beyond validated IP/port/package.
- The bridge never stores credentials (none exist in the protocol).

## Voice phase design (phase 2)

`web/voice.js` isolates speech so the protocol client never changes:

1. Browser SpeechRecognition (Safari supports it with on-device limits; Chrome/Edge work too; privacy: audio leaves the device unless the platform says otherwise — documented in the UI).
2. A **fixed command grammar** maps recognized text to validated bridge calls. Nothing recognized is passed through raw: unknown utterances are rejected with a hint, and app-launch commands ask for a tap-to-confirm first.
3. A second path (pending evidence) sends the recognized text itself via `GOOGLE_VOICE_FINISH` so the TV's own voice pipeline executes it — blocked only on that event's ordinal.