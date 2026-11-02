# Automatic character join and window lifecycle, 20 October 2026 / 0.6.26

The user confirms that sync still fails after 0.6.25, in every tested game mode
and with default, Y2K, Spring, Astro, High Society, Bee and Medieval cosmetics.
The launcher also takes too long to recognize a closed game window. Treat this
as an unresolved general sync failure; the 0.6.25 attachment fix did not resolve
the complete user symptom.

## Existing user-run evidence

Four recent runs have the 0.6.25 capture code, logged-in public metadata, a
completed `launcher:character` startup stage, no synchronous startup errors,
and no saved character or character-status message. This includes runs without
mods. The window protocol still says visible in closed runs whose memory helper
reports zero active processes. These files contain no timing measurement of
launcher closure detection or observation of the live session/URL values.

Sanitized read-only findings are in
`outputs/character-join-0.6.26/run-evidence.json`. No account/profile/session
data was edited. In particular, lack of status **does not prove** the live URL
was absent; the user's exact runtime failure has not been reproduced.

## Common join and status path

The old observer silently returns unless `singletons.connectedWebsocketUrl` is
truthy. It never asks the model capture for readiness or publishes a waiting
reason in that branch. The source client also exposes its actual `msgHandler`
and finalized `clientGame`, bound to its engine through `bloxd.client`. Capture
now accepts these observed session objects when the URL is unavailable, requiring
that same engine plus the existing exact local ECS/thin-object ownership. A
preloaded menu engine, unknown session or replay recording remains ineligible.
The actual session object is also the capture identity, so replacement revokes
pending exports even with an unchanged URL/entity/outfit.

The observer delegates join readiness to this common capture check instead of
duplicating the URL gate. Missing engine/account/join/assets and export errors
publish bounded waiting states; stable assets still require two observations.
Account metadata changes clear status deduplication, because the main receiver
clears the previous character status when it receives changed metadata.

The launcher renders escaped waiting/error text and reading progress when no
model is saved. Status-only changes refresh the view; the generic join hint is
used when no running status is available. This adds no manual sync control,
character-menu navigation or game/account action.

Primary source read as static text only:
[Bloxd game bundle](https://bloxd.io/static/js/3ymzdd.8.8ed9ef8f.chunk.js),
SHA256 `7479df45b488688e9492b718e855e2150c12f8f2c6dc294299875892db291058`.
Its `isConnectedToServer` already accepts a message handler as an alternative to
the URL; server finalization creates `clientGame`, and leaving clears it and the
handler. The replay viewer's recording is an explicit exclusion. Exact bounded
excerpts and offsets are in `source-evidence.json` in the output folder above.
The current public index still references the previously audited main bundle.
No public source bundle was executed or an account/browser opened.

## Window closure

The game main process atomically writes an exact-run `closed` window marker on
the actual BrowserWindow closed event, before transport/process cleanup. The
runner retains its window observer after startup (250 ms while running), accepts
only its own run ID, and emits closed once without waiting for the helper's
eventual process exit. Process exit remains the fallback when a marker cannot
be written. Startup closed/error paths clear deadlines and polling. The close
marker itself does not terminate a process or weaken memory enforcement.

The launcher then sends a payload-free local state-change notification to its
own UI, which refreshes state and enables Play without waiting for the existing
two-second metadata interval. A notification during a pending state read queues
a fresh read, preventing stale running state from replacing a completed close.
Late events from an older child cannot clear a newer session. IPC access checks,
the official account flow and game close deadline remain intact.

## Pure verification and limits

303 Node/DOM/VM tests, 37 source syntax files and both generated preloads are
covered by the release verification. Added coverage includes:

- Real observer plus capture/GLB encoder for synthetic default and cosmetic
  fixtures without a websocket URL, exact engine ownership, replay exclusion,
  source-session replacement and metadata/status invalidation.
- The actual generated no-mod preload, serialized into a separate synthetic
  MAIN world, discovering a local model and transferring a validated GLB.
- Closed-window acknowledgement before helper exit, wrong run IDs, early close,
  spawn/exit fallback, deduplication, parent notification and late old-child
  events; all processes/timers are mocks.
- Immediate Play restoration, a close arriving during a pending UI read,
  status-only rendering/escaping and payload-free preload listener cleanup.

Four selected regressions run against the packaged 0.6.25 source all fail in
their expected behavioral assertions; they pass with the changes. Their log is
`regression-before.log`. These are CPU/DOM/protocol proofs, **not** live gameplay
or a visual certification of every cosmetic pack. The user's general failure
and close latency still need confirmation in a user-started 0.6.26 run. If sync
still fails, the now-visible status and new run files identify the remaining
readiness/export stage. No client/account/installer/graphics context was started.
