# Sync Protocol

## Scope

This app uses a room-based WebSocket sync protocol on top of Cloudflare Durable Objects via `partyserver` and `partysocket`.

The protocol is intentionally simple:

- one room holds exactly one persisted value: the latest full `GameState`
- clients never send patches or operations, only complete snapshots
- the server does not merge states; it stores the latest snapshot and forwards it to the other connected clients

This is effectively a full-state, last-write-wins protocol.

## Transport And Rooming

- Transport: WebSocket
- Route shape: `/parties/<party>/<room>`
- Default party name: `kniffel-sync`
- Room identifier: opaque string, usually a UUID generated in the browser

Room selection rules:

- each browser stores a stable room id in `localStorage`
- a shared `?room=<id>` URL overrides the stored room for that visit and then becomes the new stored room
- generating a new room id moves the client into a different room; it does not reset or migrate the old room

## Data Model

The synced payload is the complete `GameState` object.

Relevant characteristics:

- `updatedAt` is an ISO timestamp carried inside every synced `GameState` and is used as the effective revision
- `version` exists in the state model, but sync does not negotiate or validate protocol/schema versions
- the server persists the state as untyped JSON under a single storage key
- there is no server-side history, diff, audit log, or per-field ownership

## Message Types

All messages are JSON.

### `initial-state`

Sent by the server immediately after a socket connects.

```json
{ "type": "initial-state", "state": { ... } }
```

or, for an empty room:

```json
{ "type": "initial-state", "state": null }
```

Meaning:

- `state !== null`: the room already has a persisted snapshot
- `state === null`: the room is empty and the first connected client may seed it with its local state

### `sync`

Sent by a client whenever it wants to publish state.

```json
{ "type": "sync", "state": { ... } }
```

Server behavior:

- overwrite the room's persisted snapshot
- broadcast the same payload to all other connected clients
- do not echo it back to the sender

### `presence`

Sent by the server on connect and close.

```json
{ "type": "presence", "peers": ["..."] }
```

Meaning:

- `peers` is the list of other currently connected socket ids in the same room
- ids are transport/session identifiers, not user identities

## Client Flow

### 1. Startup

On app start, the client:

- restores local game state from `localStorage`
- resolves the target room id
- restores sync mode and the room's last known synced revision from `localStorage`
- opens the room socket unless the user explicitly enabled offline mode

### 2. Join Handshake

The server immediately sends `initial-state`.

The client does not publish local state until this message arrives. This prevents a newcomer from overwriting an existing room before seeing its current snapshot.

### 3. Initial Reconciliation

If the server sends `initial-state: null`:

- the room is treated as empty
- the client keeps its current local state
- the next state effect publishes that local state and seeds the room

If the server sends `initial-state: <state>`:

- the client compares three revisions: local `updatedAt`, server `updatedAt`, and room-scoped `lastSyncedAt`
- if only one side changed since `lastSyncedAt`, that side wins automatically
- if both sides changed, the client blocks sync and shows a conflict dialog with both timestamps
- after applying the room snapshot, the next broadcast is suppressed once to avoid immediately echoing the just-received state back to the room

### 4. Steady-State Sync

After the handshake:

- every local game change triggers a `sync` message with the complete current `GameState`
- every incoming remote `sync` replaces the full local state
- identical states are ignored via `JSON.stringify` equality checks

## Server Behavior

For each room, the Durable Object keeps:

- the latest full state under `latest-state`
- the live connection set managed by `partyserver`

Additional server rules:

- hibernation is enabled, so idle rooms can sleep without losing persisted state
- when a client reconnects with the same socket identity slot, older connections for that id are closed as stale
- a cleanup alarm is scheduled for 7 days after the last interaction
- if the alarm fires and the room has no active connections, the persisted state is deleted

So room persistence is soft, not permanent.

## Conflict Model

The server still accepts snapshots in arrival order, but reconnect conflicts are now handled on the client before any overwrite happens.

The effective behavior is:

- the server accepts snapshots in arrival order
- the last accepted snapshot becomes the authoritative room state
- clients apply remote snapshots wholesale once the reconnect state has been resolved
- clients use `updatedAt` and `lastSyncedAt` to detect whether local and room state diverged

Consequences:

- concurrent live edits can still overwrite each other
- field-level merges do not exist
- there is no causal ordering, revision number, timestamp check, or compare-and-swap

This is acceptable for a low-frequency shared scoreboard, but it is not safe for high-contention collaboration.

## Offline Handling

Offline support is primarily local-first, not sync-first.

What works offline:

- the app shell can be installed/cached as a PWA
- the current `GameState` is stored in `localStorage`
- the user can continue editing the score sheet without network access
- the stable room id is also stored locally
- the user can explicitly switch to an offline mode that disables sync entirely

What happens to sync while offline:

- no sync messages are queued durably
- `broadcastState` drops updates if the socket is not open or the initial handshake is not complete
- the app shows `Offline (no changes)` or `Offline (changes)` when sync mode is active but the room connection is down
- explicit offline mode suppresses that banner because the user intentionally chose local-only work

Practical outcome:

- local play continues offline
- offline edits remain only in local storage until a later successful room connection
- if the room is empty, the local offline state becomes the first published snapshot
- if only the local side changed since `lastSyncedAt`, the local state is published after reconnect
- if only the room changed since `lastSyncedAt`, the room snapshot is applied locally
- if both changed, the user must choose which timestamped version to keep

Offline changes are still not merged with remote changes; the app now resolves that divergence explicitly instead of silently discarding the local copy.

## Known Gaps

### Protocol gaps

- No authentication or authorization. Anyone with a room id can join and overwrite the room state.
- No schema validation for inbound sync payloads on the server.
- No protocol version negotiation, despite `GameState.version` existing.
- Revisions depend on client-provided timestamps; the server does not validate them.
- No message ids, acknowledgements, or replay protection.
- No delta sync or compression; every update sends the full state.

### Consistency gaps

- No conflict detection or merge strategy beyond last-write-wins.
- No history or undo on the server.
- Equality checks use serialized JSON shape equality, which is simple but coarse.

### Offline/reliability gaps

- No durable offline outbox.
- No app-level reconnect state machine; `isReconnecting` is exposed but currently fixed to `false`.
- A failed initial connection is only logged; there is no explicit user-facing recovery path besides reconnecting manually.
- Concurrent live edits still resolve as last-write-wins once both clients are connected.

## Bottom Line

The current sync protocol is intentionally minimal and easy to reason about:

- join room
- receive latest full snapshot
- publish full snapshots on every local change
- let the latest server-accepted snapshot win

That keeps implementation complexity low, but the tradeoff is clear: reliability and conflict handling are intentionally shallow, especially for concurrent editing and offline reconciliation.
