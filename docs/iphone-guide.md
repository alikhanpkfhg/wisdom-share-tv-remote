# iPhone Testing Guide (nontechnical)

This is the exact workflow for trying the remote on your Wisdom Share TV. No app store, no account, nothing to buy.

## The one thing to understand first

Your **iPhone cannot run the bridge itself** — Safari cannot open the network sockets the bridge needs. The remote works like this:

```
iPhone (Safari) → Bridge (a small program on another device) → TV
```

So you need **one extra device on your home Wi-Fi** running the bridge. Anything that can run Node.js works:

- a laptop (Windows/Mac/Linux),
- a Raspberry Pi,
- a NAS,
- an old Android phone with the free Termux app (advanced).

Opening the published GitHub Pages website alone is **not** sufficient — browsers refuse to let an HTTPS page talk to devices on your home network. The Pages site is a preview and a bridge-finder.

## Step-by-step

### 1. Set up the bridge device (once)

1. Install Node.js on that device — free download from `nodejs.org` (choose the LTS version). On a Mac: `brew install node`. On Ubuntu/Raspberry Pi OS: `sudo apt install nodejs npm`.
2. Get this project onto the device. Easiest: `git clone <repo-url>`, or download it as a ZIP from the GitHub page (green Code button → Download ZIP) and unzip it.
3. Open a terminal in the project folder and run the two commands:
   - `npm test` — should say 18 tests passed.
   - `node bridge/server.js` — should print `Wisdom Share bridge listening on http://0.0.0.0:8787`.
4. Leave this terminal open. **Closing it stops the remote.** (To stop the bridge later, press `Ctrl+C` in that terminal. To start it again, repeat this step.)

### 2. Find the bridge device's local IP address

- **Mac**:  → System Settings → Wi‑Fi → Details → the "IP address" looks like `192.168.1.50`.
- **Windows**: Settings → Wi‑Fi → Properties → IPv4 address.
- **Linux/Raspberry Pi**: type `hostname -I` in the terminal.

### 3. Open the remote on your iPhone

1. Make sure the iPhone is on the **same Wi-Fi** as the bridge device and the TV.
2. In Safari, go to `http://<the-ip-you-found>:8787` (e.g. `http://192.168.1.50:8787`).
   - If you are already on the published GitHub Pages page, you can instead type the same IP into its "Open the bridge remote" box — it takes you to the same place.
3. Optional: tap Share → Add to Home Screen to make it feel like an app.

### 4. Connect to the TV

1. Tap **Scan for TVs**. Your TV's name should appear after a few seconds (this is the mDNS discovery, same mechanism the official app uses).
2. Tap the TV, then tap **Connect**. The status pill at the top turns green with the TV's name.
   - No TV found? Enter the TV's IP manually — you can read it in the official Bytello remote app's device info screen. A port is usually not needed; the bridge tries the advertised ones.
3. If a token field appears, that means the bridge was started with `BRIDGE_TOKEN` set — type the same token you set.

### 5. First harmless test

Tap **Back** once. Expected: the TV leaves the current screen/menu. That single tap proves the whole chain (iPhone → bridge → TV WebSocket → protobuf command) works. Then try OK, D-pad, Home, volume.

### 6. Troubleshooting

| Symptom | Fix |
|---|---|
| Page doesn't load at step 3 | Check both devices are on the same Wi-Fi; re-check the IP; some guest/hotel Wi-Fi blocks device-to-device traffic — use your home Wi-Fi. |
| "Bridge unreachable" on the hosted GitHub Pages page | That page cannot reach your home — use `http://<bridge-ip>:8787` directly. |
| Scan finds nothing | The TV's remote receiver may be off — open the official Bytello app once to wake it, or enter the TV IP manually. |
| Connect fails | Note the error text; the bridge tries both advertised ports. Wait for the TV receiver to be enabled, then scan again. |
| Commands don't move the TV | The connection is up but the TV ignored the command — this is what the real-TV test table in `docs/testing-plan.md` records; please note which button and what happened. |
| iPhone asks about privacy/local network | Allow it — Safari uses that prompt for local connections. |

### 7. Keeping it alive

The bridge host must stay awake. On a laptop, prevent sleep while testing. If the TV's IP changes later (DHCP), just Scan again.