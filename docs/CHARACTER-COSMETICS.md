# Character cosmetics, 20 October 2026 / 0.6.25

The user subsequently confirms that sync still fails across all modes and
cosmetics. This attachment fix did not resolve the complete symptom. The later
0.6.26 join/status/window work and its limits are documented in
[CHARACTER-JOIN-LIFECYCLE.md](CHARACTER-JOIN-LIFECYCLE.md).

The user reports that the launcher character disappeared after buying High
Society in the browser. Existing user-generated run files report `Player body
groups are not ready.` and contain no saved model in the latest affected runs.
The public cosmetic metadata maps the worn High Society hat to an attached
`highSociety_set_2_attachable` / `HeadMesh` model. The purchase itself is not
reproduced or modified.

## Source and reproduction

The 0.6.24 character walker recursively required `notArmour` on every attached
thin object. The actual Player type has armour strides and defines that group.
Cosmetic attachments are separately instantiated with ordinary strides;
`newObjectType` passes null armour data and `defineType` deliberately does not
create groups for them. This makes one loaded accessory abort the entire export.
The same synthetic accessory regression against the packaged 0.6.24 capture
module produces the observed error. No client/game code is started for the test.

Primary sources previously downloaded as static bytes only:

- [Bloxd cosmetic definitions](https://bloxd.io/static/js/3ymzdd.main.fae4743f.js),
  SHA256 `6b12d908053015f6a54819d7a8c305e49e7ca2ad8fc11296089b8442322fae51`.
- [Bloxd game and thin manager](https://bloxd.io/static/js/3ymzdd.8.8ed9ef8f.chunk.js),
  SHA256 `7479df45b488688e9492b718e855e2150c12f8f2c6dc294299875892db291058`.

Exact bounded excerpts/offsets, plus the same attachment transform contract in
the previously audited q9aot source, are recorded in
`outputs/character-cosmetics-0.6.25/source-evidence.json`. Bundles were read as
text, never evaluated. Run evidence contains only status and the relevant
cosmetic classification, with no login/session information.

## Capture changes

`launcher/character-capture.cjs` keeps mandatory Player body groups and armour
exclusion at the root. Attached objects no longer require Player-only groups.
The source meshAttachments registry identifies worn cosmetic objects; held items
and other gameplay attachments are excluded rather than treated as clothing. A
missing registry with attached models waits for subsequent source initialization.
Each recursive edge must match the object's actual parent object/node and, when
available, the root entity owner. Cycles and excessive object counts fail closed.

The source manager sets an attached object's root enabled bit from its parent,
including first-person body hiding. Capture restores that root for the launcher
pose, while respecting disabled internal nodes. Source poses/visibility are not
changed. Attached-node transforms use the observed local matrix multiplied by
the parent's exported rest transform, matching the source manager's attachment
parent precedence. They do not use stale cached world matrices or import the
cosmetic at its unrelated type origin. Dirty/missing local matrices wait for a
subsequent capture. Nested thin attachments retain the same ownership and pose
rules; existing transform-node attachments keep their world-to-rest remapping.

High Society colour variants use `HueTintMaterialPlugin`. Its observed
`aHueColour` is baked into original asset texture pixels using the source hue,
saturation and value formula, retaining black/white boundaries and alpha. This
reads an asset-decoding canvas, never game pixels. A 256-entry colour palette
avoids per-pixel HSV/trigonometry. Texture variants have separate cache keys,
while identical variants share one image and decode. The outfit signature now
includes hue constants so changes revoke a pending export. Missing/invalid hue
data waits rather than saving a guessed colour. Hit overlays/opacity remain
neutral in the launcher pose.

## Verification and limits

289 pure Node/DOM/VM tests, 37 source syntax checks and both generated preloads
pass. The six added tests cover ungrouped High Society-style attachments,
first-person hiding, stale world matrices, nested/local poses, disabled parts,
root group enforcement, parent/owner changes, cycles, dirty local transforms,
source-registry selection/held-item exclusion, outfit invalidation, tint boundaries/alpha and shared/different texture variants.
The resulting synthetic model also passes the Khronos GLB validator.

All validation uses synthetic geometry and mocked texture decoding. This proves
the capture defect and regression behavior; it does not confirm the user's live
model or every cosmetic type. Skeletal/custom unsupported models remain subject
to the existing refusal/budgets. Automatic join behavior, account ownership,
texture origin checks, original mods, shader performance fixes and native
renderer are preserved. No client, account, installer or graphics context was
started or operated. The user must install the update and join a game to confirm
the automatic model sync and appearance.
