# No Ads — 0.6.33

The optional **No Ads 1.0.0** mod is available under a profile's **Mods &
Resource Packs → Mods → EZ Mods**. Install and enable it, then start the profile.
It supports both standard and experimental renderer profiles. Existing profiles
and account data are not modified by the update or build.

This implements the requested visual fallback: known advertising surfaces use
`display:none`, zero dimensions, hidden overflow and disabled pointer events,
all `!important`. The generated preload inserts this package's stylesheet at
Electron's **user** CSS origin, so page styles and inline author declarations
cannot make those surfaces visible or clickable again. CSS applies to late
insertions and class/ID changes without observers, polling or frame work.

The saved public source `outputs/renderer-source-audit/public-main.js` contains
the exact Bloxd hosts `AdBanner`, `AdBannerContainer`, `AdBannerLoader`,
`AdBannerRemoveAds`, `AdBannerRemoveAdsHost`, `BloxdAdContainer`,
`HomePageAdContainer`, `LoadingOverlayRightAdBannerContainer`, `SuperRankAd`,
`CosmeticPackAd`, `GenericVideoWrapper`, `GenericVideoInner` and `GamAdCountdown`.
Additional explicit common advertising SDK slots and vendor iframe URLs are
covered. There is no broad `ad`/`banner` substring rule on arbitrary UI nodes.
Game canvas, loading screen, settings, upload UI and login frames are preserved
in the synthetic DOM checks. The source snapshot is evidence for these names,
not proof that every current or future ad provider is covered.

React nodes remain mounted. The mod does not cancel ad requests, skip timers,
mute cross-origin ads, simulate completion or award rewards. Hidden video ads
may still play audio and normal ad waits may remain. Full removal and current
live coverage have not been verified; only the user may run the client.

`launcher/builtin-mods/no-ads.css` is the maintained source;
`node launcher/build-builtin-catalog.cjs` updates only the built-in catalog
package and its catalog entry. The full catalog builder also includes it.
The original three mod packages and their independently recorded hashes stay
unchanged. The packaged mod is versioned and checksum-checked through the
existing mod installation path. Disable applies on the next profile start.

Verification uses only Node, a synthetic DOM, inert Electron stubs and package
byte inspection. The generated preload tests check opt-in behavior, the real
catalog/package integrity, both renderer configurations and user-origin CSS.
DOM tests cover existing/late ad nodes and preserved non-ad controls.
