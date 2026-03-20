# RideSync MVP (Web Demo)

This is a lightweight browser-based demo of the **RideSync MVP** PRD. It focuses on the core realtime session experience using **mock telemetry** with a local fallback and optional **WebSocket signaling** for cross-device sessions.

## ✅ Features Included

- Create / join a private session via a short **session code**
- Pair with real devices (Bluetooth trainer + heart rate monitor) in supported browsers
- Simulated telemetry (power, heart rate, cadence) generated every second (fallback)
- Live leaderboard updated across tabs
- Distance derived from power with a simple normalization formula
- Session summary stored locally and viewable later

## 🚀 Run locally

### Option A: Quick local demo (no server)
1. Open `index.html` in a browser (Chrome / Edge / Firefox).
2. Optionally, open the **Pair devices** screen and connect a Bluetooth trainer and/or heart rate monitor (Chrome/Edge desktop only).
3. Create a session, then open another tab and join using the code.
4. Keep both tabs open to see live updates.

> Tip: This demo can run purely in the browser. It uses WebSocket signaling + WebRTC when available, with a localStorage fallback for same-browser tabs.

### Option B: Cross-device signaling (WebSocket server)
If you'd like to sync between different machines/devices, run the simple signaling server and open the app using `?signaling=ws://<host>:3000`.

1. Install dependencies:
   ```sh
   npm install
   ```
2. Run the signaling server:
   ```sh
   node signaling-server.js
   ```
3. Open `index.html` in each browser and pass the signaling URL:
   - `index.html?signaling=ws://localhost:3000` (same machine)
   - `index.html?signaling=ws://<your-ip>:3000` (other device on your network)

> With the signaling server running, clients can create/join sessions across devices and sync session lifecycle + telemetry in realtime.

## 🧪 How to Demo

- Create a session in one tab (you become the host).
- Join the session in another tab using the session code.
- Click **Start session** in the host tab and watch the leaderboard update.
- End the session to generate a summary.

## 🗂️ Files in this repo

- `index.html` — main UI entry point
- `styles.css` — basic styling
- `app.js` — core application logic (session, telemetry, rendering)
- `project.md` — PRD / requirements

---

If you'd like, I can also add a minimal local file server for smoother development or extend the demo to use WebRTC signaling for true peer-to-peer sync.
