# Kniffel Extreme Block

## Development

```sh
npm install
npm run dev
```

## Realtime sync

The app syncs by always propagating the complete game state.

This repo now uses Cloudflare's modern PartyKit stack:

- `partyserver` for the realtime Durable Object server
- `partysocket` for the client connection
- `wrangler` for local worker dev and production deploys
- one Cloudflare worker for both the SPA and `/parties/kniffel-sync/:room` sync routes

## Local setup

### 1) Configure optional split-host dev env

Copy `.env.example` to `.env` if you want the Vite frontend to talk to a separate local worker:

```sh
cp .env.example .env
```

Available variables:

- `VITE_SYNC_HOST` - optional sync host override, for example `localhost:8787`
- `VITE_SYNC_PARTY` - optional party name, defaults to `kniffel-sync`

The client still falls back to legacy `VITE_PARTYKIT_HOST` and `VITE_PARTYKIT_PARTY` values if you already have them configured.

### 2) Run the local sync worker

```sh
npm run sync:dev
```

### 3) Run the frontend dev server

```sh
npm run dev
```

## Deploy to Cloudflare

```sh
CLOUDFLARE_ACCOUNT_ID=<your-account-id> \
CLOUDFLARE_API_TOKEN=<your-api-token> \
npm run deploy
```

Environment-specific deploys:

```sh
npm run deploy:production
npm run deploy:staging
```

`wrangler.jsonc` deploys a single worker that:

- serves the built Vite app from `./dist`
- routes realtime websocket traffic through `partyserver`
- stores room state in a Durable Object class named `KniffelSyncServer`

Custom domains are configured directly in `wrangler.jsonc` per Wrangler environment:

- `production` -> `kniffel.schreiber-lang.de`
- `staging` -> `test-kniffel.schreiber-lang.de`

That means HTTPS is provisioned by Cloudflare on deploy, instead of relying on manual dashboard routing.

`wrangler.sync-dev.jsonc` is the local worker config used by `npm run sync:dev`.

## Stable room behavior

- Each client/device stores a stable room ID in local storage and reuses it indefinitely.
- Shared links (`?room=<id>`) switch to that same stable room.
- Game reset/revanche actions keep the same room and only push updated full state.
- The server stores the latest full state in room storage and syncs it to newcomers.
- Presence and latest state are maintained with Cloudflare hibernation.
- If a room has no interaction for seven days, a cleanup alarm removes persisted room state.

## GitHub Actions deploys

`.github/workflows/pages-deploy.yml` deploys the unified worker for two stable environments:

- `main` branch -> `production`
- non-`main` branches -> shared `staging`

Required repository secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

If you previously deployed sync through legacy PartyKit cloud-prem, note that this migration creates a new Durable Object class/namespace, so existing room state will not carry over.
