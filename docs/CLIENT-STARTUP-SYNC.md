# Launcher mod startup and character sync, 20 October 2026

The subsequent general sync failure and window-closure work in 0.6.26 are
documented in [CHARACTER-JOIN-LIFECYCLE.md](CHARACTER-JOIN-LIFECYCLE.md). Actual
user sync remains unconfirmed; earlier isolated defects were not a complete fix.

The later 0.6.25 cosmetic capture fix is documented in
[CHARACTER-COSMETICS.md](CHARACTER-COSMETICS.md). It addresses the subsequently
recorded `Player body groups are not ready.` error for ungrouped attached models.
The original missing-mod-menu symptom remains unconfirmed in a real user run.

The user reports enabled Visual Shader and Litematica mods with neither menu
appearing, and automatic character sync no longer completing.

Read-only inspection of existing run files found both empty mod plans and an
older combined shader/Litematica preload. Some joined runs report `Waiting for
your player model.` No existing preload-error or script-startup diagnostics were
available. The empty plans do not explain the user's explicitly confirmed case
with both mods enabled. Do not treat that case as a proven profile-selection
mistake or claim the missing menus have been reproduced.

## Proven character adapter defect

The previous character adapter requires `Fn.mY`, `Qw`, `Dw`, and component `rw`.
The previously audited q9aot source uses `vy.NY`, local entity `bY`, and humanoid
component `qY`. Public static source read on 20 October uses `ff.mS`, local
entity `Vw`, and humanoid component `ow` instead. The old path cannot resolve
these actual local-player models.

The adapter now reads the local entity assignment from the engine constructor,
uses the named `humanoidMesh` ECS component, and requires the thin manager's
`getEntityId()` to match that local entity. It accepts exactly one owned Player
object, including thin object zero. Other players, preview rigs and ambiguous
managers remain unavailable. The previous explicit layout remains supported.
Only own data properties are inspected at bounded object depth; no mesh lists
are scanned and no player/menu/simulation state is changed.

An asynchronous export must retain the same manager, component, local entity,
thin object, engine, connection, outfit signature and current public metadata
provider. Replaced components/managers revoke pending and previously saved
signatures. Geometry/signature failures now produce a waiting status instead of
being silently swallowed. Existing rest-pose, armour exclusion, GLB validation,
account ownership, texture/geometry budgets and automatic join behavior remain.

Static primary sources, downloaded as bytes only (never evaluated):

- [Bloxd main bundle](https://bloxd.io/static/js/3ymzdd.main.fae4743f.js), SHA256 `6b12d908053015f6a54819d7a8c305e49e7ca2ad8fc11296089b8442322fae51`.
- [Bloxd game bundle](https://bloxd.io/static/js/3ymzdd.8.8ed9ef8f.chunk.js), SHA256 `7479df45b488688e9492b718e855e2150c12f8f2c6dc294299875892db291058`.
- [Bloxd settings bundle](https://bloxd.io/static/js/3ymzdd.15.3e86942e.chunk.js), SHA256 `64b61ec9df7036fd2dbed20bde7f88cce3a0b715ac7bf95149232e148944383b`.

Exact bounded text evidence and offsets are in
`outputs/mod-sync-debug/source-evidence.json`. These static reads do not access
an account, start a browser/client or execute Bloxd code.

## Mod startup containment and evidence

The generated preload previously aborted all remaining setup on any uncaught
synchronous injection exception. Launcher host, observer, textures, profile
storage and individual main/isolated mod scripts now have separate exception
boundaries. Another enabled mod continues after a failed injection. Original
catalog packages and their independent hashes remain unchanged.

The generated preload reports requested modules, completed script stages and
bounded startup errors to the owning game process. The receiver checks the
actual main frame, current profile and enabled module set, then writes
`startup-status.json` only inside that run directory. Electron preload errors
are saved separately as `preload-error.json`. These describe script execution,
not a claim that graphics effects or menu interactions succeeded. No tokens,
cookies, account sessions or profile preferences are copied into these reports.

The actual generated combined preload is executed in two synthetic JS worlds
with a synthetic DOM matching the observed nested settings sidebar. Both real
mod menus appear, with no graphics context or network. An injected exception
in the shader runtime stage is reported and does not prevent Litematica or the
shader settings menu from starting. This is a regression test for containment,
not reproduction of the user's missing-menu failure.

The first user-started 0.6.23 run still needs to confirm menu visibility and
automatic GLB sync after joining. If menus remain absent, the new run reports
will distinguish an empty mod plan, preload failure and individual injection
failure. No live success or complete resolution of the mod symptom is claimed.
