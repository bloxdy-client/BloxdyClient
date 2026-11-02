# First bounded GLSL translation stage — 0.6.59

27 October 2026. `GlslTranslation::preparePair` now runs owned pack sources
through virtual includes, the existing macro preprocessor and an initial native
GLSL 120 to GLSL 330 Core translator. It returns complete vertex/fragment text,
source maps and explicit interface/output-location metadata. This is an internal
loader API; program linking, resource binding and game activation remain separate.

## Implemented translation

The structural parser recognizes individual global declarations and simple
typed functions/prototypes, and balances function-body delimiters. It changes
vertex `attribute` to `in`, vertex `varying` to `out` and fragment `varying` to
`in`. Attribute, varying and uniform names/types are recorded without assigning
GPU locations, semantic producers or runtime values. Pair preparation rejects
missing/mistyped fragment varyings and conflicting cross-stage uniform types.

`gl_FragColor` becomes a generated location-0 vec4 output. Each
`gl_FragData[literal]` becomes an explicit vec4 output at the same location. An
original set `{0,2}` stays `{0,2}`; repeated uses share one declaration. These
are shader output locations, not colortex indices or physical texture routes.
Dynamic, compound, multiline and out-of-range indices fail; gl_FragColor and
gl_FragData cannot be mixed. No output value or attachment is invented.

Unambiguous function-body calls to texture2D/texture3D, their Proj variants and
their Lod variants become texture, textureProj and textureLod. Declarations,
overloads, fields, non-call references and collisions with new function names
are rejected. Edits address whole tokens/parsed declarations, not substrings.
All other body text is retained; this is not a complete GLSL type checker.

The prepared source must explicitly declare GLSL 120. Only a literal
`GL_ARB_shader_texture_lod : enable/require` extension request is accepted and
preserved before generated declarations; it is recorded in requestedExtensions
without defining feature macros or proving device support. Other extensions
remain unsupported. [Khronos defines this explicit extension request](https://raw.githubusercontent.com/KhronosGroup/OpenGL-Registry/main/extensions/ARB/ARB_shader_texture_lod.txt). The target
is explicitly GLSL 330 Core; already-resolved `__VERSION__` values and conditions
remain based on the original source version 120. Output declarations precede
the generated source-map marker. Original file IDs/line directives remain
unchanged, so errors in included sources retain their file/line mapping.

## Supported subset and unknowns

Only vertex/fragment pairs are supported. Float/vector/matrix attributes and
varyings, simple typed uniforms, ordinary helper functions and one main definition
per stage are accepted. Interface/global arrays, multiple declarators, structs,
user-defined types, interface blocks, interpolation/precision/layout syntax,
other versions/profiles, other extension requests and unsupported texture
variants fail.

Fixed-function vertices, matrices, colors, lightmaps and other unresolved gl_
built-ins receive no replacement. mc_Entity, vaUV1/2, mc_midTexCoord, at_tangent
and at_midBlock are outside this first translation contract. There is no default
Minecraft identity, light or transform producer. Generated-name collisions fail
instead of capturing source names. Unsupported syntax, mismatched interfaces
and limit failures return no partial pair and cannot replace a preceding result.

Input/output are each at most 8 MiB, with 131072 tokens and 64 nested delimiters.
There are at most 1024 global variables, 1024 function declarations, 256 interfaces
per kind and eight output locations (0..7). Existing source/material/frame/GPU
budgets and production guards are preserved.

## Source evidence and verification

`tools/audit-glsl-translation.cjs` reads the pinned Iris CommonTransformer class
as ZIP/class data, checking its stage qualifiers, gl_FragColor/gl_FragData output
transforms and texture-call names. The full Iris implementation uses an AST;
this adapter deliberately implements a narrower structural subset. No Java,
Iris or shaderpack reference code executes. Hashes and operations are preserved
in `docs/iris-glsl-translation-reference.json`.

527 pure Node/DOM/VM tests, 51 syntax files and three generated preloads pass.
A new real stored ZIP/directory fixture produces byte-identical owned SPK1
snapshots. Native CPU tests decode that snapshot and prepare color and sparse
MRT pairs through includes/macros/translation. Both original prepared GLSL 120
pairs and translated GLSL 330 pairs are compiled/linked by glslang. A deliberately
broken included expression must still fail at source ID 1, line 2, corresponding
to lib/bad.glsl:2. Structural tests cover stage metadata, repeated/sparse outputs,
original-version constants, texture calls, identifier boundaries, rejected source
semantics/ambiguous syntax, pair mismatches, atomic replacement and limits.

An additional pair exercises all six 2D/3D/Proj/Lod call variants in a vertex
shader. This adds seven compiler cases to the preceding 19: six expected
successful program pairs and one expected diagnostic rejection. Total: 26 cases, 23 expected
successful sets and three expected rejections. The 15-condition/function-macro
oracle from 0.6.58 remains in place. Compiler success validates these fixtures;
it does not prove arbitrary shaderpack compatibility, image parity or FPS.

No production graph recipe, GL compilation/resource ownership, source observer,
wire format, account, default renderer or source shader is changed. CrazyGames
still requires Standard Bloxd. Broader translation, authoritative runtime facts,
linked program ownership/reflection/bindings, draw routing, production activation
and user image/FPS acceptance remain open. `irisContractComplete=false`.

Setup/Portable/Update are byte-checked in `dist-bloxdy-v0.6.59`. All 63 packaged
sources (64 including package.json) and native resources match; version/lock
agree. Against 0.6.58, only package.json changes in ASAR; all other launcher,
bridge, mod, texture and account bytes match. BloxdNative is freshly built;
MemoryBudgetRunner is unchanged. CPU, 26 compiler cases, the existing macro
oracle and MemoryBudgetTests pass independently after packaging.

Evidence and final release checks: `outputs/glsl-translation-0.6.59/`. No client,
installer, browser, account or graphics context was started by the agent.

## Subsequent stage

The bounded owned-program compile/link/reflection stage is implemented in 0.6.60;
see [linked pack programs](LINKED-PACK-PROGRAMS.md) for execution, context lifetime,
verification and the remaining runtime binding/production gates.
