# Protocol Findings — Bytello Remote ↔ Wisdom Share TV

Every statement carries a confidence label: **VERIFIED** (direct code evidence or reproducible test), **INFERRED** (strongly supported), **EXPERIMENTAL** (hypothesis to test), **UNKNOWN** (insufficient evidence).

## 1. Discovery

**VERIFIED** — DNS-SD/mDNS browse for service type `_share._tcp` in the local domain. The TV advertises:

- SRV: `<ip>, <port>` (the client uses this port for the control WebSocket)
- TXT: `device_mac`, `device_name`, `device_code`, `device_ip`, `screen_width`, `screen_height`, `http_port`, `websocket_port`, `config` (JSON)

Fallback (INFERRED): if a TV does not respond to mDNS browse, the official app's "connect code"/manual add path implies the TV is reachable by IP directly; the bridge therefore also supports manual `ip:port`.

## 2. Transport

**VERIFIED** — TCP WebSocket `ws://<tv-ip>:<port>` (RFC 6455, no TLS, no path, no subprotocol, no auth headers). Client library: Java-WebSocket `Draft_6455` with a keep-reconnecting timer.

**INFERRED** — persistent connection, not request/response per command; multiple commands may be sent over one socket. The client's reconnect-on-close loop implies the TV closes idle sockets (Java-WebSocket "lost connection detection" string present).

## 3. Command encoding (binary frames)

**VERIFIED** — each command is a single **binary** WebSocket frame containing a protobuf `MessageProto`:

```
MessageProto:
  1: type    varint          (RemoteEvent ordinal)
  2: action  string          (default "" → omitted)
  3: pointer repeated Pointer (each: 1:x float32 fixed32, 2:y float32 fixed32; zeros omitted)
  4: bytes   bytes           (voice audio)
  5: nested  message         {1: int32}  (purpose UNKNOWN)
```

Known `type` values:

| type | Event | action payload | Evidence |
|---|---|---|---|
| 0 | EVENT | — | enum head |
| 1 | KEY_EVENT | decimal keycode string | VERIFIED |
| 4 | MOUSE_CLICK_EVENT | — | VERIFIED |
| 5 | KEYBOARD_INPUT_EVENT | the text typed | VERIFIED |
| 8 | KEYBOARD_ACTION_EVENT | decimal editor-action code | VERIFIED |
| ? | KEYBOARD_SHOW/HIDE_EVENT | — | existence VERIFIED, ordinal UNKNOWN |
| ? | VOICE_START / VOICE_FINISH | — | existence VERIFIED, ordinal UNKNOWN |
| ? | GOOGLE_VOICE_START / GOOGLE_VOICE_FINISH | recognized text | existence VERIFIED, ordinal UNKNOWN |
| ? | VOICE_CONTENT | mic PCM bytes | existence VERIFIED, ordinal UNKNOWN |

### Worked examples (VERIFIED by our encoder + tests)

- Volume up (`KEY_EVENT`, code 24): `08 01 12 02 32 34`
  (`08 01` = field 1 varint 1; `12 02` = field 2, len 2; `"24"` = `32 34`)
- OK (`KEY_EVENT`, code 23): `08 01 12 02 32 33`
- Back (code 4): `08 01 12 01 34`
- Mouse click: `08 04`
- Keyboard text "hi": `08 05 12 02 68 69`

## 4. Keycodes (decimal string in `action`)

**VERIFIED** from `RemoteFragment` button listeners: 3 Home, 4 Back, 19/20/21/22 D-pad, 23 OK, 24/25 Volume, 26 Power, 82 Menu, 178 Input/source.

**EXPERIMENTAL**: 164 (mute), 126/127 (play/pause), 85 (play-pause toggle), 87/88 (next/prev) — standard Android codes; media strings exist in the dex; not seen on an enumerated button.

## 5. Responses

**VERIFIED** — the TV sends **text** frames on the same socket; the client parses them as JSON `ResultBody`:

```json
{"status": <int>, "msg": "<string>", "data": <any>}
```

`status == 500` is treated as an error by the client. Other status semantics: UNKNOWN (client only distinguishes 500).

## 6. TV HTTP API (secondary channel)

**VERIFIED client-side** — `http://<tv-ip>:<http_port from TXT>`, endpoints seen in the app:

- `GET /app/list`, `GET /app/recently` — installed apps
- `POST /app/open` — launch an app (voice "Open YouTube" hook)
- `POST /app/uninstall`
- IR fallback path (phone with IR blaster)

**UNKNOWN** — exact request/response bodies for these endpoints (client uses Retrofit DTOs that were partially obfuscated).

## 7. Pairing / security

**VERIFIED** — the Wi-Fi remote path performs no pairing: no PIN, no QR, no token, no TLS client setup in the remote module. The security boundary is the LAN itself.

**INFERRED** — first-time use requires the TV-side app to be running/enabled (the receiver advertises mDNS; no mDNS = not connectable).

## 8. Feature support summary for the web remote

| Feature | Supported? | Mechanism | Confidence |
|---|---|---|---|
| D-pad + OK | yes | KEY_EVENT 19/20/21/22/23 | VERIFIED |
| Back / Home / Menu | yes | KEY_EVENT 4/3/82 | VERIFIED |
| Volume up/down | yes | KEY_EVENT 24/25 | VERIFIED |
| Power / Input | yes | KEY_EVENT 26/178 | VERIFIED |
| Mute | likely | KEY_EVENT 164 | EXPERIMENTAL |
| Play/pause, next/prev | likely | KEY_EVENT 126/127/87/88 | EXPERIMENTAL |
| Text input | yes | KEYBOARD_INPUT_EVENT type 5 | VERIFIED |
| App launch | yes (HTTP) | POST /app/open | VERIFIED client / UNKNOWN body |
| Absolute volume set | not evidenced | — | UNKNOWN |
| Voice text passthrough | designed-in | GOOGLE_VOICE_FINISH, ordinal UNKNOWN | UNKNOWN |