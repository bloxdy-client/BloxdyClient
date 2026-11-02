# Homepage character atlas correction — 0.6.62

The user reports the same visible failure after 0.6.61. That release did not
resolve the problem. The affected new run has the 0.6.61 capture code but reports
`Character atlas layout is not ready.` and writes no new character GLB, so the
homepage continues showing the previous file.

The current public `v4ng2h` source defines material features as data and creates
Babylon plugin wrappers whose `getClassName()` still identifies Lifeform/Armour.
The wrapper stores the feature's values in `featureState`; its shader callback
adapter explicitly supplies that state as `this`. The exporter had read the
wrapper's direct fields, which are now absent. In 0.6.60 it silently embedded
the complete atlas; in 0.6.61 the stricter layout check rejected it.

0.6.62 reads `featureState` for these wrappers and retains the direct-field path
for older plugin instances. Missing/invalid state still rejects capture. The
new regression goes through the actual serialized observer and capture to GLB
with Lifeform and Armour wrappers, checking layer/tile rectangles and tint.
Against the packaged 0.6.61 module, that same regression fails with the exact
observed message; the corrected module completes automatic sync in the CPU
fixture. Original game bundles were inspected as static text only.

Source URL, SHA256, exact offsets and excerpts are recorded in
`outputs/character-atlas-0.6.62/source-evidence.json`, and the differential
failure in `baseline-regression.log`. Live appearance remains unverified; the
user must join a game with the corrected client to replace the old saved model.

## Previous correction and its limits

The user screenshot showed sprite-sheet pixels scattered over the homepage
character. The existing saved GLB was read without modifying account data: its
body geometry was within normal character bounds, while an embedded texture was
the complete 2048×2048 atlas. The exporter had handled Lifeform atlas layers
but omitted the source `ArmourMaterialPlugin` path. It also chose the first
truthy plugin array; an empty `_pluginManager._plugins` could hide a populated
`pluginManager._plugins`.

The exporter now inspects both managers, composes Lifeform layers and crops the
horizontal Armour atlas tile identified by the actual `aAtlasIdx1` instance
value. It applies the observed `aArmourTint` to the exported material color.
Invalid atlas metadata or out-of-range indices abort export instead of saving
another misleading preview. The automatic join signature includes armour tint.
Source plugins, source textures, accounts, sessions and saved character files
are not mutated by this code change.

The pinned Bloxd class bytes previously saved as source evidence show the
Armour shader's horizontal UV rule and tint, and the Lifeform grid rule; their
shader-string contracts are also checked in `launcher/tests/source-material.test.cjs`.
The new synthetic export test checks the actual tile rectangle, tint and
out-of-range rejection; the Lifeform test covers an empty first plugin manager.
No game or client was opened. The old saved GLB is not rewritten; the user must
join a game in the updated client to create a new model. Actual homepage pixels
and cosmetic appearance still require user acceptance.
