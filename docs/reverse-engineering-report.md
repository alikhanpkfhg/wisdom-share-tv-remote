# Reverse-Engineering Report — Bytello Remote (Wisdom Share TV phone app)

Scope: static analysis of the phone-side APK. The TV-side receiver APK was **not** available; all TV-side behavior is inferred from the client code. Nothing on the TV was modified, and no dynamic instrumentation was used.

## 1. APK identity (VERIFIED)

| Field | Value |
|---|---|
| Source | User's Google Drive link (`id=1572psm75M5-hPovWnaRI_mwWEK6zW5dn`), downloaded with the standard Drive confirm-token form flow |
| Official page | `tvweb.cvtapi.com/stark-agreements/bytello_remote/download-page/index.html` (iOS App Store id 1621201264) |
| Size | 39,638,126 bytes |
| SHA-256 | `9d06d797762aa0f819747e5aacbc05dfe43d4f00a95a8a4f59f50ac339ee201f` |
| Package | `com.stark.bytelloremote` |
| versionName / versionCode | 6.4.1.0 / 60401000 |
| SDK | minSdk 21, targetSdk 30, compileSdk 31 |
| Notable permissions | INTERNET, ACCESS_WIFI_STATE, CHANGE_WIFI_MULTICAST_STATE (mDNS), TRANSMIT_IR (IR fallback), RECORD_AUDIO (voice), CAMERA (gesture/air-mouse) |
| Native libs | `libjdns_sd.so` + `libjdns_sd_embedded.so` (DNS-SD), `libjingle_peerconnection_so.so` (WebRTC), `libMNN.so` (on-device gesture models), `libmmkv.so` |

The APK is kept out of Git; only its hash and metadata are recorded.

## 2. Tools and commands (VERIFIED)

- Python 3 + `zipfile` — APK entry listing and raw dex string-pool scans (`scan.py`, `scan2.py`).
- Temurin JRE 17.0.21 (user-space tarball) + **JADX 1.5.2**: `jadx -j 2 --no-debug-info -d out remote.apk`.
- `grep` over the decompiled sources for call sites and string constants.

The sandbox runs unprivileged (no apt), so all tooling was user-space.

## 3. App architecture (VERIFIED, from package layout)

- `com.stark.bytelloremote.search` — TV discovery (mDNS), device DB (Room, `CmDevice`).
- `com.stark.bytelloremote.remote` — the remote screen: D-pad, volume, voice, keyboard input, air-mouse.
- `com.stark.bytelloremote.api.remote` — `RemoteApi`: the connection manager + command sender.
- `com.stark.bytelloremote.toolkit` — screenshot, app list, gesture control, gamepad.
- Obfuscated packages `e/i/b/**` hold the transport: protobuf `MessageProto` (`e/i/b/d.java`), WebSocket client (`e/i/b/e/g/h.java`), OkHttp interceptor for TV HTTP API (`e/i/b/e/e/a.java`).

## 4. Discovery flow (VERIFIED)

`com/stark/bytelloremote/api/search/SearchApi.java`:

- Browses DNS-SD service type **`_share._tcp`** (`hVar.a.b("_share._tcp", ...)`, line 107). Uses Rx2DNSSD (`com.github.druk.dnssd`, native `jdns_sd`) on SDK ≤ 31, Android NSD otherwise.
- TXT attributes read: `device_mac`, `device_name`, `device_code`, `device_ip`, `screen_width`, `screen_height`, `http_port`, `websocket_port`, and `config` (a JSON blob parsed into a `Config` capability class).
- SRV port (`nsdServiceInfo.getPort()`) is stored as `Device.port`.

## 5. Connection flow (VERIFIED code / INFERRED no-auth)

`com/stark/bytelloremote/api/remote/RemoteApi.java`:

- `u(device)` builds **`ws://<device.ip>:<device.port>`** (lines 326–333) and hands it to the WebSocket client.
- Client is `e/i/b/e/g/h.java` (`WebClient`), a Java-WebSocket `WebSocketClient` with `Draft_6455` (RFC 6455), a connect timeout, and a periodic "if closed → reconnect" handler. Connection state is broadcast to listeners.
- **No authentication of any kind is performed**: no headers, no login, no PIN, no certificate. The whole app contains no pairing dialog for Wi-Fi mode (IR mode uses the TV HTTP API instead). Confidence: VERIFIED that the client sends no auth; INFERRED that the TV accepts unauthenticated LAN connections (consistent with "same Wi-Fi only" behavior).

## 6. Command path (VERIFIED)

Button → `RemoteFragment.J0(keyCode)` → `RemoteViewModel.k(keyCode)`:

```java
d.a aVarP = e.i.b.d.p();          // MessageProto.newBuilder()
aVarP.o(1);                        // type = 1 = RemoteEvent.KEY_EVENT
aVarP.n(String.valueOf(keyCode));  // action = e.g. "24"
fVar.a.c(aVarP.i());               // RemoteApi.c(request)
```

