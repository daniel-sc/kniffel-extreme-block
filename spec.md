# Kniffel Extreme Block -- Product Specification

A mobile-first web app for tracking scores in **Kniffel Extreme** (a Yahtzee variant). 
Designed for in-person play where one device (or several synced devices) replaces the paper score sheet.

---

## 1. Scoring

### 1.1 Score Sheet Structure

Each player has an independent score sheet divided into two sections.

**Upper section** (6 categories):

| Category | Input   | Scoring        |
|----------|---------|----------------|
| Ones     | numeric | sum of ones    |
| Twos     | numeric | sum of twos    |
| Threes   | numeric | sum of threes  |
| Fours    | numeric | sum of fours   |
| Fives    | numeric | sum of fives   |
| Sixes    | numeric | sum of sixes   |

**Lower section** (16 categories):

| Category          | Input   | Scoring                |
|-------------------|---------|------------------------|
| Three of a Kind   | numeric | sum of all dice        |
| Four of a Kind    | numeric | sum of all dice        |
| Two Pairs         | numeric | sum of all dice        |
| Three Pairs       | fixed   | 35 pts                 |
| Two Threes        | fixed   | 45 pts                 |
| Full House        | fixed   | 25 pts                 |
| Large Full House  | fixed   | 45 pts                 |
| Small Straight    | fixed   | 30 pts                 |
| Large Straight    | fixed   | 40 pts                 |
| Highway           | fixed   | 50 pts                 |
| Kniffel           | fixed   | 50 pts                 |
| Kniffel Extreme   | fixed   | 75 pts                 |
| Under 10          | fixed   | 40 pts                 |
| Over 33           | fixed   | 40 pts                 |
| Chance            | numeric | sum of all dice        |
| Super Chance      | numeric | sum of all dice x 2    |

### 1.2 Input Types

- **Numeric categories**: free-form number input.
- **Fixed categories**: single toggle (achieved / not achieved). When achieved, the fixed point value is scored; otherwise zero.

### 1.3 Strike

Every category (both numeric and fixed) can be **struck**. A struck category scores zero regardless of its entered value. Striking is togglable.
When a category is struck, its input is disabled and visually indicated as such.

### 1.4 Computed Totals

| Total             | Formula                                                  |
|-------------------|----------------------------------------------------------|
| Upper sum         | sum of non-struck upper values                           |
| Upper bonus       | +45 pts if upper sum >= 73                               |
| Upper total       | upper sum + upper bonus                                  |
| Lower sum         | sum of non-struck lower values (applying fixed/x2 rules) |
| **Grand total**   | upper total + lower sum                                  |

Totals are read-only and update live.

---

## 2. Players

- A game has **one or more players**, each with their own score sheet (column).
- The minimum is one player; there is no enforced maximum.
- Each player has an editable **name** (displayed as "Spieler N" when empty).
- Players can be **added** at any time. A player can be **removed** only when more than one player exists (the last player cannot be removed).
- When a player is added, their name field is auto-focused.

---

## 3. Game Lifecycle

### 3.1 New Game (Reset)

Clears all scores and players, starting fresh with a single unnamed player.

### 3.2 Revanche

Starts a new game but **preserves player names in reversed order**. All scores are cleared. This is the intended flow for a rematch.

### 3.3 Accessing Revanche

The revanche action is a secondary action on the reset button:

- **Touch**: long-press (600 ms) on the reset button reveals the revanche button.
- **Mouse**: hovering over the reset button reveals it.
- **Keyboard**: focusing the reset button reveals it.

The revanche button auto-hides after 4 seconds of inactivity. Tapping reset (short press) always triggers a full reset, never revanche.

---

## 4. Persistence

- The entire game state is stored in the browser's local storage.
- The app loads the last saved state on startup.
- Every change (score entry, name change, player add/remove) is persisted immediately.
- Incompatible stored state versions are discarded; the app starts fresh.

---

## 5. Offline & PWA

- The app is installable as a **Progressive Web App** (standalone, portrait).
- The service worker caches the app shell and assets for full offline use.
- All scoring functionality works without any network connection.
- External fonts are cached for offline use.

---

## 6. Real-Time Sync

### 6.1 Rooms

Sync happens through **rooms**. A room is identified by a random ID (UUID).

- Each browser stores a **stable room ID** that persists across sessions.
- Opening a shared link with a `?room=<id>` parameter overrides the stored room ID permanently.
- Users can manually **join an existing room** by entering its ID.
- Users can **generate a new room ID** to leave the current room and start a fresh one.
- Generating a new room does not affect the old room or its other participants.

### 6.2 Sync Mode

The app operates in one of two modes:

| Mode    | Behavior                                                |
|---------|---------------------------------------------------------|
| Sync    | Connects to one room; sends and receives state updates. |
| Offline | No connection; all changes are local-only.              |

The user can switch between modes at any time. The chosen mode persists across sessions.

### 6.3 Connection Lifecycle

When sync mode is active:

1. The app connects to the room via WebSocket.
2. The server sends the room's current state (or null if the room is empty).
3. The app reconciles local and remote state (see 6.5).
4. After reconciliation, every local change is broadcast to the room.
5. Every incoming remote change replaces the local state.

A 10-second timeout applies to the initial connection attempt.
When the connection is lost, the app automatically retries with exponential backoff.

