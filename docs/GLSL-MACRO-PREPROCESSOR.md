# Bounded native GLSL preparation — 0.6.58

27 October 2026. This adds the next internal loader stage after
[ZIP/folder acquisition and includes](PACK-SOURCES-INCLUDES.md).
`preparePackShader(ownedSources, root, explicitContext)` resolves the complete
virtual include graph, then prepares GLSL in native C++. It returns both the
expanded source and a complete preprocessed result with its source map. No
client or runtime graphics context is needed by this stage.

## Implemented behavior

Object and function macros support argument prescan, nested calls, object aliases
to function macros and replacement rescan. Comments and pp-number tokens keep
their meaning; a float such as `1.0e-3` is not split into macro identifiers.
Backslash-spliced definitions retain physical source line accounting. Conditional
directives cover if/ifdef/ifndef/elif/else/endif, define/undef and defined.
Expressions include signed integer arithmetic, comparisons, logical and bitwise
operators, shifts and ternary selection, with explicit overflow/invalid-operand
rejections. Both logical operands and ternary arms are checked eagerly, matching
the pinned JCPP expression evaluator. An unselected division by zero still fails.

The source must declare its version/profile. `__VERSION__` and `GL_ES` derive
from that declaration, while `__FILE__` and `__LINE__` follow the existing include
resolver's diagnostic map. Macro expansion does not erase generated `#line`
restoration, including when an included branch is inactive. Active literal
version/extension requests are collected into the output header in encounter
order; limited optimize/debug/STDGL pragmas remain in the body. An extension
request records intent and never supplies evidence of GPU capability.

Caller context distinguishes a defined value, known undefined (`nullopt`) and
unknown. Unknown names in an evaluated condition fail preparation. Ordinary
shader identifiers stay literal. Context is copied, not mutated; a failed
preparation cannot install partial output or replace a preceding valid result.
Minecraft version, source option values, OS, driver and hardware macros are not
guessed. Source names cannot redefine built-ins, reserved or GL_ macro names.

This is a deliberate bounded subset. It rejects recursive macros, variadics,
stringification/token pasting, macro-generated defined/directives, function calls
across unspliced logical lines, unary plus or floating/unsigned/suffixed literals
in conditions, negative shifts, arithmetic overflow, unresolved directives,
unknown pragmas and active warnings. Inactive code is not executed. Include
acquisition still happens before conditions, so missing files/cycles cannot be
hidden behind guards. The previous include syntax restrictions remain in force.

## Reference and limits

`tools/audit-glsl-preprocessor.cjs` reads pinned Iris JcppProcessor and
GlslCollectingListener class bytes plus the nested JCPP 1.4.14 evaluator. The
Maven reference Preprocessor.class is byte-identical to the nested class. The
corresponding source archive corroborates eager expression evaluation. No JVM,
JCPP module, Iris module or shaderpack reference code is executed. Evidence and
hashes are in `docs/iris-glsl-preprocessor-reference.json`. No exact Iris release
source tag or full JCPP compatibility is claimed.

Input/output are capped at 8 MiB each; logical lines at 64 KiB, expanded logical
lines at 256 KiB/8192 tokens. There are at most 512 macro facts, 128 KiB stored
macro text, 16384 body tokens, 16 parameters and 32 levels of conditional,
expression, macro and argument work. The work envelope is 32 Mi units; extension
requests are capped at 256. These bound CPU preparation. Existing source proof,
material, frame, GPU and presentation budgets remain unchanged.

## Verification and remaining gates

523 pure Node/DOM/VM tests, 51 syntax files and three generated preloads pass.
The CPU path uses the real ZIP/folder-produced SPK1 fixture, resolves its includes
and prepares both vertex/fragment sources with explicit context. glslang compiles
the resulting pair, a macro-prepared compute source and the preceding production
program sets. Negative include and macro fixtures must fail at source ID 1,
line 2; the latter maps to `macro/bad.glsl:2`. Total: 19 compiler cases, with 17
expected successful sets and two expected diagnostic rejections.

Fifteen common integer conditions and a function/color macro fixture are compared
with glslang `-E`. Three ternary selections are separate CPU cases because
glslang rejects ternary in `#if`, while pinned JCPP supports it. Additional CPU
tests cover aliases, argument prescan, source locations, splicing, ES declarations,
comments, unknown context, arithmetic failures, rejected syntax, limits and
retaining a previous result after failure. This is bounded compiler evidence;
it does not prove arbitrary pack compatibility.

The internal implementation is available to later loader stages. It does not
translate Minecraft/Iris shader inputs, create programs or resources, install a
production graph recipe or activate a pack. Source capture, material mappings,
standard renderer, original mods, accounts and CrazyGames restrictions are
preserved. Authoritative runtime macro producers, broader grammar/assets,
translation/bindings, production activation and user image/FPS acceptance remain
open. `irisContractComplete=false`.

Release evidence: `outputs/glsl-preprocessor-0.6.58/`. Setup/Portable/Update
are byte-checked in `dist-bloxdy-v0.6.58`. All 63 packaged sources (64 including
package.json) and native resources match. Version/lock agree. Against 0.6.57,
only package.json changes in ASAR; all launcher/bridge/mod/texture/account bytes
are preserved. BloxdNative is freshly built; MemoryBudgetRunner is unchanged.
After packaging, independent CPU, 19 compiler cases, the 15-condition/function
macro oracle and MemoryBudgetTests pass. No
client, account, installer, browser or graphics context is started by the agent.

## Subsequent stage

The first bounded GLSL 120 to Core translation is implemented in 0.6.59; see
[legacy translation](GLSL-LEGACY-TRANSLATION.md) for the supported structural
subset and remaining linked-program/binding/production gates.
