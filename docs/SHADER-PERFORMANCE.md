# Visual shader: action stutter investigation

## 20 October 2026, client 0.6.24

The user still reports severe frame drops while hitting mobs and opening menus,
and requests general FPS improvements. Recent user-generated runs contain the
Visual Shader with no recorded synchronous startup errors. There is no new F9
measurement or agent gameplay/profile. Live frame-time improvement remains
unverified.

Three further costs are removed in `launcher/shader-performance.cjs` and the
shared allocator in `launcher/shader-adapter.cjs`:

- Ordinary game settings only receive the Shader tab. The full shader control
  tree is constructed offscreen on explicit Shader selection, retained after
  closing the category, and reused across replaced menus. Inactive controls
  are detached and skip full UI synchronization. Original controls, values,
  callbacks and effects remain available. The generated combined preload DOM
  test checks no shader controls on ordinary menu opening, all controls after
  selection, and exact node reuse after native category changes/menu replacement.
- Shadow membership observes the source scene's own mesh-added/removed events
  while sun shadows are enabled. An unrelated hit helper updates the cached
  count without iterating the scene. Real caster additions/removals invalidate
  immediately, including pending terrain. The 250 ms rediscovery and count-based
  fallback remain for missed or unsupported events. Callbacks do not throw into
  source mesh operations; scene changes, disabled shadows and disposal remove
  only this adapter's observers. A 1,000-helper regression performs zero
  whole-scene membership iterations between ordinary discovery deadlines.
- Native sampler values are initially read, then maintained from observed
  `uniform1i`/`uniform1iv` calls. The cache handles location aliases, array
  elements, source offsets/lengths, and copies caller values before buffers can
  change. Equal assignments do not force allocation again. Unknown/invalid
  writes still read the driver; link generations and context restoration
  invalidate observations. A real generated bootstrap/allocator running on a
  CPU GL state model needs one initial native sampler read across 1,000 changing
  assignments, where the prior valid one-location path reread on every change.
  This is an API-operation count, not a GPU-time or FPS measurement.

Sampler offset/length and current-program rules follow the
[Khronos WebGL 2 specification](https://registry.khronos.org/webgl/specs/latest/2.0/).
The adapter forwards original call arguments and return values. It introduces
no GPU buffers, source geometry copies, shader formula changes, quality/range
reductions or native renderer changes. All catalog hashes remain unchanged.
The updated launcher also adapts already-installed verified shader packages.

283 pure Node/DOM/VM tests, 37 syntax files and both generated preload syntax
checks pass. The existing tests retain texture completeness, sampler collision
avoidance, static/moving shadows, pending geometry, water/lava deformation,
native lighting and fallback behavior. Reports and distribution checks are in
`outputs/performance-0.6.24/`. No client, account, installer or graphics context
is started by verification. World appearance and actual combat/menu FPS must
still be checked by the user.

## Previous investigation, 19 October 2026

The user reports severe stutter on mob hits, menu opens and chunk entry. These are live user observations. No agent gameplay or live profiling was performed. The changes address demonstrated repeated adapter work; they do not establish that every reported hitch has been eliminated.

## Changes

- `launcher/shader-adapter.cjs`: scene mesh-count changes previously bypassed the 250 ms shadow registry cache. Every helper insertion could enumerate model variations, attachments, all meshes and mutable terrain positions again. On a count change, a membership check now distinguishes existing/new/removed scene casters from unrelated helpers. Only real caster changes trigger the complete rebuild immediately. Discovery still runs every 250 ms, including visibility/material/attachment transitions. Pending chunks are included immediately and retain the existing complete-shadow-map guard. Weak keys retain no removed helper meshes.
- The shared sampler allocator retains sampler descriptors until the program is relinked. Native sampler assignments still invalidate allocation and are read again before choosing free units. Ordinary uniform reflection is no longer repeated for each assignment revision. Relinks/context loss still invalidate descriptors. The old shadow-specific reflection list was unused after sampler allocation became shared and has been removed.
- `launcher/shader-world-adapter.cjs`: water/lava classification, shoreline generation, depth and underwater attributes repeatedly read identical block coordinates during one synchronous chunk preparation. A local read cache shares up to 8192 floored-coordinate results across those consumers. Additional coordinates fall through to the original reader, with no dropped work. Null/zero remain distinct results. Each preparation creates a fresh cache; no values survive an edit/upload. Loaded checks retain their original behavior.

The original catalog, shader formulas, quality settings, native renderer, source simulation and render distance are unchanged. There is no new shaderpack execution or Iris-completeness claim. `managedSource` applies the fixes to the verified shader snapshot, including an existing installation when used with this updated client build. Previously packaged clients cannot acquire source changes by restarting alone.

## Verification

`node launcher/verify.cjs`: 259 pure Node/DOM/VM tests pass, 35 source syntax checks, standard/native generated preload syntax, original mod hashes verified. Report: `outputs/launcher-verification/verification.json`.

The new regressions exercise:

- 100 added damage helpers and their removal without rereading terrain positions or replacing the cached registry. New unreadable terrain and removal of an actual mob still rebuild immediately; periodic discovery remains active. Existing render-path tests also cover pending chunks during projection changes and immediate removal of the final mob silhouette.
- A program with 202 active uniforms and 50 native sampler assignment revisions: reflection stays at 202 calls before relink, instead of 10,302 calls. Native occupied units are still excluded on every revision; relink rediscovers the modified layout. This counts CPU-mocked API operations and is not a measured FPS improvement.
- Water/lava preparation reads each tested voxel once, retains both liquid kinds, and uses fresh changed block values on the following preparation, removing the previous wave grid when its blocks cease to be liquid. Existing tests retain mixed-atlas stone identity, native packed light, shore pins and liquid physics.

Only JS adapter behavior changed, so no additional shader compile or native rebuild was required. Packaging compiles no application session and does not run installers. Separate test output: `dist-bloxdy-v0.6.19-shader-performance` (version remains 0.6.19).

Both installer and portable have been built. `node launcher/check-package.cjs dist-bloxdy-v0.6.19-shader-performance` verified 43 packaged source files against current source, identical native resources, and absence of private/development folders. SHA-256 hashes are in the package folder's `SHA256SUMS.txt`. Verification reports are retained in `outputs/shader-performance/verification.json` and `distribution.json`. Neither executable was started.

## User verification

Use the separate updated test build. In the same world/settings, check repeated mob hits, inventory/menu open-close and movement across chunk boundaries. Check shadows and liquid shores as well as frame pacing. F9 can save a measurement if stutter persists; F8/F9 and all game actions are performed solely by the user. No visual acceptance or live frame-time improvement is yet established.
