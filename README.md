# Kniffel Extreme Block

## Development

```sh
npm install
npm run dev
```

## Multiplayer Sync (PartyKit)

This project uses PartyKit instead of PeerJS and always propagates the full game state.

### 1) Configure environment

Copy `.env.example` to `.env` and set your PartyKit host:

```sh
cp .env.example .env
```

Required variables:

- `VITE_PARTYKIT_HOST` — your deployed PartyKit host (for example `kniffel-extreme-sync.<account>.partykit.dev`)
- `VITE_PARTYKIT_PARTY` — optional party name, defaults to `kniffel-sync`

### 2) Run PartyKit locally

```sh
npm run partykit:dev
```

### 3) Deploy PartyKit to Cloudflare

1. Authenticate once:

```sh
npx partykit login
```

2. Deploy the PartyKit server configured in `partykit.json`:

```sh
npm run partykit:deploy
```

3. Put the resulting deployment hostname into `VITE_PARTYKIT_HOST` and redeploy the frontend.

## Stable room behavior

- Each client/device stores a stable room ID in local storage and reuses it indefinitely.
- Shared links (`?room=<id>`) switch to that same stable room.
- Game reset/revanche actions keep the same room and only push updated full state.
- PartyKit server stores the latest full state in room storage and syncs it to newcomers.
- Presence and latest state are maintained with connection hibernation enabled.
