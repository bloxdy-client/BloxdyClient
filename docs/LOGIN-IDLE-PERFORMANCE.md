# Login and idle performance — 0.6.36

User report, 21 October 2026: sign-in stalls after entering the password with
every provider. Severe periodic game freezes occur specifically with Litematica,
including when no schematic is loaded. A previous performance release is not
evidence that these reported freezes were solved.

## Litematica without a schematic

The previous generated mod connected its renderer immediately and repeated
connection discovery every 500 ms. Its UI maintenance also requested a connection
every second. Empty rows prevented drawing, but did not prevent discovery,
source render callbacks, or partial structural discovery retries. A saved EZ
Building setting could request native hotbar integration without a model.

The SHA-checked source adapter now supplies an explicit work predicate to the
renderer. No active model, visible pinned placement or selection task means no
renderer discovery. The renderer disconnects its own scene callbacks and frees
its own existing graphics resources when becoming idle. A selection outline
needs actual selected bounds before activating the renderer; Stick controls
remain active while the selection task is selected. The UI's world maintenance
is gated on the same need for a world. EZ Building requires an active model.

Menu installation, file import, keyboard shortcuts and the saved library remain
available. Timers still check the small predicate so import, pinned views,
selection, disable/enable and scene changes can resume work. Existing visible
schematic capture, upload budgets, draw settings and shader text are unchanged.

The CPU fixture loads the real 0.6.35 adapter from its ASAR and compares the
current source over 120 synthetic half-second ticks, with no schematic. Both
retain all 120 original world draws. See `cpu-comparison.json` in
`outputs/login-performance-0.6.36/` for discovery and sample counts. These are
inert call counts, not a measurement of game FPS or the user's five-second
freezes. Generated-preload DOM tests separately verify idle timers, enabled EZ
Building with no model, menu availability, selection activation and return to
idle. CPU lifecycle tests cover resource cleanup and reactivation with geometry.

## Sign-in and common launcher work

The account observer stops its definition subscription as soon as its required
objects have been discovered, instead of retaining it for more than 30 scans
(about a minute). Queued account getter callbacks do no work after discovery or
page teardown. Account-only windows do not create a character capture object.
Gameplay keeps the existing two-second public-account/model-check cadence.

Account-only public metadata checks and parent update reads use a 250 ms cadence.
A changed public account sends the launcher its existing state notification,
avoiding an additional wait for the two-second UI poll. Account-only windows do
not collect game performance metrics. This reduces Bloxdy's own recognition
delay after official sign-in completes. It does not alter the provider's
password submission, request, callback, session, navigation or security checks,
and does not establish the cause of the reported password-stage delay.

The common definition host builds observer snapshots only when subscriptions
change, instead of allocating a list of all subscriptions for each source
property definition. Nested definitions retain snapshot semantics; an old
release callback cannot remove a later subscription that reused its name.

Repeated unchanged public account deltas no longer rewrite launcher state.
Changed identity/cosmetics and logout still invalidate character data; legacy
screenshot cleanup remains. This avoids synchronous state writes on subsequent
character-status/mod deltas, which include the unchanged account metadata.

The user's latest startup report also contains
`webFrame.insertCSS(...).catch is not a function` for No Ads. CSS insertion now
normalizes the returned value with `Promise.resolve`, accepting both a
synchronous insertion key and a Promise. Synchronous and asynchronous failures
still appear in the existing startup report. No Ads CSS itself is unchanged.

## Verification boundaries

Only source edits, Node/DOM/VM tests, CPU memory-budget tests, builds and package
byte inspection are used. No client, account, browser, graphics context or
installer is started or operated. Original mod packages, quality values,
renderer binaries and source shader literals are checked against 0.6.35.

Real sign-in time, actual frame drops and the appearance of rendered overlays
remain for user verification. This release makes no universal performance,
FPS or freeze-free claim. The broader experimental Iris renderer remains
unfinished (`irisContractComplete=false`).
