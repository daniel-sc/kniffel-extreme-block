# Kniffel Extreme Block

## Development

```sh
npm install
npm run dev
```

## Realtime Sync Backend

The app syncs by always propagating the complete game state.

### 1) Configure environment

Copy `.env.example` to `.env` and set your backend host:

```sh
cp .env.example .env
```

Required variables:

- `VITE_PARTYKIT_HOST` — deployed sync backend host (for example `kniffel-extreme-sync.<account>.partykit.dev`)
- `VITE_PARTYKIT_PARTY` — optional party name, defaults to `kniffel-sync`

### 2) Run sync backend locally

```sh
npm run partykit:dev
```

### 3) Deploy sync backend to Cloudflare

```sh
npx partykit login
npm run partykit:deploy
```

The PartyKit config uses compatibility date `2026-03-29` (updated to latest stable at implementation time).

## Stable room behavior

- Each client/device stores a stable room ID in local storage and reuses it indefinitely.
- Shared links (`?room=<id>`) switch to that same stable room.
- Game reset/revanche actions keep the same room and only push updated full state.
- The server stores the latest full state in room storage and syncs it to newcomers.
- Presence and latest state are maintained with Cloudflare hibernation.

## Client deployment via Cloudflare Workers static assets

The client is deployed as static assets through Workers (`wrangler deploy`) using `wrangler.jsonc` and `assets.directory = "./dist"`.

## GitHub Actions: Cloudflare deploy on push

`.github/workflows/pages-deploy.yml` deploys backend + frontend on push to `main`:

1. Deploy sync backend with PartyKit.
2. Build frontend and deploy static assets through Workers.

Required repository secrets:

- `PARTYKIT_TOKEN`
- `VITE_PARTYKIT_HOST`
- `VITE_PARTYKIT_PARTY`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
