# Material properties preparation (0.6.56)

This internal loader increment connects raw `block.properties` text and explicit
macro facts to the existing immutable `BlockIdMap`. The callable entry point is
`shaderloader::prepareBlockMaterials(source, context)` in
`src/shader_loader/material_loader.hpp`. It returns the prepared text, counters
and a fully parsed material table. Only a successful result can be assigned to
`IrisPlan::blockIds`; any preprocessing or material-parse exception leaves the
caller's previously installed table and context unchanged.

This is executable source code and CPU draw-path integration, not production
shaderpack activation. It does not read a ZIP/folder, translate or link pack
programs, install a graph recipe, or load a pack in a running client.

## Reference and explicit context

The audit reads the pinned Iris 1.11.7+26.3 artifact as ZIP/class bytes. It also
reads its nested `jcpp-1.4.14.jar`: `addMacro(name)` supplies literal `1`.
Iris's ordinary property text is processed by JCPP; the presence of its warning
collector is not an exemption from token macro replacement. Backslashes are
protected before CPP lexing. The supporting public
[PropertiesPreprocessor source](https://raw.githubusercontent.com/IrisShaders/Iris/671a5c87747d33983d7ed659461a64f46dfcb1f0/common/src/main/java/net/irisshaders/iris/shaderpack/preprocessor/PropertiesPreprocessor.java)
is hashed separately and does not establish an exact release source tag.
`tools/audit-properties-preprocessor.cjs` records these facts in
`docs/iris-properties-preprocessor-reference.json`. No Java/JCPP/reference code
is executed; this bounded implementation does not claim full JCPP parity.

Each `PropertyMacro` supplies either literal replacement text or known undefined
(`nullopt`). `PropertyMacro::boolean(name, enabled)` maps a true option to `1`
and false to known undefined. An explicitly empty replacement remains an empty
object macro, distinct from that boolean helper. In conditional expressions a
name absent from the context is **unknown**, and aborts preparation. This is a
deliberately stricter caller-provenance rule than JCPP's undefined-name default.
No game version, platform, hardware, world or shader option is guessed or queried.
Tests use explicitly supplied fixture macros; production context acquisition is
a separate open gate.

## Supported execution

- Nested `#if`, `#ifdef`, `#ifndef`, `#elif`, `#else`, `#endif`; active object
  `#define` / `#undef`. Inactive bodies do not execute includes or definitions.
- `defined`, parentheses, unary `!`, `+`, `-`, comparisons, equality, `&&`, `||`.
  Decimal, hexadecimal and octal literals fit the signed 64-bit subset.
- Recursive **expansion of acyclic** object macro references retains token
  precedence; replacements are not wrapped in invented parentheses.
- Ordinary property key/value identifier tokens also expand defined macros.
  Literal names absent/undefined in the macro table remain literal. PP-numbers,
  protected property-escape identifiers and simple strings/comments are not
  expanded as macro references. Java property escapes and ordinary multiline
  selector continuations remain for `BlockIdMap` to decode.
- Trimmed nonblank lines, ordinary property comments, line-local directive
  comments and CRLF/CR/LF input are handled. Errors identify the physical line.

For example, with explicitly supplied `MC_VERSION=260300`:

```properties
#define MATERIAL_ID 31
#define MATERIAL water
#if MC_VERSION >= 260300
block.MATERIAL_ID=MATERIAL
#else
block.32=stone
#endif
```

prepares `block.31=water`. It resolves a pack ID for supported Water registrations
through the existing all-level consensus. It does not establish Water level=0.
The `MC_VERSION` value here is example input, not a detected runtime fact.

Active includes/imports, function macros, cycles, generated `defined`, continued
or quoted directives, multiline C comments, escaped property string literals,
hash/token pasting and arithmetic/bitwise/shift/ternary expressions are rejected.
Unknown conditional context, malformed nesting, unsupported active directives
and existing material-parser failures return no partial table. Tags, comma
selectors, layers and legacy mappings retain their existing unsupported status.

## Limits and isolation

Input/output text each has a 256 KiB limit. There are at most 256 macro facts,
64 KiB macro text, 16 KiB trimmed source lines, 4 KiB expression text, 4096
expanded expression tokens, 32 conditional/primary-expression levels, 16 macro
expansion levels and 1 Mi work units. These bound transient CPU preprocessing;
the existing material-map/proof/GPU budgets are unchanged. All local state is
released on success or failure. There are no filesystem, network, subprocess,
page API, renderer-start or GPU operations in either new loader header.

The default renderer, source capture/wire, source semantic unknowns, production
shader literals, existing 59-root material table, view distance and account/mod
paths are preserved. The render-graph header only includes the new preparation
API; its graph execution body is unchanged. CrazyGames still requires Standard.

## Verification and remaining gates

511 pure Node/DOM/VM tests, 50 syntax files and three preload variants cover the
reference-byte/scope/freshness gates. Native CPU tests exercise property text
and macro decisions, key/value substitution, literal/escape boundaries, macro
precedence, numeric forms, known undefined versus unknown, inactive bodies,
malformed inputs, resource limits, immutable reloads and prior-table retention.
All eleven existing material Capture scenarios now install their initial and
replacement tables through raw conditional properties, reaching world/shadow
draw bindings with their existing cache/lifetime/failure checks. The native
freshness verifier includes both new headers and the new CPU test header.

Two post-package CPU runs exposed the old test helper's assumption that one poll
must complete every transaction. Production `Pipe::poll` deliberately yields
after 4 ms or 96 packets. The CPU helper now drains progress with at most 16
polls per bounded write, retaining its complete-transaction assertion and
failing on truncated data or exhausted progress. A three-packet test with slow
callbacks checks ordered, complete, exactly-once delivery across budget yields.
Production `bridge_protocol.hpp` and its 4 ms/96-packet limits are hash-identical
to 0.6.55; the 250 ms source freshness guard is unchanged. Failed logs are kept.

No live pixels, pack-program execution or FPS are established. ZIP/file-tree
acquisition, GLSL include/preprocessing/translation, broader property grammar,
authoritative runtime context, remaining source/reference inputs, production
recipe activation and user-operated image/FPS acceptance remain open.
`irisContractComplete=false`. Evidence: `outputs/properties-loader-0.6.56/`.

## Release verification

0.6.57 adds explicit ZIP/directory text acquisition, native snapshot decoding
and virtual GLSL includes; see [PACK-SOURCES-INCLUDES.md](PACK-SOURCES-INCLUDES.md).
The property grammar, macro-context policy and existing material mappings remain
unchanged. GLSL macro processing and production activation are still separate.

Setup/Portable/Update are byte-checked in `dist-bloxdy-v0.6.56`. All 62 ASAR
source files (63 including package.json) and both native resources match the
workspace; version/lock are synchronized. Against 0.6.55 only package.json and
BloxdNative.exe change in the distributed application. Graph execution bytes,
apart from the new header include, and the existing material resolver match the
previous source hashes. Final native CPU/14 GLSL/MemoryBudgetTests pass
independently after packaging. `distribution.json` and `SHA256SUMS.txt` record
artifact hashes. No client, browser, account, installer or graphics context was
started and no real profile was changed.
