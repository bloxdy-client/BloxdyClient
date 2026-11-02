# Litematica visibility investigation, 0.6.51

The user reports that 0.6.50 still shows neither placements nor selection boxes.
This report supersedes the synthetic colour-state acceptance results from
0.6.50. **The visibility bug is not fixed or reproduced in the running engine.**

The actual uploaded vertex bytes, separate attribute locations and perspective
projection were inspected in a pure CPU fixture. A block at the user's saved
placement coordinates produces finite, in-frustum, front-facing triangles;
the selection fill and edge geometry do too. Both zero and shifted world
origins were covered. This checks geometry preparation, not framebuffer pixels,
native occlusion, callbacks in the user's session or actual visibility.
The script and output are under `outputs/visibility-investigation/`.

## User-operated F9 capture

With Litematica enabled, the existing F9 key also requests a snapshot of the
mod's own diagnostics. No console or browser extension is required. The report
is written to the current run's `litematica-diagnostics.json` next to its
`startup-status.json`, below `%LOCALAPPDATA%/BloxdNative/launcher-data/runs/`.
There is no periodic IPC polling and no profile or account write for this report.

The report records bounded counters for source frames, render-group callbacks,
camera/manager acceptance, intermediate stages, visibility readiness, submitted
draw calls and vertex counts. The last draw includes the already-saved native
viewport, depth range, depth function, target category, projection, camera and
world origin. Normal diagnostics do not query the driver.

Only an explicit F9 request additionally checks current WebGL version, linkage,
context loss, depth/output state and the direct-mode uniform. It reads at most
eight pending GL error flags. These flags are labelled **unattributed**: they may
have come from the game, and do not prove an error in the preview. Reading an
error flag consumes it; this inspection runs only on the user's F9 request.
No framebuffer pixels or GPU buffers are read.

The main-process receiver requires its own game main frame, enabled Litematica,
an outstanding F9 request and at most 64 KiB of valid object JSON. It writes a
fixed diagnostic filename and includes the package version. No arbitrary code,
path or command is accepted. Source draw calls, shader literals, depth writes,
capture behavior and placement/selection behavior are unchanged.

474 pure Node/DOM/VM/worker tests and 47 syntax checks pass, including generated
preloads, dormant/requested snapshot transfer, IPC gating, failure handling and
trace distinctions. MemoryBudgetTests pass. No client, account, installer,
graphics context or application was started or operated by the agent. The next
required evidence is a user-created F9 report while the preview is missing.

Setup, Portable and Update 0.6.51 are byte-verified. Compared with 0.6.50,
only `game-preload.cjs`, `main.cjs`, `litematica-direct.cjs` and `package.json`
change in the package. Both native executables, original catalogs, all other
package sources and both preview shader literals are identical. Version and
lock file match. SHA256 sums are in the release folder; the Update matches
the Setup bytes. This is a diagnostic interim build, not a visibility fix.
