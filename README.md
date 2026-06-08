# QLab Cue Cart Remote

A Next.js web app for triggering and monitoring [QLab](https://qlab.app) Cue
Carts from a browser — a touch-friendly remote that mirrors QLab's live state
(cue names, colors, and running status) rather than firing commands blind.

## How it works

The app runs a custom Node server (`server.ts`) that:

- Hosts the Next.js UI
- Holds a single persistent OSC connection to QLab over TCP (port 53000 by
  default), using [SLIP framing](https://qlab.app/docs/v5/networking/using-osc/)
  as required by QLab's OSC 1.1 implementation
- Relays QLab's live state to connected browsers over a WebSocket (`/ws`),
  and forwards button taps back to QLab as `/cue_id/{id}/start` messages

Because it holds a long-lived TCP socket and pushes live updates to the
browser, it's meant to run **on the same local network as QLab** — e.g. on a
Mac mini, a small always-on box, or your own machine during a show — rather
than being deployed to the public internet.

## Setup

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Copy `.env.example` to `.env.local` and fill in your QLab workspace
   details:

   ```bash
   cp .env.example .env.local
   ```

   - `QLAB_HOST` — hostname or IP of the machine running QLab
   - `QLAB_PORT` — OSC port configured in QLab's Workspace Settings → Network
     → OSC Access (53000 is QLab's default)
   - `QLAB_PASSCODE` — the workspace passcode, if one is set
   - `QLAB_WORKSPACE_ID` — the unique ID of the workspace to connect to

3. In QLab, make sure the workspace is open and OSC access is enabled
   (Workspace Settings → Network).

4. Run the dev server:

   ```bash
   pnpm dev
   ```

   Open [http://localhost:3000](http://localhost:3000) — you should see your
   Cue Carts and their cues, with live status updates as you trigger them
   from QLab or from the browser.

## Production

```bash
pnpm build
pnpm start
```

`pnpm start` runs the same custom server (`server.ts`) in production mode.

## Running with Docker

The included `Dockerfile` and `docker-compose.yml` build and run the same
custom server in a container.

1. Copy `.env.example` to `.env` and fill in your QLab connection details
   (same variables as above — `QLAB_HOST` should be the **LAN IP or hostname
   of the machine running QLab**, reachable from wherever Docker runs):

   ```bash
   cp .env.example .env
   ```

2. Build and start the container:

   ```bash
   docker compose up --build
   ```

   Open [http://localhost:3000](http://localhost:3000) (or whatever `PORT`
   you set in `.env`).

The container uses normal Docker bridge networking — it reaches QLab the same
way any other LAN client would, over `QLAB_HOST:QLAB_PORT`. There's no need
for `network_mode: host`; just make sure `QLAB_HOST` is an address the Docker
host can route to (e.g. QLab's machine's LAN IP, not `localhost`/`127.0.0.1`
unless QLab and Docker are running on the very same machine — and even then,
`127.0.0.1` inside the container refers to the container itself, not the
host, so use the host's LAN IP or `host.docker.internal` on Docker
Desktop/Mac/Windows).

## Notes

- Only **Cue Carts** are surfaced — carts don't support `/go`, so cues are
  triggered with `/cue_id/{uniqueID}/start`.
- The server reconnects to QLab automatically (with backoff) if the
  connection drops, and the UI shows live connection status.
