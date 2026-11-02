# Pack files and GLSL includes (0.6.57)

The next internal loader component reads an explicitly supplied local ZIP or
pack directory into owned text data, then resolves native GLSL include sources.
`minecraft-packs.readSources(absolutePath)` exposes the shipped reader. It does
not download, extract, install, select or activate a pack. The existing search,
download metadata, profile selection and renderer activation paths are unchanged.

## Local acquisition

`launcher/shader-pack-files.cjs` reads classic single-disk stored/deflated ZIPs,
including signed/unsigned data descriptors. It validates central/local filenames,
flags, sizes, descriptor agreement and nonoverlapping indexed local ranges.
Selected source bytes must decompress to the declared size and match CRC32;
trailing deflate data is rejected. ZIP64, encryption, alternate Unicode ZIP-name
extras, unsupported compression, symbolic/special entries and path aliases fail.
Nothing is extracted to disk. Binary asset payloads are not decoded or claimed
CRC-verified by this text stage; their archive metadata is bounded and validated.

Directory input rejects symlinks/junctions, hard links and special entries. File
identity/size/timestamps are checked at inventory, before/during reads and again
before returning; directories are rechecked too. Source handles are closed on
every path. This detects changes around reading; it does not claim OS-wide
atomic filesystem locking. The returned text copy is owned and immutable even
after the underlying input or a returned snapshot Buffer changes.

Exactly one `shaders/` root is required, at archive/folder root or beneath one
wrapper directory. Absolute/traversing/control/device paths, case-aliased
components, duplicate entries and file-parent conflicts fail. Source keys use
canonical, case-sensitive ASCII paths relative to `shaders/`; wrapper names may
be UTF-8. Selected extensions are glsl/inc/vsh/fsh/gsh/csh/tcs/tes/properties/txt.
Other files are not silently decoded as shader text. Selected text must be valid
UTF-8 with no unsupported controls; an initial UTF-8 BOM is normalized, with raw
and normalized SHA256 values recorded separately.

The reader returns frozen path/manifest data, `read(relativeName)` and
`snapshot()`; every snapshot call returns a separate Buffer. `SPK1` is an
internal length-delimited text-copy format, not BND1 or a source-frame proof.
`PackSources::decode` independently validates all lengths, counts, UTF-8,
canonical paths and tree aliases before returning a `shared_ptr<const
PackSources>`. It cannot read host files. Failed preparation returns no partial
source set or material table and leaves a previously installed object intact.

## Virtual includes

`IncludeResolver::expand(sources, rootName)` expands canonical quoted
`#include "..."` lines. Relative names resolve against the including file's
directory. `/lib/...` starts at the virtual shaders root, and `..` is permitted
only while the resolved path remains inside that root. No disk fallback or
network lookup occurs. File lookup is case-sensitive in both input modes.

The pinned Iris class audit in `docs/iris-pack-includes-reference.json` confirms
that include resolution and cycle detection precede other preprocessing.
Accordingly, missing includes and cycles are rejected even behind `#if 0` or
include guards. Repeated acyclic includes are retained; guards are not evaluated
or used to invent an include-once policy. The original conditional and macro
text remains for the later GLSL preprocessing stage.

Root `#version` ordering is preserved. Included, duplicate or misplaced version
directives fail. The adapter generates deterministic file IDs and `#line`
markers, restoring the parent's next physical line after each include. These
IDs are the adapter's diagnostic mapping, not a claim of identical Iris IDs.
The result owns expanded text, a source-path map and dependency records.

The supported subset rejects include macros, angle paths, trailing include
comments, continued directives, includes inside block comments, inline-comment
prefixes before include directives, authored `#line`, unterminated comments and
file-ending line continuations. It does not claim arbitrary Iris/JCPP grammar
parity or repair unsupported source syntax.

## Bounds and integration

ZIP input is capped at 128 MiB, 4096 indexed entries, 128 MiB declared expanded
size and 16 MiB per archive/folder file. Selected source text is at most 1 MiB
per file and 16 MiB total, with 512-byte paths, 32 path levels and 16384 virtual
tree nodes. The text-copy envelope is at most 20 MiB. Include expansion is capped
at 32 file levels, 8192 visits and 8 MiB output. These are separate bounded CPU
loading limits; existing source proof, material table, frame/GPU budgets and
freshness guards are unchanged.

`preparePackMaterials(sources, explicitContext)` reads the snapshot's
`block.properties` through the existing bounded properties preprocessor and
immutable BlockIdMap. Missing requested property files fail explicitly; there
is no implicit legacy-ID table. All eleven existing material Capture scenarios
now use a real ZIP/directory-derived text snapshot for initial world/shadow CPU
table preparation. Material replacements retain the preceding raw-properties
path and existing lifetime/cache/failure checks. All 59 material roots and their
unknown states, including Water/Lava level consensus, are preserved.

No new client IPC/run protocol, source observer or default graph recipe is
installed. The new reader is bundled as a callable pack-service API, while
`src/main.cpp` and page preloads never automatically acquire or activate it.
Accounts, original mods, textures, production shaders and view distance are
preserved. CrazyGames still requires Standard Bloxd.

## Bounded verification

520 pure Node/DOM/VM tests and 51 syntax files/three preloads pass. ZIP stored,
deflate and descriptor forms agree byte-for-byte with directory text snapshots;
source/metadata corruption, CRC/UTF-8 errors, aliases, links, changes during reads
and size limits are exercised. A separate System.IO.Compression.ZipArchive
fixture verifies ingestion against an independent writer.

Native CPU tests decode the actual generated snapshot, resolve absolute and
parent-relative includes, preserve repeated includes and version/source maps,
reject missing/cyclic/escaping/unsupported graphs, enforce limits and retain old
objects after failure. The existing production pipe and 250 ms source guards
are unchanged. The four pinned Iris classes are read as ZIP/class data only;
no Java, Iris/JCPP module or game bundle executes.

The compiler verifier now runs CPU fixture generation first, then compiles the
14 existing programs plus one include-expanded vertex/fragment pair. A separate
negative compile case must fail at source ID 1, line 2, corresponding to
`lib/bad.glsl:2`. Thus there are 16 compiler cases: 15 expected successful sets
and one expected diagnostic rejection. Stale generated include files cannot
make a failed CPU run pass.

Evidence: `outputs/pack-sources-0.6.57/`. This is source preparation and compiler
evidence, not live rendered pixels, shaderpack playback or FPS acceptance.
GLSL macro preprocessing/translation, broader grammar/assets, authoritative
runtime context/reference inputs, production graph activation and user image/
FPS acceptance remain open. `irisContractComplete=false`.

## Release verification

Setup/Portable/Update are byte-checked in `dist-bloxdy-v0.6.57`. All 63 ASAR
sources (64 including package.json) and both native resources match; version/lock
are synchronized. Against 0.6.56 only the new reader, its pack-service export,
package.json and intended native binary differ. The graph, protocol, property
preprocessor, existing material resolver and production shader hashes match.
Final CPU, 16 compiler cases and MemoryBudgetTests pass independently after
packaging. Source/expanded-source fixtures, hashes and independent ZIP proof are
preserved with the release evidence. No client, account, browser, installer or
graphics context was started, and no real profile was changed.

## Subsequent stage

The bounded GLSL macro stage is implemented in 0.6.58; see
[GLSL macro preprocessing](GLSL-MACRO-PREPROCESSOR.md) for its supported subset,
reference evidence, verification and remaining translation/activation gates.