`RemoteApi.c` (lines 91–103): `hVar2.send(request.toByteArray())` — **the protobuf message is sent as one binary WebSocket frame**.

`MessageProto` (decompiled from `e/i/b/d.java`; obfuscated `e.i.b.d`):

| Field | Wire | Type | Meaning |
|---|---|---|---|
| 1 | varint | int32 | `RemoteEvent` ordinal ("type") |
| 2 | length-delimited | string | "action": keycode as decimal string, keyboard text, voice text |
| 3 | repeated message | Pointer | `{1: x fixed32 float, 2: y fixed32 float}` (touch/air-mouse) |
| 4 | length-delimited | bytes | voice audio (RemoteViewModel sends mic PCM) |
| 5 | message | `e.i.b.b` | nested message with a single int32 field 1 (purpose UNKNOWN) |

Default-valued fields are omitted on the wire (standard protobuf-lite behavior), confirmed by the generated serializers.

`RemoteEvent` ordinals evidenced at call sites: `EVENT`=0, `KEY_EVENT`=1 (ControlWindow comment `.setType(RemoteEvent.KEY_EVENT.ordinal)` + `.o(1)`), `MOUSE_CLICK_EVENT`=4 (`.o(4)`), `KEYBOARD_INPUT_EVENT`=5 (`.o(5)`, action = text), `KEYBOARD_ACTION_EVENT`=8 (`.o(8)`, action = editor action as decimal string). Voice-related types (`VOICE_START`, `VOICE_FINISH`, `GOOGLE_VOICE_START`, `GOOGLE_VOICE_FINISH`, `KEYBOARD_SHOW/HIDE_EVENT`) exist but their ordinals are UNKNOWN from static evidence alone.

## 7. Button → keycode map (VERIFIED)

`RemoteFragment.java` click listeners (lines 560–858) call `J0(<int>)` with standard Android `KeyEvent` codes:

| Button | Code | Android name |
|---|---|---|
| Power | 26 | KEYCODE_POWER |
| Home | 3 | KEYCODE_HOME |
| Back | 4 | KEYCODE_BACK |
| Menu | 82 | KEYCODE_MENU |
| Volume up / down | 24 / 25 | KEYCODE_VOLUME_UP / DOWN |
| D-pad up/down/left/right | 19/20/21/22 | KEYCODE_DPAD_* |
| OK (center) | 23 | KEYCODE_DPAD_CENTER |
| Source/input (ic_remote_key_source) | 178 | KEYCODE_TV_INPUT_COMPOSITE_2 |

Present in dex strings but not in the enumerated button listeners: `KEYCODE_MEDIA_PLAY` (126), `KEYCODE_MEDIA_PAUSE` (127) — media keys are INFERRED-supported (the TV's input pipeline uses framework keycodes). `KEYCODE_VOLUME_MUTE` (164) is EXPERIMENTAL.

## 8. Responses (VERIFIED client parsing / INFERRED semantics)

`e/i/b/e/g/h.java` `onMessage(String)` parses every text frame as `ResultBody{status:int, msg:string, data:any}` (Gson) and dispatches to listeners; a `status == 500` short-circuits as an error. Binary frames are not parsed by this client. The bridge treats any text frame as a response record.

## 9. TV-side HTTP API (VERIFIED client / UNKNOWN server)

OkHttp interceptor `e/i/b/e/e/a.java` rewrites all requests to `http://<device.ip>:<device.httpPort>`. Evidenced endpoints: `GET /app/list`, `GET /app/recently`, `POST /app/open`, `POST /app/uninstall` (`AppServiceApi.java`), `POST /api/ir` IR fallback (`RemoteViewModel.k`, IR mode), plus service-route strings `/api/remote`, `/api/http`, `/api/search`, `/appstore/api`. These are the hooks for app launching (voice phase).

## 10. Other evidence

- WebRTC (`libjingle_peerconnection_so.so`, `e/d/a/a/f/o.java`) is used for screen-cast / camera-gesture signaling over a separate `ws://` URL — **not** part of the remote-control path.
- `res/xml/network_security_config.xml` exists; remote traffic is plain-text `ws://`/`http://` on the LAN.
- IR fallback: when the phone has an IR blaster and Wi-Fi isn't joined, `TRANSMIT_IR` + `/api/ir` are used. Not relevant for a web remote.

## 11. Unresolved questions

1. Exact voice event ordinals (needs one dynamic capture or smali-level enum dump).
2. TV-side receiver behavior: which keycodes it forwards to the system, whether any keycode is filtered (UNKNOWN until real-TV test).
3. Which of the SRV port vs TXT `websocket_port` is authoritative (client uses the SRV port; both are stored).
4. `Config` JSON semantics per TV model.