### 6.4 State Transfer

- The **full game state** is transferred on every change (no deltas).
- The server stores exactly one snapshot per room (the latest).
- The server forwards incoming state to all other connected clients (no echo to sender).
- Identical states (by content) are not re-applied locally.

### 6.5 Reconnect Conflict Resolution

When reconnecting to a room, the app compares three timestamps to determine what changed:

| Local changed? | Room changed? | Resolution                                    |
|----------------|---------------|-----------------------------------------------|
| No             | No            | No action needed.                             |
| No             | Yes           | Room state is applied automatically.          |
| Yes            | No            | Local state is kept and published to the room.|
| Yes            | Yes           | **Conflict**: user must choose.               |

"Changed" means the state's revision differs from the last successfully synced revision. The last synced revision is tracked **per room** and persists across sessions.

**Special case**: if the local state has never been edited (pristine), the room state is accepted without conflict, even when there is no prior sync baseline.

**Conflict dialog** presents:
- Local version timestamp.
- Room version timestamp.
- Last synced timestamp.
- Two choices: "Keep local and sync" or "Keep room version".

While a conflict dialog is open, incoming remote updates refresh the room-side option to stay current, but no state is applied or broadcast.

### 6.6 Joining a Different Room

When a user joins an existing room (by ID or link), the local state is **replaced** by the room's state. There is no conflict prompt -- joining a room is an explicit choice to adopt its state.

When joining via a `?room=` link, the parameter is removed from the URL (without a page reload) after it has been applied.

### 6.7 Concurrent Live Edits

When multiple clients are connected and editing simultaneously, there is **no merge**. The last state received by the server wins. Clients apply each other's full state on arrival. This means concurrent edits to different fields can still overwrite each other.

**Outdated update detection**: when a client receives a remote state whose revision is older than the client's last synced revision, the updates have crossed on the wire. The remote state is still applied (last-write-wins), but a **toast notification** informs the user that their last edit was overwritten by a concurrent change. The user can then re-enter the overwritten value.

This detection is **asymmetric**: in a two-player scenario, only the player who edited second sees the toast. The player who edited first receives a newer-looking update and cannot distinguish it from a normal remote edit. In practice this is sufficient — the notified player re-enters their edit on top of the other player's state, producing a combined state that is broadcast to both players.

### 6.8 Presence

Connected peers are tracked per room. The server notifies all clients when a peer joins or leaves. Peer identities are anonymous transport-level session IDs, not user accounts.

When the same client reconnects (e.g. after a tab reload), the server closes the stale prior connection for that client to prevent duplicate presence.

### 6.9 Room Expiry

Rooms are cleaned up automatically after **7 days of inactivity** (no connections and no messages). An active room resets this timer on every interaction.

---

## 7. Offline Banner

When the app is in **sync mode** but the connection is down, a banner is displayed:

- **"Offline (no changes)"** -- the local state matches the last synced state.
- **"Offline (changes)"** -- local edits have been made since the last sync.

The banner is hidden when explicitly in offline mode (the user chose to work offline).

---

## 8. Sharing & Sync UI

### 8.1 Sync Dialog

Accessed via the users/group icon in the header. Provides:

- Current connection status.
- Current room ID (read-only, copyable).
- Copy share link (URL with `?room=` parameter).
- Generate new room ID.
- Join room by entering an ID.
- Toggle between sync and offline mode.

### 8.2 Connection Indicators

- The sync button shows a **badge** with the count of other connected peers (or a spinner while connecting).
- The dialog shows a textual connection status.

### 8.3 Game Export (Share)

A separate share button exports the game result via the **Web Share API** as a `.nutsaboutstats` file:

```json
{
  "game": "<configurable game name>",
  "players": ["Alice", "Bob"],
  "Bonus": { "Alice": true, "Bob": false },
  "Points": { "Alice": 150, "Bob": 120 },
  "Starting Player": "Alice",
  "Winner": "Bob"
}
```

- The **game name** is configurable via a settings dialog (accessed by long-press / hover on the share button). The configured name persists across sessions.
- The share button is **disabled** when the browser does not support file sharing (desktop browsers). A tooltip explains this.
- The starting player is the first player in the list; the winner is the player with the highest grand total.

---

## 9. UI Layout

- **Header** (fixed top): app title, sync dialog button, share button, reset button.
- **Player management section**: editable name fields, add/remove buttons.
- **Score table**: grid of categories (rows) x players (columns).
  - Player names row is sticky at the top.
  - Grand total row is sticky at the bottom.
  - Category labels are sticky on the left.
  - The table scrolls horizontally when there are many players.
- The **entire UI is in German**.

---

## 10. Known Gaps

These are known limitations of the current state, not planned features.

1. **No authentication**: anyone with a room ID can join and overwrite the room state.
2. **No field-level merge**: concurrent edits are resolved as full-state last-write-wins, not per-field.
3. **No offline outbox**: if the connection drops mid-edit, the change is only in local storage, not queued for delivery.
4. **No undo/redo**: score entries cannot be undone other than by manually re-entering values.
5. **No game history**: completed games are not stored; resetting discards all data.
6. **No server-side validation**: the server accepts any JSON payload without schema checks.
7. **No protocol versioning**: the state model has a version field, but it is not negotiated during sync.
8. **No dice roller**: the app is a score tracker only; dice are rolled physically.
