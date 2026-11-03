# Client 0.6.48

23. Oktober 2026, 0.6.48 fertig: Nutzerpraezisierung zu Profiltexten: Titel Profiles wiederhergestellt, kleine Profilanzahl entfernt. YOUR LAUNCHER und Untertitel bleiben ausgeblendet. Unnoetige CSS-Regel fuer die alleinstehende Anzahl entfernt. Diese Klarstellung ersetzt die Titelentfernung/Anzahlbeibehaltung aus0.6.47. 453 reine Tests/43Syntax/beidePreloads/MemoryBudgetTests bestanden;Setup/Portable/Update unter dist-bloxdy-v0.6.48 bytegeprueft,50Quellen ohne package/51mit passend,Version/Lock synchron. Gegen0.6.47 nur ui.js/style.css/package.json anders;alleanderenPaketquellen/beideNativeEXEs/Originalkataloge bytegleich. Litematica-/Auto-Save-/HUD-Fixes aus0.6.47 erhalten. Keine Client-/Account-/Installer-/Grafikstarts/Profilmutation/Uploads;Liveoptik offen. Nachweise outputs/profile-heading-0.6.48/.

## Previous 0.6.47

23. Oktober 2026, 0.6.47 fertig: Profilseiten-Ueberschrift Profiles und Untertitel Your setups. Each one its own world. entfernt; YOUR LAUNCHER standardmaessig auf Launcher-Seiten ausgeblendet. Profilanzahl/Kontenauswahl erhalten. Save bei aktivem Auto-Save und bereits gespeicherter aktiver Vorlage deaktiviert, nach Speicherfehler weiter Retry moeglich; gilt Build/Paste und reagiert auf Einstellung. Litematica-HUD nur bei aktiver Sitzung (Websocket oder Handler/Game), zugehoerigem Enginekontext und vorhandener ChatInput-Spielflaeche; Replay ausgeschlossen. Lobby/Homescreen und Verlassen verbergen HUD sowohl Build/Paste als auch Save area. Nur passive Quell-/DOM-Abfrage, keine Clientbedienung. 453 reine Tests/43 Syntax/beide Preloads/MemoryBudgetTests bestanden. Setup/Portable/Update bytegeprueft,50Quellen ohne package/51mit passend,Version/Lock synchron. Gegen0.6.46 nur UI/Styles/Menuadapter/package anders;Originalkataloge/beideNativeEXEs/anderePaketquellen bytegleich. Keine Client-/Account-/Installer-/Grafikstarts/Profilmutation/Uploads. Reale Optik/Join-Leave-Abnahme offen. Nachweise outputs/profile-copy-0.6.47/.

## Previous 0.6.46

Neuimporte erhalten exakt den Dateinamen ohne abschliessendes .bloxdschem (Gross-/Kleinschreibung der Endung egal), vor Auswahl/Auto-Save. Bestehende gespeicherte Namen bleiben erhalten. Saved-Text/Icon gruen #63d471, Not saved rot #ff7070, Icons currentColor; Status rechts neben dem Pfeil durch 2.5rem statt nativer 6em Innenabstand. 452 reine Tests/43 Syntax/beide Preloads/MemoryBudgetTests bestanden. Neue Regression fuer abweichenden eingebetteten Namen, mehrteiligen Dateinamen/gemischte Endung, gespeicherten Namen, Farben und CSS-Abstand. Keine Client-/Account-/Installer-/Grafikstarts/Profilmutation/Uploads, reale Optik offen.

Setup/Portable/Update unter dist-bloxdy-v0.6.46 bytegeprueft, 50 Quellen ohne package.json/51 mit passend, Version/Lock synchron. Gegen 0.6.45 nur litematica-menu.cjs/package.json anders; beide NativeEXEs/Originalkataloge/andere Paketquellen bytegleich. Adaptiert nur litematica.js anders, Renderer/Shader unveraendert. Nachweise outputs/litematica-filename-0.6.46/; irisContractComplete=false.

## Vorheriger Stand 0.6.45

451 reine Node-/DOM-/VM-Tests,43Syntaxdateien/beide generiertenPreloads und
MemoryBudgetTests bestanden. Zwei neue Regressionen pruefen Layer-Above/Below
mit inklusiver Grenze, sichtbare begrenzte Layercontrols und Single-only-AutoLayer;
Materials/Settings-Schrift400, rechts/unten-Chevrons trotz geerbter Rotation,
und alle Info-SVG-Pfade gegen die gepinnte Shaderquelle. Beide scheitern gegen
die vor der Aenderung gesicherte adaptierte0.6.44-Quelle. Vorhandene Speicher-,
Import-,Material-,Lock- und Preloadpruefungen bestehen.

Nachweise: outputs/litematica-layers-0.6.45/. Kein Client-/Account-/Installer-/
Grafikstart,keineProfilmutation/Uploads. Keine reale Ingame-Optik behauptet.

Finale Paketbytepruefung bestanden:50Quellen ohne package.json/51mit exakt,
Version/Lock synchron0.6.45/beideNativeRessourcenpassend/keineprivatenOrdner.
Setup/Updatebytegleich. Gegen0.6.44 nur menu.cjs/package.jsonanders;imadaptierten
Mod nurlitematica.js. Renderer/Shader/Originalkataloge/anderePaketquellenbytegleich.
Nachweise distribution.json/change-scope.json;Pruefsummen imReleaseordner.

## Vorheriger Stand 0.6.44

449 reine Node-/DOM-/VM-Tests,43Syntaxdateien/beide generiertenPreloads und
MemoryBudgetTests bestanden. Sieben neue Regressionen fuer Select Schematic,
Load/Save/Remove-Freigaben, Inline-Speicherstatus mit Icons, nativen Dateiimport,
Save und simuliertes Neuladen, persistente Auto-Save-Option/ungueltige Importe,
Quota-/Bibliothekslimit, Retry, verzoegerte/doppelte Saves/neue Auswahl,
veraltete offene Dropdowns und selektives Remove. Alle sieben scheitern gegen
die vor der Aenderung gesicherte adaptierte0.6.43-Quelle.

Nachweise: outputs/litematica-library-0.6.44/ mit Tests,Vorhervergleich,
Quellhashes und Buildlog. Ausschliesslich synthetische DOM/JS-Welten und
Dateibytepruefungen,keine Client-/Account-/Installer-/Grafikstarts,Profilmutation
oder Uploads. Reale IndexedDB-/Ingame-Anzeige bleibt Nutzerabnahme.

FinalePaketbytepruefung bestanden:50Quellen ohne package.json/51mit exakt,
Version/Locksynchron0.6.44/beideNativeRessourcenpassend/keineprivatenOrdner.
Setup/Updatebytegleich. Gegen0.6.43 nur menu.cjs/package.json anders,adaptiert
nurlitematica.js;Renderer/Shader/Originalkataloge/anderePaketquellen bytegleich.
KeepVersion-Neubau enthaelt beide finale Placeholderbreitenkorrekturen,
Vorbuildlogs und Fixture-Reihenfolgefehltest behalten. Pruefsummen imRelease.

## Vorheriger Stand 0.6.43

442 reine Node-/DOM-/VM-Tests, 43 Syntaxdateien, beide generierten Preloads und
MemoryBudgetTests bestanden. Neuer DOM/CSS-Test liest die echte gepinnte
Shader-Modquelle fuer Hauptschalter, Kategorieheader und Eingabemasse.
Prueft gemeinsame Felder in Build/Paste/Save area, Tastaturumschaltung,
3.2rem-Eingabehoehe, +/−, Uploadabstand, Schematics und drei gleich breite
Buttonspalten. Bestehende Import-/Load-/Paste-/Lock-/Materialtests bestehen.
Nachweise: outputs/litematica-polish-0.6.43/.
Keine Client-/Account-/Installer-/Grafikstarts, Profilmutation oder Uploads.
Keine Ingame-Pixelgleichheit oder Gameplay-/FPS-Behebung behauptet.

Paketpruefung bestanden:50Quellen ohne package.json/51mit passen exakt,
beide Native-Ressourcen identisch,keine privatenOrdner,Setup/Update bytegleich.
Gegen0.6.42 nur litematica-menu.cjs/package.json anders;Version/Lock synchron.
Im adaptierten Mod nur litematica.js anders,Renderer/Shader/andereModdateien
bytegleich. Finalnachweise distribution.json und change-scope.json imRelease-
Nachweisordner;SHA256SUMS.txt unter dist-bloxdy-v0.6.43/.

## Vorheriger Stand 0.6.42

441 reine Node-/DOM-/VM-Tests,43Syntaxdateien/beidePreloads undMemoryBudgetTests
bestanden. Native Bloxd-Styles ersetzen die eigene Litematica-Gestaltung.
Close-/Rotationspfeile entfernt, Rotation hat genau vier Dropdownwerte.
Drei neue Tests fuer Rotationsdropdown/Lock, Upload-Klick/Tastatur/Drag/Aktiv
und CSS-Vergleich gegen native Gegenstuecke aus gehashten oeffentlichen Quellen.
Uploadmasse/Seitenpadding/Bevels/Inputschrift/Dropdowns/Checkboxen/Slider
rein perDOM/CSS geprueft; keine Ingame-Pixelgleichheit behauptet.

Quellennachweise/Tests/Buildlogs: outputs/litematica-native-design-0.6.42/.
Referenzquellcode ausschliesslich als Text gelesen, nicht ausgefuehrt.
KeineClient-/Account-/Installer-/Grafikstarts/Profilmutation/Uploads.
Finale Paketbytepruefung nach erneutem Bau desselben Releases bestanden:
50Quellen ohne package.json/51mitpackage passen,Version/Locksynchron,
NativeRessourcen exakt,keineprivatenOrdner,Setup/Updatebytegleich.
Gegen0.6.41 nurMenuadapter/package.jsonanders,alleRenderer-/Modpaket-/Account-
undanderenPaketquellen/beideNativeEXEs bytegleich. Zwischenpaket vorletzter
Zahlenfeldfontkorrektur ersetzt; alterVergleich alsNachweis erhalten.

## Vorheriger Stand 0.6.41

438 reine Node-/DOM-/VM-Tests,43Syntaxdateien/beidePreloads undMemoryBudgetTests
bestanden.13neueMenue-/Previewtests fuer die Nutzervorgabe, zwei alteMenuechecks
an neue Beschriftungen/Tabbedienung angepasst. NativeDateiimport, explizitesLoad/
Paste mit Positionserhalt, Checkboxhilfen, +/-Koordinaten/Lock, Singlelayer,
Materialhaken/Reset/Counts/Inventar, Previewfilter undHashgrenze geprueft.

50Paketquellen ohne package.json/51mitpackage passen,NativeRessourcen exakt,
Version/Locksynchron,Setup/Updatebytegleich. Gegen0.6.40 nurPerformanceadapter/
package.jsonanders,Menueadapterneu. BeideNativeEXEs/Originalmods/Kataloge/
VorschauShaderliterale/Account-/Bridgepfade unveraendert. Nachweise:
outputs/litematica-menu-0.6.41/,docs/LITEMATICA-MENU.md.
KeineClient-/Account-/Installer-/Grafikstarts/Profilmutation/Uploads. Keine
Ingame-Optik-/FPS-/Placeabnahme oderGesamtbehebungderNutzerbugs behauptet.

## Vorheriger Stand 0.6.40

425 reine Node-/DOM-/VM-Tests,42Syntaxdateien/beidePreloads undMemoryBudgetTests
bestanden. Fuenf neue Statuscommit-Regressionen scheitern gegen den echten
0.6.39-ASAR-Code; der injizierte EPERM-Stack entspricht dem Nutzerscreenshot.
Aktuell bestehen Rename-/Tempwrite-/Diagnostikfehler, letzterCommit/neusteDeltas,
Backoff/Reset, EIO/F9, Close/Timerfreigabe und Accountidentitaetswechsel.
Keine Live-Dateisperre/Verursacheridentifikation oder Wiederholungsfreiheit belegt.

49Paketquellen/nativeRessourcen passend,Version/Locksynchron,Setup/Updatebytegleich.
Gegen0.6.39nur main.cjs/package.json anders; beideNativeEXEs und anderePaketquellen
bytegleich. Nachweise outputs/client-status-write-0.6.40/,
docs/CLIENT-STATUS-WRITES.md. KeineClient-/Account-/Installer-/Grafikstarts,
Profilmutation/Uploads; Renderer/Iris-Gesamtziel bleibt offen.

## Vorheriger Stand 0.6.39

420 reine Node-/DOM-/VM-Tests,42Syntaxdateien/beidePreloads,BridgeCpuTests,
14GLSL-Compile-/Linkprogramme undMemoryBudgetTests bestanden.40Treppenformen
an512Subzellzentren gegen Referenzmodelle und tatsaechliche Quellmeshtemplates,
32Tuerorientierungen gegen Referenzmodelle geprueft; nur Text/ZIP/JSON/Classbytes.
Alle400Treppen-/32Tuerzustaende der erlaubten Familien samt Gegenbeispielen
rein nativ geprueft. Neue synthetische echteCapture-/Pipe-/Welt-/Shadowfixtures
fuer Treppen/Tueren, unbekannte Powerwerte/Konsens/Verwerfen/Ablauf/Fehlercommit.
Nachweise outputs/shaped-materials-0.6.39/,docs/SHAPED-BLOCK-MAPPING.md.
Keine Client-/Account-/Installer-/Grafikstarts/Profilmutation oder Live-FPS-/
Bild-/Gesamtkompatibilitaetsbehauptung. Gesamtrenderer/Produktionsrezept offen.

Finales Paket:49Quellen/nativeRessourcen passend,Setup/Updatebytegleich,
Version/Locksynchron,gegen0.6.38nurpackage.json/NativeEXEanders;
sechsProduktionsshader/MemoryBudgetRunner/Originalkataloge bytegleich.
Ein CPU-Parallelrun zurPaketierung verwarf einen synthetischen Lichtframe als
stale. Der unabhaengige Abschlusslauf nachBuild bestand; Ursache nicht belegt,
250ms-Schutz unveraendert. Fehlversuch als native-verification-during-packaging
separat dokumentiert. Keine Live-FPS-/Bildabnahme.

## Vorheriger Stand 0.6.38

416 reine Node-/DOM-/VM-Tests,42 Syntaxdateien,beide generierten Preloads,
MemoryBudgetTests und verlinkte ES300-Vorschau-VS/FS-Compilerpruefung bestanden.
15 neue Regressionen pruefen nativen Rechtsklickfluss, asynchrone Hotbarwechsel,
Ausnahmen/Guards/Abbruch sowie fehlende Weltgruppen, Frameabbruch und Tiefenwerte.

Vergleich mit echtem0.6.37-ASAR: asynchronerHotbarwechsel0->1nativerPlace-Aufruf,
gehalteneGeste bleibtbisLoslassen/nativesDown+UpstattnurUp. Bei ausfallenderGruppe0
2->12Vorschauframesueber12synthetischeFrames. Keine Grafik oder Live-FPS gemessen.
Details docs/LITEMATICA-STABILITY.md,Nachweise outputs/litematica-stability-0.6.38/.
Keine Client-/Account-/Installer-/Grafikstarts/Profilmutation;Nutzerabnahme offen.



Release0.6.38: Setup/Portable/Update fertig und bytegeprueft;49Paketquellen/nativeRessourcen passend,keineprivatenOrdner,Setup/Updateidentisch,Version/Locksynchron. Nur3Litematicaadapter/package.json anders;nativeBinaerdateien/Originalkataloge/Qualitaetsdefaults erhalten. Pruefsummen unterdist-bloxdy-v0.6.38/SHA256SUMS.txt,Nachweise outputs/litematica-stability-0.6.38/. Nichts installiert/gestartet/hochgeladen.

## Historischer Client 0.6.37, 21. Oktober 2026

401 reine Node-/DOM-/VM-Tests,42 Syntaxdateien,beide generierten Preloads und
MemoryBudgetTests bestanden. Sieben neue Regressionen pruefen stetigen
Meshfortschritt trotz weiterer Statusaenderungen, unveraenderte Zeilensnapshots,
hoechstens zwei offene Generatoren und Abschluss aller32Gruppen, zusammengefasste
Flaechen, Uploadfreigabe sowie Kameragrenzen/ausstehendeKameraauftraege mit
sofortigen expliziten Einstellungs-/Transformationswechseln.

Vergleich mit echtem0.6.36-ASAR:96synthetischeFrames0->11Meshcommits bei47->0
Statusabbruechen; Kameragrenzen260Abrufe/max1von4Chunks/keinAbschluss->erster
Abschlussnach7Abrufen/alle4Chunks.32x1x32Flaeche4->1Gruppen/16->6Quads/7->4
Overlay-/Compositedraws. Keine Grafik oder Spiel-FPS gemessen, Nutzerabnahme offen.
Nachweise outputs/litematica-recovery-0.6.37/,Details docs/LITEMATICA-RECOVERY.md.
Keine Client-/Account-/Installer-/Grafikstarts oder Profilmutation.

Release0.6.37 bytegeprueft:49Paketquellen/nativeRessourcen passend,Setup/Update
identisch,keineprivatenOrdner. Gegen0.6.36 nurzweiLitematicaadapter/package.json
anders,beideNativeEXEs/Originalkataloge/Shaderliterale/Qualitaetsdefaults bytegleich.
Version/Locksynchron,Pruefsummen unterdist-bloxdy-v0.6.37/SHA256SUMS.txt.

## Historischer Client 0.6.35, 21. Oktober 2026

386 reine Node-/DOM-/VM-Tests,42 Syntaxdateien,beide generierten Preloads und
frische MemoryBudgetTests bestanden.17 neue Regressionen pruefen Place inklusive
des nachgestellten alten internen Enterfehlers, native Lade-/Pastefolge, Rechte,
Clipboardkorrelation/Timeout, Chattext, Button/Weltwechsel, Farbwechsel, begrenzten
Nahindex, faire Mesharbeit, Uploadfehlerretry, Ressourcenfreigabe und Menue.

CPU-Vergleich gegen echten 0.6.34-Adapter aus dem bisherigen ASAR: Aenderung der
Zielzelle hinter20.000anderenZeilen nach300synthetischenms->im ersten Scan;
lokalerMeshupload6912->5184Bytes,1->2Arbeitsgruppen. Keine Grafik oder FPS gemessen.
Die zweite Weltaufnahme bleibt und mehr Drawgruppen koennen GPU-Kosten erhoehen.

Release Setup/Portable/Update bytegeprueft:49Paketquellenpassend,beideNativeEXEs und
Originalkataloge bytegleich zu0.6.34,Setup/Updateidentisch,keineprivatenOrdner.
Version/Lock synchron0.6.35. Nachweise outputs/litematica-overhaul-0.6.35/;
Details docs/LITEMATICA-INTERACTION.md. Keine Client-/Account-/Installer-/Grafikstarts
oder Profilmutation. Live-Place/FPS-/Glitchabnahme bleibt Nutzerpruefung.

## Historischer Client 0.6.28, 20. Oktober 2026

328 reine Node-/DOM-/VM-Tests,39 Syntaxdateien,beide generierten Preloads und
MemoryBudgetTests bestanden. Litematica: Parsergebnisgleichheit und Timerabbruch,
244RLE-Bereiche fuer7.995.392 Bloecke, begrenzte Uploads mit altem Commit bis zum
Abschluss, wiederverwendete VAOs, volle Tiefenaufloesung im konservativen
Capturebereich, Farbbedarf/Scissorschnitt/Quellzustand/Fehler/Naheebene und Budget
bei gefilterten Zellen geprueft. Keine Client-/Account-/Installer-/Grafikstarts,
keine Profilmutation. Kein gemessener FPS-/vollstaendiger Dropfreiheitsnachweis.
Details docs/LITEMATICA-LOADING.md, Nachweise outputs/litematica-loading-0.6.28/.

Release0.6.28:46 Paketquellen bytegleich, beide nativen Ressourcen identisch,
keine privaten Ordner. Setup/Update identisch186823389 Bytes SHA256
d55413cb505f0a9650ce07835ff548ea474468fcc1f2a61ec1334b08472f4ab6;
Portable186670601 Bytes SHA256
a4eb89743c25c05adfc21a9a9a3c77e4678c501a3656387df123d36b7cd53e57.
Nur gebaut/gelesen, nicht ausgefuehrt/installiert/hochgeladen.

## Historischer Client 0.6.27, 20. Oktober 2026

316 reine Node-/DOM-/VM-Tests,38 Syntaxdateien,beide generierten Preloads und
MemoryBudgetTests bestanden. Litematica-Tests verwenden den echten geprueften
Katalogcode und eine inerte JavaScript-GL-Attrappe. Ueber600 Frames verschwinden
bei korrekten/Offscreenvorlagen600 unnoetige Weltwiederholungen; sichtbare Vorlagen
behalten die volle Aufnahme. Blockaenderungen, Layer-/Fehlersichtbarkeit,
Indexschnitte, wachsende Ansichten, gemeinsames Budget und UI-Wiederverwendung
geprueft. Keine Live-FPS- oder allgemeine Dropfreiheitsbehauptung.

Keine Client-/Account-/Installer-/Grafikstarts, keine Profil-/Sessionmutation.
Originalmodpakete und Shader-/Native-/Syncpfade bleiben erhalten. Details in
docs/LITEMATICA-PERFORMANCE.md; aktuelle Paketnachweise unter
outputs/litematica-performance-0.6.27/.

Release0.6.27:45 Paketquellen bytegleich, native Ressourcen identisch, keine
privaten Ordner. Setup/Update identisch186819371 Bytes, SHA256
2150c7baf9996e9911387804a5ac037b980a3199d902323bcd57b5d963416c93;
Portable186666580 Bytes, SHA256
6b36aebd694d7669ef68cc1a4356f19d66ff25af7b65b0c6a5d6ac3e6ec31bb5.
Nur gelesen, nicht installiert/gestartet/hochgeladen. Gegen0.6.26 nur
adapters.cjs,litematica-performance.cjs und package.json im Paket geaendert.

## Historischer Renderer 0.6.21, 19. Oktober 2026

264 reine Node-/DOM-/VM-Tests, BridgeCpuTests, elf GLSL-Compile-/Linkpruefungen
und MemoryBudgetTests bestanden. Echte Type33/v2-Capturebytes fuer gemischte
Flaechen, Submesh-/Dreiecksremapping und Blockjobwechsel gelangen ueber
fragmentierte anonyme CPU-Pipes bis zu den tatsaechlichen Welt-/Shadowcallbacks
mit GL-Attrappen. Geprueft: RGB, bekannte Null, unbekannte Greedyflaechen,
exakte Indexoffsets/Anzahlen, stale Uploadsequenzen, Abdeckungs-/Gueltigkeitsfehler,
gepoolte Blockarrays, Freigabe, Shader ohne Emissionskonsument, kombinierter
Quelllicht-/GPU-/CPU-Partikelpfad und Fehler/Ablauf ohne Historiencommit.

Defaultadapter/Main/Preload/GamePreload/Presenter/Transport gegen Arbeitsbeginn
bytegleich. Originalmod-Hashes und bestehende Ressourcenbudgets erhalten.
Keine Client-/Browser-/Account-/Grafikstarts; native Anwendung nur kompiliert.
Keine Bild-/FPS-Abnahme oder vollstaendige Shaderpackkompatibilitaet behauptet.
Details: docs/SOURCE-EMISSION.md, outputs/source-emission-verification.json und
outputs/per-face-emission/. Alte MSVC-Warnungen bestehen weiterhin.

Release 0.6.21 unter dist-bloxdy-v0.6.21 nur gebaut/gelesen: 43 Quellen bytegleich,
native Ressourcen identisch, keine privaten Ordner. Setup und Update bytegleich;
Pruefsummen in SHA256SUMS.txt, Bericht outputs/per-face-emission/distribution.json.
Kein Installer ausgefuehrt, kein Upload und keine Installation.

## Historischer Stand 0.6.19, 15. Oktober 2026

219 reine Node-/DOM-/VM-Tests, erweiterte BridgeCpuTests und elf GLSL-Pruefungen
bestanden. Native Anwendung nur kompiliert. Neue CPU-GL-Tests pruefen Sparse-
Outputrouting (31), Main/Alt/Flip-Aus, persistente/typisierte Clears, Mipketten,
Integerfilter, Feedback, physische Limits, ungueltige Deskriptoren, Teilallokation,
Resize, Freigabe und gemeinsame 512-MiB-Grenze. Der echte native eingebettete
Pass-/Resolvepfad wird mit GL-Attrappen geprueft, einschliesslich Historienbedarf,
fehlender Gueltigkeit, Fehler in Effekt und finalem Resolve ohne Historiencommit.
Defaultpfad ohne Zusatzressourcen/Draws, stabile Groessen ohne neue Queries.

Main/Preload/Capture/Presenter/Transport gegen 0.6.18 bytegleich. Berichte:
outputs/launcher-verification/verification.json,
outputs/native-renderer-verification/glsl-verification.json,
outputs/native-renderer-verification/mode-isolation.json und
outputs/shader-audit/glsl-verification.json.

Keine Client-/Browser-/Account-/Grafikkontextstarts. Keine echten Pixel/FPS,
keine TAA-/Packausfuehrung oder komplette Iris-Kompatibilitaet nachgewiesen.
Gesamtauftrag bleibt offen; Abschlussgates in docs/MINECRAFT-RENDER-CONTRACT.md.

0.6.19 separat unter dist-bloxdy-v0.6.19 paketiert, nur als Dateien geprueft:
39 Quellen bytegleich, native Ressourcen identisch, keine privaten Ordner.
Installer 186.746.060 Bytes, Portable 186.593.259 Bytes; beide Authenticode
NotSigned. SHA256SUMS.txt im Releaseverzeichnis; Paketbericht in
outputs/launcher-verification/distribution.json. Eigener MemoryBudgetTests-
CPU-Helfer erneut bestanden. Keine Pakete/Clients gestartet oder installiert.

## Historischer Stand 0.6.18

219 reine Node-/DOM-/VM-Tests, erweiterte BridgeCpuTests und elf GLSL-Pruefungen
bestanden. Die neuen CPU-GL-Attrappen pruefen Quell-/Ziel-FBOs, Texturformate,
Groessen, Drawmarker und Frame-IDs fuer bedarfsgesteuerte Welthistorie. Keine
realen Pixel, GPU-Ausfuehrung oder FPS gemessen.

Abgedeckt: keine Allokationen/Farbkopien ohne Konsument, HDR-Weltfarbe nach
Transparenz/vor Hand, opake 32F-Tiefe statt spaeter veraenderter Szenentiefe,
passende Kamera-/Motionframes, Pingpong ohne Sampling-Feedback, unveraenderte
Buffer/keine neuen Limitqueries, Deaktivierung/Freigabe, teilweise fehlerhafte
Aktivierung und Resize, Gesamtbudget 512 MiB sowie kein Historiencommit bei
Kopie-/Compositefehlern. Fallback/Resume, Resize, Tiefenkonvention, bekannte
Originrebases, neue Szenen und Nullviewport explizit geprueft. Kein TAA aktiviert.

Berichte: outputs/launcher-verification/verification.json,
outputs/native-renderer-verification/glsl-verification.json und
outputs/shader-audit/glsl-verification.json. Native Anwendung nur kompiliert.
Main/Preload/Capture/Presenter/Transport gegen 0.6.17 bytegleich, Bericht:
outputs/native-renderer-verification/mode-isolation.json. Keine Client-/Browser-/
Account-/Grafikkontextstarts. Originalmodule, Sichtweite 10 und Schutz erhalten.
Der vollstaendige Minecraft-/Iris-Renderer ist nicht fertig; Quellenabdeckung,
Referenzsemantik/-stufen/-puffer und nutzerbediente Bild-/FPS-Pruefung fehlen.

0.6.18 separat unter dist-bloxdy-v0.6.18 paketiert und nur als Dateien geprueft:
39 Quellen bytegleich, native Ressourcen identisch, keine privaten Ordner.
Installer 186.739.641 Bytes, Portable 186.586.856 Bytes; beide Authenticode
NotSigned. Pruefsummen im Release-SHA256SUMS.txt, Paketbericht in
outputs/launcher-verification/distribution.json. Kein Paket gestartet oder
installiert; vorherige Releases unveraendert erhalten.

## Historischer Stand 0.6.17

219 reine Node-/DOM-/VM-Tests, erweiterte BridgeCpuTests und elf GLSL-Pruefungen
bestanden. Zwei neue Launcherregressionen: Standardpreload ohne experimentelle
Capture-/Presenter-/Native-IPC-Quellen; Standardspiel ohne nativen Transport oder
native Pixelberechtigung. Ausschliesslich Node/VM mit Attrappen/Temporaerdateien.

Neue native Motion-CPU-Pruefungen: letzte erfolgreiche Objektmatrix, Kamera-
bewegung, Origin-Rebase ohne falsche Bewegung, mehrere Posepakete vor einem
Frame, GPU-Snapshotlayout, ausbleibende unveraenderte Uploads, Normal-only,
NaN ohne Historienmutation, neue/veraenderte unbekannte Thin-Slots, Licht-/Atlas-
only, unsichtbar/wiederkehrend, Pause/Resume, Resize, geaenderte Tiefenkonvention,
fehlgeschlagenes Composite ohne Historiencommit, Budgeterschoepfung/-erholung,
Speicherfreigabe und keine Weltbewegungsdaten in anderen Passes. Sechs Ziele,
60-Byte-Pixelbudget und Resize-Rollback getestet. Kein TAA oder Pixelvergleich.

Berichte: outputs/launcher-verification/verification.json,
outputs/native-renderer-verification/glsl-verification.json und
outputs/shader-audit/glsl-verification.json. Native Anwendung nur kompiliert;
Dateiabgleich gegen 0.6.16 fuer Launcher/Main-Preload/Capture/Presenter/Transport:
outputs/native-renderer-verification/mode-isolation.json, alle bytegleich.
kein Client/Browser/Account/Grafikkontext gestartet/bedient. Default-Renderpfad,
Capture/Presenter, Originalmodule, Sichtweite 10 und Schutzbudgets erhalten.
Kompletter Minecraft-/Iris-Renderer und Bild-/FPS-Gleichheit weiter offen.
0.6.17 separat unter dist-bloxdy-v0.6.17 paketiert und als Dateien geprueft:
39 Quellen bytegleich, native Ressourcen identisch, keine privaten Ordner.
Installer 186.738.214 Bytes, Portable 186.585.420 Bytes; beide Authenticode
NotSigned. SHA256SUMS.txt im Releaseordner und Paketbericht
outputs/launcher-verification/distribution.json. Kein Paket ausgefuehrt oder
installiert; vorherige Releases erhalten.

## Historischer Stand 0.6.16

217 reine Node-/DOM-/VM-Tests, erweiterte BridgeCpuTests und elf GLSL-Pruefungen
bestanden. Neu: echte Ramptextur/Remap, Subtract/Multiply/zweipassiges MultiplyAdd,
Quell-Blendfaktoren einschliesslich Zielalpha, gemeinsamer Texturlebenszyklus und
Ruecksetzen aller Sonderzustaende. Gehashte Originalmethoden fuer Blendfaktoren,
Partikel-Blend und Renderwrapper nur gegen inerte CPU-Stubs ausgefuehrt. Kein
vollstaendiges Modul, keine Partikelsimulation, kein Client/Browser/Account oder
echter Grafikkontext gestartet/bedient.

Native Mocks pruefen alle sechs Blendidentitaeten und beide MultiplyAdd-Passes,
Samplerbindung 7 mit Quell-Wrap, Scene-only-Ausgabe ohne Schatten, Remapformel,
ungueltige/trunkierte/NaN-Pakete ohne Zustandsmutation, unvollstaendige Rampen,
geschuetzte Referenzfreigabe/-Resize und kein Ramp-/Multiplyleck in Folgedraws.
Neue Uniform-/Samplerzustands-Caches und kleine Remapupdates verwenden bestehende
Geometrie/Transforms. Capture prueft auch Customeffekte auf dem zweiten Pass.

Berichte: outputs/launcher-verification/verification.json,
outputs/native-renderer-verification/glsl-verification.json und
outputs/shader-audit/glsl-verification.json. Sichtweite 10, Auswahl/Budgets und
Originalmodule erhalten. GPU-Partikel/Sprites sowie kompletter Iris-Vertrag und
visuelle/FPS-Gleichheit weiter offen. 0.6.16 separat unter dist-bloxdy-v0.6.16
paketiert und als Dateien geprueft: 39 Quellen bytegleich, native Ressourcen
identisch, keine privaten Ordner; beide EXEs Authenticode NotSigned.
Installer 186.735.659 Bytes, Portable 186.582.865 Bytes. Pruefsummen im
Releaseordner/SHA256SUMS.txt, Bericht outputs/launcher-verification/distribution.json.
Keine Paketdateien gestartet oder installiert, alte Releases erhalten.

## Historischer Stand 0.6.15

209 reine Node-/DOM-/VM-Tests, erweiterte BridgeCpuTests und elf GLSL-Pruefungen
bestanden. Neu: CPU-Partikel mit Y-/Stretch-/Local-Stretch-/fester Ausrichtung,
Quell-Emitternormalen ohne doppelte Positionstransformation, echte Welt-/Origin-
Offsets, animierte Atlaszellen und nichtinstanzierter UV-/Geometrierandabstand.
Pivot, Maske, HDR-Farbe, Richtung und UVs atomar in Paket 28; neutrale Wechsel
loeschen alte Zustaende. Keine Simulation oder Mutation von Quellpartikeln.

Native CPU-Mocks pruefen alle fuenf Ausrichtungen/Masken beim Draw, Scene-only-
Ausgabe ohne Schatten, Header-/Float-/Affine-/UV-/Richtungs-/Bereichsfehler,
NaN/Truncation und unveraenderte Livewerte nach Ablehnung. Unveraenderte Batches
laden keine Buffer neu; reine Zellwechsel nur Appearance statt Transforms.
Legacy 26 bleibt lesbar. Hashgepruefte Original-Uploadmethode nur gegen CPU-
Attrappen ausgefuehrt, originale Partikelshader nur als Strings gelesen.

Berichte: outputs/launcher-verification/verification.json,
outputs/native-renderer-verification/glsl-verification.json und
outputs/shader-audit/glsl-verification.json. Native Anwendung nur kompiliert;
kein Client/Browser/Account/Grafikkontext gestartet/bedient. Sichtweite 10 und
Originalmodule erhalten. GPU-/Ramp-/Multiply-/Custom-Partikel, Sprites und
vollstaendiger Iris-Vertrag bleiben offen; Bild/FPS ausschliesslich Nutzerpruefung.

0.6.15 separat unter dist-bloxdy-v0.6.15 paketiert und als Dateien geprueft:
39 Quellen bytegleich, native Ressourcen identisch, keine privaten Ordner.
Installer 186.734.003 Bytes, Portable 186.581.221 Bytes; beide Authenticode
NotSigned. SHA256SUMS.txt im Releaseordner und Paketbericht
outputs/launcher-verification/distribution.json. Keine Paketdateien ausgefuehrt
oder installiert; alte Releases bleiben erhalten.

## Historischer Stand 0.6.14

200 reine Node-/DOM-/VM-Tests, erweiterte BridgeCpuTests und elf GLSL-Pruefungen
bestanden. Neu: Quellgruppen inklusive -1, reale Clear-/Sortierregeln, Double-
alphaIndex/Material-IDs, Quell-Sphaerenzentren, beobachtete Handprojektionen,
Kamera-/Origin-/Alterspruefung, Offscreen-/Intermediate-Ausschluss, sofortiger
Fallback und Observer-Abbau. Unbekannte Sortierer und gemischte Kamera-Overlays
in der Weltgruppe bleiben Fallback. Hashgepruefte originale Sortierer/Pre-Draw-
Methode nur in CPU-VMs mit Attrappen; Gruppeninitialisierung nur als Text gelesen.

Native CPU-Mocks pruefen atomare Ablehnung ungueltiger/trunkierter/singulaerer
DrawState-Pakete, Doublegrenzen, negative Himmelsgruppe, korrekte Sonderkamera-
Sichtpruefung, Half-Z-Konvertierung, restaurierte Weltmatrizen, gruppenweise
Tiefenresets, getrennte opake Welttiefe und Hand-Ausschluss aus Weltmetadaten/
Schatten. Rebase passt auch beobachtete Kameras und Sortierzentren an.

Berichte: outputs/launcher-verification/verification.json,
outputs/native-renderer-verification/glsl-verification.json,
outputs/shader-audit/glsl-verification.json. Native Anwendung nur kompiliert,
kein Client/Browser/Account/Grafikkontext gestartet oder bedient. Bild/FPS bleibt
Nutzerpruefung. Vollstaendiger Renderer/Iris-Vertrag weiter NICHT abgeschlossen.

Installer/Portable 0.6.14 unter dist-bloxdy-v0.6.14 als Dateien geprueft:
39 Quellen bytegleich, native Ressourcen identisch, keine privaten Ordner,
beide Authenticode NotSigned. Pruefsummen im Releaseordner, Paketbericht
outputs/launcher-verification/distribution.json. Kein Paket ausgefuehrt oder
installiert; alte Releases erhalten.

## Historischer Stand 0.6.13

192 reine Node-/DOM-/VM-Tests, erweiterte BridgeCpuTests und elf GLSL-Pruefungen
bestanden. Neue Faelle: reale Cape-Gelenke/Pivot und Pose-Updates, Text-LOD/
Premultiplikation, Enchantment-V3-Instanzdaten und reine Clockupdates, atomare
Partikelpositionen/Farben, Quelle-Reihenfolge/Pivot, leere/inaktive Listen,
NaN/Truncation/Bereichsfehler und expliziter Handkamera-/Rendergruppen-Fallback.
Isolierte hashgepruefte oeffentliche Cape/Text/Enchant-Shaderbuilder nur in CPU-VMs.

C++-Mocks pruefen Legacy/V2/V3-Strides, alte Records bei neuen Flags, ungueltige
Effektwerte, additive/premultiplizierte Blendfaktoren, atomare Partikelbatches,
affine Matrizen, Quellreihenfolge, Scene-only-Pass vor Transparenz und explizite
Tiefenschreiboption. Native Anwendung ausschliesslich kompiliert. Kein Client,
Browser, Account oder echter Grafikkontext gestartet/bedient. Sichtweite 10 und
Originalmodule unveraendert; vollstaendiger Renderer/Iris-Vertrag bleibt offen.

Aktuelle Berichte: outputs/launcher-verification/verification.json,
outputs/native-renderer-verification/glsl-verification.json und
outputs/shader-audit/glsl-verification.json. Bild/FPS ausschliesslich Nutzerpruefung.

Installer/Portable unter dist-bloxdy-v0.6.13 rein als Dateien geprueft: 39 Quellen
bytegleich, native Ressourcen identisch, keine privaten Ordner; beide Authenticode
NotSigned. Pruefsummen im Releaseordner, Paketbericht unter
outputs/launcher-verification/distribution.json. Keine Installation/Ausfuehrung.

## Historischer Stand 0.6.12

181 reine Node-/DOM-/VM-Tests, erweiterte BridgeCpuTests und elf GLSL-Compile-/
Linkpruefungen bestanden. Neu: Armour/Hue/Overlay unabhaengig, leere alte
Instanzcontainer neben aktuellen Ge-Konstanten, Per-Face-Bereichs-/Selektorchecks,
Samplerwechsel ohne Geometrie-/Pixeldaten-Neuimport, sRGB, exakte Animations-
Frameanforderung, Tickupdates ohne Zeichenhoheitsverlust sowie High-/Low-Origin.
Oeffentliche hashgepruefte isolierte Quell-Sampler-/Shaderbuilder in CPU-VMs;
kein Modul-/Anwendungs-/Netzwerkstart in Tests.

C++-Mocks: Legacy-/V2-Erscheinungsdaten, ungueltige/trunkierte Farben ohne
Zustandsverlust, Filter-/Mip-Caching, Atlasformel und Tabellenvalidierung,
Origin-Doublepraezision, Canonical-Z samt passenden Inversen, vollstaendige
Frame-Commits, Rebase ohne falsche Bewegung, Reset bei Fallback/Resize und atomare
Ablehnung singulaerer Kamerapakete. Kein GL-/GLFW-Kontext erstellt.

Berichte: outputs/launcher-verification/verification.json,
outputs/native-renderer-verification/glsl-verification.json und
outputs/shader-audit/glsl-verification.json. Native Anwendung nur kompiliert.
Keine Clients/Accounts/Browser/Grafikkontexte gestartet oder bedient. Komplettes
Spielbild/FPS und Referenzgleichheit bleiben Nutzerpruefungen. Gesamtauftrag
voller Renderer/Iris-Vertrag weiterhin NICHT abgeschlossen; keine Packs geladen.

Neueste Nutzerauswahl Minecraft Java 26.3 dokumentiert; passende Iris 1.11.7
ueber offizielle Projektmetadaten bestaetigt. Konkrete Referenz und Quellen in
docs/render-reference.json. Keine Mods/Java/Fabric installiert oder ausgefuehrt.

Installer/Portable 0.6.12 unter dist-bloxdy-v0.6.12 nur als Dateien geprueft:
39 Quellen bytegleich, native Ressourcen identisch, keine privaten Ordner;
beide Authenticode NotSigned. Bericht outputs/launcher-verification/distribution.json,
Pruefsummen im Releaseordner. Keine Installation/Ausfuehrung, alte Releases erhalten.

## Historischer Stand 0.6.11

173 reine Node-/DOM-/VM-Pruefungen, erweiterte BridgeCpuTests und elf
GLSL-Compile-/Linkpruefungen bestanden (drei native, acht Visual-Shader).
Neue Faelle: echte Lifeform-Schichtreihenfolge/Alpha, Atlasgridgrenzen,
Vertex-/Instanzdaten samt Nullinstanzen, Overlay/Opacity/Quelllicht,
TerrainFade ohne Chunk-Neuimport, Erhalt echter Transparenz, benannter
Unbekannt-Fallback und Erhalt kompletter Schatten bei neuen unvollstaendigen
Chunks samt Projektionswechsel. Der isolierte oeffentliche Shader-Stringbuilder
wird nur als CPU-Fixture ausgewertet, ohne Anwendung/Modulinitialisierung.

C++-Mocks pruefen zusaetzlich Layerkomposition/Bayer, atomare Erscheinungspakete,
Tangenten/Haendigkeit, teilweise UV-Quads, degenerierte UVs, unbekannte Greedy-
Blockzentren/Emission, Posen und getrennte Integer-Lightmapupdates. Quellen und
Hashes in outputs/launcher-verification/verification.json,
outputs/native-renderer-verification/glsl-verification.json und
outputs/shader-audit/glsl-verification.json.

Native Anwendung nur kompiliert. Keine Clients, Accounts, Browser oder echten
Grafikkontexte gestartet/bedient. Sichtbare Chunkkanten, vollstaendige native
Weltdarstellung und FPS bleiben Nutzerpruefungen. Der Iris-Gesamtvertrag ist
weiterhin unvollstaendig; irisContractComplete bleibt false. Kein Shaderpack
ausgefuehrt. Referenzluecken: docs/MINECRAFT-RENDER-CONTRACT.md.

Installer/Portable 0.6.11 separat unter dist-bloxdy-v0.6.11 gebaut und nur als
Dateien geprueft: 39 Quellen bytegleich, native Ressourcen identisch, keine
privaten Ordner. Paketbericht outputs/launcher-verification/distribution.json;
Pruefsummen dist-bloxdy-v0.6.11/SHA256SUMS.txt. Authenticode: beide NotSigned.
Nicht installiert oder ausgefuehrt; fruehere Releases erhalten.

## Historischer Stand 0.6.10

166 reine Node-/DOM-/VM-Pruefungen sowie erweiterte BridgeCpuTests und drei
GLSL-Compile-/Linkpruefungen bestanden. Materialvertrag mit Original-UV-Matrix,
unabhaengigem U/V-Wrap, Spiegelung/Culling/Depth/Fog und separatem Blendalpha
geprueft. UV-Updates lassen statische Geometrie erhalten. Unbekannte/ungueltige,
trunkierte, NaN-/Inf-Pakete veraendern keinen aktiven Materialzustand.

Native Anwendung nur kompiliert, CPU-Mocks ohne GL-/GLFW-Kontext ausgefuehrt.
Keine Clients, Accounts, Browser oder echten Grafikkontexte gestartet/bedient.
Live-Materialdarstellung, Native-Uebergabe und FPS sind ausschliesslich
Nutzerpruefungen. Minecraft Java / Iris ist die Referenz, keine nachgewiesene
1:1-Engine; Gesamtvertrag und fehlende Komponenten stehen in
docs/MINECRAFT-RENDER-CONTRACT.md. Shader Loader bleibt nachgelagert.

Installer/Portable 0.6.10 unter dist-bloxdy-v0.6.10 gebaut und nur als Dateien
geprueft: 39 Quellen bytegleich, native Ressourcen identisch, keine privaten
Ordner. Pruefsummen im Releaseordner; Paketbericht in
outputs/launcher-verification/distribution.json. Keine Installation/Ausfuehrung.

## Historischer Stand 0.6.9

Nutzer bestaetigt seinen 0.6.8-Bildpfad als fehlerfrei. Gespeicherte Renderlogs zeigen Source-Fallback, nicht vollstaendige native Ausgabe. Neue Pruefungen aendern keine Sichtweiten-/Qualitaetseinstellungen und bestaetigen keine echte FPS-Steigerung.

163 reine Node-/DOM-/VM-Tests bestanden. Neu: 600-Mesh-Fallback ohne Kamera-IPC/Write-Buchhaltung, begrenzte Wiederholungspruefung, frischer Wiedereinstieg mit bereits gebundenen Buffern, neue Chunks vor 200 alten Meshes innerhalb der bestehenden Budgets, Presenter-Texturspeicher/Uniform wiederverwendet und bei Resize erneuert, begrenzte Source-FPS-Werte sowie F8/F9 mit korrekter Source-/Nativepfad-Unterscheidung. Alle Grafik-/Fenster-/Account-/Prozessaufrufe weiterhin nur Mocks.

Native Anwendung und BridgeCpuTests kompiliert, CPU-Vertraege inklusive Blockdaten mit unsigned Indizes und NaN/Inf/Truncation bestanden. Drei GLSL-Programme kompiliert/verlinkt. CPU-VM-Vergleich gegen 0.6.8-ASAR: fuenf Runden, 600 Meshes/200 Ticks/120.000 unveraenderte Original-Draw-/Writepaare, Median 73,7468 -> 21,3957 ms (70,99 Prozent weniger Adapter-Testzeit), Geometriepruefungen 120.000 -> 15.000 und Kamerapakete 200 -> 0. Bericht: outputs/renderer-performance/capture-benchmark.json samt Quellhashes. Nicht als Live-Spiel-FPS oder schnellere Serverlieferung interpretieren.

Berichte outputs/launcher-verification/verification.json und outputs/native-renderer-verification/glsl-verification.json. Kein Client, Account, Browser, Preview oder echter Grafikkontext gestartet/bedient. Installer/Portable 0.6.9 separat unter dist-bloxdy-v0.6.9 gebaut und als Dateien geprueft: 39 Quelldateien bytegleich, native Ressourcen passend, keine privaten Ordner. Bericht outputs/launcher-verification/distribution.json und SHA256SUMS.txt im Releaseordner. Nicht ausgefuehrt; echte Sicht-/FPS-/Chunkpruefung weiterhin durch den Nutzer.

## Historischer Stand 0.6.8

Die reale 0.6.7-Nutzerrueckmeldung hat Vorrang: stark fehlerhafte Darstellung, wachsende Sichtweite, fehlende Modelle/falsche Atlanten/Phantomflaechen und Lag. Die frueheren isolierten Pruefungen bestaetigten keine korrekte Live-Darstellung.

156 reine Node-/DOM-/VM-Tests bestanden. Neue Faelle: aktive statt gecachte Szenengeometrie, unveraenderte Renderdistance 10, Walking-Cache mit Mesh-/Texturfreigabe, leere/unbekannte aktive Listen, unterstuetzter/gesperrter Materialvertrag, Mob-/Kosmetik-Fallback, Nullinstanzen trotz forcedInstanceCount, keine Quell-Thin-Batches auf normalen Instanzen, Einzelmaterial-Submeshbereiche, imagesPerAtlas gegen GPU-Kapazitaet, Zeichenhoheit nur auf Source-Spielcanvas, Ressourcen-/fremde Kontexte unbeeinflusst, 500-ms-Lease, sofortiger Auswahlrueckfall, Presenterfehler ohne Wiederholung, Auswahlrevision/Viewport und Readiness-Verlust waehrend IPC. Diagnosegrenzen erweitert ohne Seiten-/Accountfelder. Simulation/GL/IPC weiterhin nur Mocks.

Native Binaerdatei und BridgeCpuTests als Release kompiliert. CPU-Mocks pruefen zusaetzlich pausierte eingebettete Draws, validierte Ready-/Pause-Pakete, verbotene Freigabe referenzierter Texturen, Freigabe verwaister Ressourcen und Verwerfen veralteter PBO-Auswahlrevisionen. Drei GLSL-Programme kompiliert/verlinkt. Kein Client, Account, Browser oder echter Grafikkontext gestartet. Neue native Modelle/Materialien sind nicht damit implementiert: notwendige Bloxd-Szenen verbleiben bewusst im Source-Fallback. Sichtbares Ergebnis und FPS ausschliesslich Nutzerpruefung.

Berichte: outputs/launcher-verification/verification.json und outputs/native-renderer-verification/glsl-verification.json. Installer/Portable 0.6.8 getrennt unter dist-bloxdy-v0.6.8 gebaut und nur als Dateien geprueft: 39 Quelldateien bytegleich, passende native Ressourcen, keine privaten Ordner. Nachweise outputs/launcher-verification/distribution.json und dist-bloxdy-v0.6.8/SHA256SUMS.txt. Keine Ausfuehrung/Installation. Gesamtauftrag voller Minecraft-Renderer/Shaderpack weiterhin offen.

## Historischer Stand 0.6.7 (Nicht Visuell Erfolgreich)

140 reine Node-/DOM-/VM-Tests bestanden. Neu geprueft: tatsaechliche Sonnen-/Nebel-/Clippingwerte mit Unknown-Markierung, sechs Cubemap-Flaechen, native Welt-Block IDs und Wasser/Lava unabhaengig von Animationslayer 0, spaete Metadaten, fragmentierte/zu grosse/alte Bildpakete, Sequenz-Wrap, lineare Frameallokation, Presenter-Rueckfall, fehlende Frames, unveraenderte Reihenfolge vorhandener Canvas-Abfragen, Mainframe-Isolation, begrenzte native Diagnose ohne beliebige Seitenfelder und ausgeschlossener Native-Pfad in Accountfenstern. Alle Fenster, GL-Aufrufe, Rendererprozesse und Accounts dabei simuliert.

Native Anwendung und BridgeCpuTests als Release kompiliert. Erweiterte CPU-Mocks pruefen Atlasraender und sparse Tilepositionen, Cubeface-Readyzustand, RGBA32F-ID-Praezision, atomare Umwelt-/Oberflaechenvalidierung, Shadow-Framebuffer ohne Samplerfeedback, Sky ohne Tiefenschreiben/Schatten-Casting, Bildheader und maximal drei PBO-Jobs ohne blockierende Fence-Waits. Drei aktuelle GLSL-Programme kompiliert/verlinkt: nativer G-buffer (einschliesslich Schatten-/Fog-/Cube-Zweigen), nativer Compositor und WebGL2-Presenter.

Berichte: outputs/launcher-verification/verification.json und outputs/native-renderer-verification/glsl-verification.json. Der native Verifier verweigert veraltete CPU-Binaerdateien. Kein Client, Account, Browser oder Grafikkontext gestartet. Tatsaechliche Weltdarstellung/FPS, Named-Pipe-GPU-Betrieb und Minecraft-Vergleich bleiben Nutzerpruefung. Minecraft-Shaderpack-Ausfuehrung fehlt weiterhin. Installer/Portable unter dist-bloxdy-v0.6.7 ohne Ausfuehrung gebaut.

0.6.7-Paketpruefung abgeschlossen: 39 eingebettete Quelldateien bytegleich mit dem aktuellen Workspace, native Ressourcen identisch, keine privaten Ordner. Nachweise outputs/launcher-verification/distribution.json und dist-bloxdy-v0.6.7/SHA256SUMS.txt. Installer/Portable nicht ausgefuehrt.

## Frueherer Entwicklungsstand native-gbuffer-v1

# Renderer-Entwicklung nach 0.6.6, 14. Oktober 2026

Native-gbuffer-v1: 121 reine Node-/DOM-/VM-Pruefungen bestanden. Zehn neue Tests pruefen kompakte Material-Teilmeshes und deren Entfernung, Knochenposen ohne Geometrie-Reupload, Nullgewichte/ungueltige Daten, Morph-vor-Skinning, UV-Morph-Abschalten, Materialfarbe/Sichtbarkeit/Emission, Billboard-Meshes, Instanzspeicherwechsel und erweiterte Pakettypen. Aktive Geometrie hat Prioritaet; geladene Offscreen-Geometrie wird begrenzt und fair uebernommen.

Nativer Renderer und BridgeCpuTests als Release kompiliert. CPU-Mocks pruefen zusaetzlich Pose-/Materialupdates, Framebufferzuordnung, opake/transparenten Drawbuffer und Tiefenschreibregeln, getrennte Tiefenkopie, Fullscreen-Ausgabepass ohne Feedback, Fallback-Sampler, Allokationsgrenzen und Erhalt alter Puffer bei fehlgeschlagenem Resize. Zwei tatsaechliche native GLSL-Programme mit glslang kompiliert und verlinkt. Bericht: outputs/native-renderer-verification/glsl-verification.json; gesamter Node-/DOM-/VM-Bericht: outputs/launcher-verification/verification.json.

Kein Client, Account oder Grafikkontext gestartet. Native GPU-Darstellung und FPS bleiben unverifiziert. Noch keine Minecraft-Shaderpack-Ausfuehrung; neue Installer/Portable wurden nicht gebaut. Entwicklungsdetails und offene Rendereraufgaben stehen in docs/NATIVE-RENDERER.md.

## Release-Pruefnachweis 0.6.6

# Verifikation — Bloxdy Client 0.6.6, 14. Oktober 2026

111 reine Node-/DOM-/VM-Prüfungen bestanden, darunter 23 Shaderregressionen. Sechs zusätzliche Prüfungen nutzen den tatsächlichen aktuellen Worker, Chunk-Upload-Methoden mit führender var-Deklaration und gepackte 32-Byte-Vertexdaten. Sie prüfen Erzlicht auf Nachbarblöcken samt erhaltenem Himmelslicht, Worker-/Blob-Hooks mit CPU-Fakes, spätere Erz-IDs, einmalige Relights, 3D-Flüssigkeitsgeometrie, Übernahme geladener Flächen, Lichtupdates/Flat-Wavey-Wechsel, animierten Atlaswert 0 in gemischten opaken Materialien und Wasser-/Lava-Ripples aus aktuellen Entitypositionen.

Acht GLSL-Programme kompiliert/verlinkt. Nachweise: outputs/launcher-verification/verification.json und unit-tests.tap, outputs/shader-audit/glsl-verification.json. Keine Anwendungen, Browser, echten Worker, Accounts oder Grafikkontexte gestartet. Tatsächliche Darstellung und FPS sind vom Nutzer zu prüfen; reine CPU-/Compilerprüfungen bestätigen keine Live-Darstellung.

Installer und Portable 0.6.6 gebaut und ohne Ausführung geprüft: 37 Quelldateien bytegleich, native Ressourcen identisch, keine privaten Ordner enthalten. Paketbericht: outputs/launcher-verification/distribution.json; Prüfsummen: dist-bloxdy-v0.6.6/SHA256SUMS.txt.

## Frühere Prüfnachweise

# Verifikation — Bloxdy Client 0.6.5, 14. Oktober 2026

105 reine Node-/DOM-/VM-Prüfungen bestanden. 17 Shaderregressionen prüfen unter anderem den Dokumentstart-Modpfad, eigene Uniformzustände je Programm, kollidierende Samplertypen, Framebuffer-Lese-/Schreibkonflikte, Wasser-/Lava-Pipelines mit Effekten an/aus und erneute Schattenversuche nach unvollständiger Geometrie. Launcher-Modsettings entfernt; Ingame-Konfiguration bleibt profilbezogen persistent.

Acht GLSL-Programme kompiliert/verlinkt, einschließlich zusammengebauter Wasser- und Lava-Shader. Nachweise: outputs/launcher-verification/verification.json und unit-tests.tap, outputs/shader-audit/glsl-verification.json. Keine Clients, Accounts oder Grafikkontexte gestartet. Die vom Nutzer gemeldeten visuellen 0.6.4-Regressionen zeigen die Grenzen der früheren isolierten Tests; tatsächliche Darstellung und FPS sind auch für 0.6.5 noch offen.

## Frühere Prüfnachweise

# Verifikation — Bloxdy Client 0.6.4, 13. Oktober 2026

Aktueller Shaderfix: 98 reine Node-/DOM-/VM-Prüfungen bestanden, davon 11 neue Shaderregressionen. Tests decken Shaderdefaults und gespeicherte Aus-Werte, Golden-Hour-Cumulus, vollständige Sky-/Shadow-Sampler bei deaktivierten/leerem Effekt, Chunk-Rebuilds, Einstellungswechsel, Entity-Geometrieübergänge, entfernte Mobs, CPU-Skinning und aktuelle Weltmatrizen ab.

Sechs GLSL-Programme (zwei Empfängerpfade, vier Castervarianten) mit dem lokalen glslang kompiliert und verlinkt. Nachweise: outputs/launcher-verification/verification.json und unit-tests.tap; outputs/shader-audit/glsl-verification.json. Keine Anwendungen, Accounts oder Grafikkontexte gestartet. Die sichtbare Wirkung im tatsächlichen Spiel ist ausschließlich vom Nutzer zu prüfen.

## Historische Verifikation — 12. Oktober 2026

Der Release-Build wurde mit Visual Studio Community 2026, MSVC 19.51 und Windows SDK 10.0.26100 erstellt. Die C/C++-Runtime wird statisch eingebunden.

Ein echter Desktop-OpenGL-Kontext meldet:

- GPU: Intel Arc 130V GPU (8 GB).
- OpenGL: 4.3.0, Intel-Treiber 32.0.101.9033.
- GLSL: 4.30.
- Maximale Texturgroesse: 16384.
- Maximale Farbanhaenge: 8.
- SSBO-Bindings: 16.

`native_gpu_smoke` unter CTest: bestanden, 1/1 Tests, keine OpenGL-Fehler. Der Test kompiliert und verlinkt die tatsaechlichen nativen Programme und prueft ihre GPU-Ausgaben.

- 3079 synthetische Blockinstanzen.
- 176528 Pixel mit Geometrie-Tiefe im 1280-x-800-Bild.
- 142932 geaenderte Pixel bei verschobener Kamera.
- 58583 geaenderte Pixel beim Abschalten des Schattenpasses.
- Neues 640-x-360-Renderziel erfolgreich dargestellt und als PNG gespeichert.
- Compute-Shader schreibt den erwarteten Wert 42 in einen SSBO; CPU-Ruecklesen bestaetigt die Ausfuehrung.

Maschinenlesbare Nachweise: `outputs/capabilities.json` und `outputs/verification.json`. Native Bildausgaben: `outputs/native-demo.png` und `outputs/native-demo-resized.png`.

Die kleine Zeitmessung betrifft ausschliesslich die synthetische Szene mit GPU-Abschluss bei 640 x 360. Sie wird nicht als Bloxd-FPS oder als Performance eines Minecraft-Shaderpacks ausgegeben.

Ein erster Build mit dynamischer C/C++-Runtime erreichte beim automatischen Start das Zeitlimit ohne Grafikbericht. Der abschliessende Build mit statischer Runtime startet und besteht den nativen Test. Die Ursache des ersten Startproblems wurde nicht abschliessend bestimmt.

Die Datenbrücke wurde inzwischen implementiert und mit einer synthetischen WebGL2-Datenquelle sowie echter nativer GPU-Ausgabe geprüft. Der Test prüft Geometrie-/Texturänderungen, Kamera, Licht, Objekt-/Instanzbewegung, Entfernung, Szenenwechsel und Erhaltung des ursprünglichen WebGL-Zustands. Nachweis: `outputs/bridge-test/verification.json`.

Live-Test am 12. Oktober: Die lokalen Logs zeigen 48 Mesh-Uploads, 4 Textur-Uploads und 4 Kamerapakete, anschließend einen Szenenreset. Sie belegen keine korrekte Darstellung einer vollständigen Bloxd-Welt. Der Nutzer meldete anschließend eine permanente Accountsperre. Ein Sperrgrund ist in den lokalen Logs nicht bestätigt. Die Live-Sitzung wurde beendet; der Starter verwendet ausschließlich lokale synthetische Daten und blockiert HTTP-/HTTPS-/WebSocket-Anfragen.

Anschließend bat der Nutzer ausdrücklich um Reaktivierung. Die Live-Anbindung wurde ausschließlich im Quellcode wiederhergestellt; der Agent hat dabei weder Client noch Account geöffnet oder bedient. Die Steuerung über Diagnose-Kommandodateien wurde entfernt. Syntaxprüfung durchgeführt; kein erneuter Laufzeit- oder Live-Test durch den Agenten. Der Nutzer übernimmt jeden Clientstart und alle Accountaktionen.

Noch nicht implementiert oder verifiziert: vollständige Bloxd-Weltdarstellung, Minecraft-Shaderpack-Import/-Ausfuehrung, vollständige Spieler-/Item-/Partikelpfade, semantische Materialzuordnung und Minecraft-Vergleich.

Google-Popup-Korrektur: Nach der vom Nutzer gezeigten Meldung „Popup blocked“ wurde das pauschale Verbot neuer Fenster durch gezielte Google-/Firebase-Anmeldefenster ersetzt. Der erlaubte Firebase-Host wurde anhand des lokal archivierten Bloxd-Clients bestimmt. Loginfenster erhalten keinen Capture-Preload. Reine Node-Tests prüfen erlaubte Rückwege, abgelehnte fremde Hosts/Protokolle, Offline-Sperre und die Fensteroptionen, ohne Electron oder den nativen Client zu starten. Ein echter Google-Login bleibt vom Nutzer zu prüfen.

## Vorschau-Korrektur — 13. Oktober 2026

Nutzerrückmeldung: Nur einzelne Blöcke waren sichtbar; die native Darstellung aktualisierte extrem langsam. Gespeicherte Logs belegen über 3.100 importierte Meshes und ungefähr 23 MB übertragenen Inhalt, jedoch keine FPS-Messung des alten Builds. Die Ursache und Verbesserung der tatsächlichen Bildrate werden daher nicht als gemessen dargestellt.

Ein neuer Release-Build mit begrenztem Pipe-Empfang, Culling, gecachten Uniformpositionen, Textursortierung und FPS-/Zeitdiagnose wurde erfolgreich kompiliert. Erfassungsänderungen begrenzen Scans, teilen Atlanten anhand der tatsächlichen GPU-Handles, trennen Kamerapakete von Geometriearbeit und behandeln RGB-Alpha sowie leere Instanzen korrekt. Unvollständige Texturen erhalten vorübergehend eine untexturierte Geometriedarstellung.

Zehn reine Node-Tests bestanden. Fünf neue Tests verwenden ausschließlich simulierte Szenen/GL-Aufrufe in einer Node-VM: gemeinsame Atlanten und RGB-Alpha, begrenzte vollständige Scans, Priorisierung aktiver Meshes, Kamerapakete während blockierter Geometrie und leere Instanzen ohne Geometrie-Reupload. Weitere fünf Tests prüfen Paketvalidierung und Google-Popup-Regeln. Kein Client, keine native Grafikvorschau und kein Account wurde für diese Prüfung gestartet oder bedient.

Die Laufzeit von Pipe-Empfang und Culling sowie die tatsächliche Darstellung/Bildrate muss der Nutzer mit dem neuen Build prüfen. Schatten in der importierten Vorschau und Minecraft-Packausführung bleiben ausstehend.

## Texturstreaming 0.2.1 — 13. Oktober 2026

Die weiteren vorhandenen Live-Logs des vorherigen Builds enthielten einen Höchstwert von 498,5 ms pro Erfassungsdurchlauf, 217,5 ms für synchrones Texturlesen, insgesamt ca. 266 MB transferierten Inhalt und den Fehler „Invalid typed array length: 24“. Diese Werte stammen aus der vom Nutzer betriebenen alten Sitzung; sie sind keine Messung der neuen Version. Die 85 gespeicherten Statussamples mit Kamera und FPS enthalten sowohl ca. 60 FPS als auch kurze Einbrüche bis 0,23 FPS; der Median belegt deshalb keine störungsfreie Darstellung.

Version 0.2.1 benötigt keine erneute vollständige Texturübertragung bei Noa-Origin-Rebases. Sie fordert sichtbare Atlaslayer gezielt an und nutzt maximal drei asynchrone GPU-Readbackjobs. Animationen invalidieren betroffene Layer; veraltete Rückgaben werden verworfen und erneut angefordert. Instanzdaten werden mit der korrekten Anzahl und Vertex-/Indexbuffer mit ihrem tatsächlichen `underlyingResource` erfasst. Der Renderer nutzt eine R8-Ladestatusmaske zur Darstellung einzelner bereits fertiger Layer. Bounding Boxes werden mit Mittelpunkt/Extents statt acht Eckentransformationen pro Instanz berechnet.

Erfolgreich geprüft: Release-Kompilierung des separat abgelegten nativen Renderers, 17 reine Node-Tests, `BridgeCpuTests.exe` als eigener CPU-Test ohne Grafik-Kontext und GLSL-Syntax/Linken mit dem offiziellen glslang 16.6.0. Der CPU-Test prüft tatsächliche Renderer-Paketverarbeitung und simulierte GL-Maskenuploads, progressives Zeichnen, Ressourcenerhalt und ausbleibendes Flackern beim Rebase, Frustum-Culling sowie Null-Instanzen. Node-Prüfungen ergänzen unter anderem unbeendete/stale GPU-Jobs, selektive Animationsupdates und in-place Bufferänderungen. Keine dieser Prüfungen startete oder bediente einen Client, eine native Grafikvorschau oder einen Account.

Ein echter Grafik-/Live-Test der Version 0.2.1 wurde wegen der verbindlichen Nutzerregel nicht ausgeführt. Ladezeiten, tatsächliche Bildpixel und stabiler Betrieb sind noch vom Nutzer zu prüfen. Es wird weder „perfekt“ noch vollständige Minecraft-Packkompatibilität behauptet. Neue Schatteneffekte wurden nicht auf den bisher unzuverlässigen Vorschaupfad aufgesetzt.

## Launcher 0.4.0 — 13 October 2026

63 pure Node/DOM/VM tests pass. They simulate Electron windows, provider popups, account contexts and game-process controllers; none starts an application or uses a real account. The tests cover account/profile ownership, backups, recovery archives, deletion cancellation, default memory and themes, explicit startup preferences, mod configuration, manual shader search, public metadata filtering and rejecting shop try-ons as character previews.

The startup regression is covered at two levels: a budget-ready acknowledgement alone cannot complete Play without a matching visible-window confirmation; the CPU-only Windows test checks `SW_SHOWNORMAL`, budget boundaries, argument quoting, the real Windows Job memory limit and rejection of an over-budget allocation. The source lifecycle keeps the launcher available on failure and restores it on a second invocation. A running game's read-only store and scoped deltas cannot overwrite unrelated launcher changes.

The current public Bloxd bundle and official texture repository were read anonymously, without executing the game. They establish the four auth providers, actual menu getter/setter contract, public username/cosmetic getters, character canvas and eight texture entries. The texture override is tested before atlas generation, including suppression of a later automatic save that would otherwise overwrite the account's texture preferences.

Windows helper and native renderer builds succeeded. The installer and portable EXE are built into `dist-launcher-v0.4.0/`; all 28 packaged source files and both native resources match their source/build bytes. No private profile, cookie, account, log, research or test folder is included. Both EXEs are unsigned and have not been uploaded or installed by the agent. Reports and SHA-256 values: `outputs/launcher-verification/verification.json`, `distribution.json`, `memory-budget-cpu.txt`, and the distribution's `SHA256SUMS.txt`.

Still user-only: actual visual agreement with FastClient, visible Play, provider login/sign-up, username availability/rename, worn-character capture, live texture application, mod combinations and another PC. Minecraft shaderpack rendering and lower RAM/higher FPS than the official app remain unimplemented or unmeasured. No new live or graphical claim is made.

## Launcher 0.5.0 — 13 October 2026

64 pure Node/DOM/VM tests pass. The additional backend contract rejects account login, connect, sync and legacy account-window requests without starting a child process or creating a pending account. UI checks confirm saved-account/profile selection still works, provider controls are unavailable and no account action requests a Bloxd window. Existing Play, window restore, delete confirmation, configuration and pack contracts remain covered. No app or account was opened by the agent.

The redesigned pages use a single local generated background and static CSS gradients, accents, cards and dialogs. The original image was visually inspected as an image file, and its workspace copy, tool and complete prompt are recorded in `launcher/ARTWORK.md`. This is artwork verification, not a screenshot or live visual verification of the running application.

The public authentication-project configuration returned HTTP 403 for a native request and for the launcher's own prospective localhost origin. These were configuration lookups only, without a user identifier, token, cookie or sign-in request. Sanitized evidence: `outputs/bloxd-public-source/native-auth-capability.json`. The required direct account integration remains unavailable; the previous Bloxd-page fallback has been removed. No authorized-domain list could be read from the error, and no unrestricted/native project key or owner approval is inferred.

New packages are compiled/assembled without execution under `dist-launcher-v0.5.0/`. Source/private-folder checks and package hashes are recorded by `launcher/check-package.cjs`; the helper and renderer use the existing independently built binaries. Actual UI, Play and live texture checks remain user actions. No new performance or Minecraft-shaderpack claim is made.

## Launcher 0.6.0 — 13. Oktober 2026

Dropdowns und Meldungsablauf werden im DOM ohne Browser-/Clientstart geprüft. Modelltests verwenden synthetische Geometrie, simulierte Preview-Refs und Texturdateien, Khronos glTF-Validierung sowie CPU-seitiges Three.js-Parsing. Getrennte Modellablage, Accountidentität, Kleidungs-Layer, Transformationsmatrizen, ungeeignete Ressourcen und Foto-Verzicht werden geprüft. Der offizielle Accountfenster-Pfad wurde auf ausdrücklichen Nutzerwunsch im Code reaktiviert; der Agent startet oder bedient keinen Client/Account. Aktuelle maschinenlesbare Ergebnisse: outputs/launcher-verification/verification.json und distribution.json. Echte Extraktion und sichtbare WebGL-Vorschau bleiben Nutzerprüfungen.

## Launcher 0.6.1 — 13. Oktober 2026

85 reine Prüfungen bestanden. Neu geprüft: automatische Join-Erfassung des lokalen Spielers, Set-basierte Körpergruppen, First-Person-Sichtbarkeit, Ursprung/Rotation unabhängige Körperpose und passende Attachment-Transformationen, Mausdrehen ohne Zoom, Vorderansicht sowie entfernte Sync-Buttons/Meldungen. Die Schließprüfung simuliert Bloxd-beforeunload, hängenden Renderer, Prozessende und Launcher-Wiederverwendung. Paketprüfungen vergleichen die getrennt benannte Game-EXE mit dem Launcher-Runtime und schließen private Daten aus. Kein Client, Account oder Grafikkontext wurde gestartet; echte Fensteraktionen und Join-Erfassung bleiben Nutzerprüfungen. API-Referenz: [Electron will-prevent-unload](https://www.electronjs.org/docs/latest/api/web-contents#event-will-prevent-unload).

## Bloxdy Client 0.6.2 — 13. Oktober 2026

86 reine Prüfungen bestanden. Branding und Preset-Entfernung ändern keine bestehenden Daten-/Sessionpfade. Löschtests prüfen das eingebettete Modal, Cancel/Escape, das gezielte Entfernen sowie einmalige und auf den Eintrag beschränkte Bestätigungen ohne native Warnfenster. Native Caption-Änderungen werden separat kompiliert; kein Client- oder Grafikstart. Distribution-Nachweis und Paket-Hashes stehen in outputs/launcher-verification/distribution.json beziehungsweise dist-bloxdy-v0.6.2/SHA256SUMS.txt.

## Bloxdy Client 0.6.3 — 13 October 2026

87 pure Node/DOM/VM tests passed. The added mock-window contract checks that no native menu exists, F8 still opens performance, F9 records the game benchmark, repeat/modifier/key-up events have no effect, and account-only windows cannot save game measurements. The prior module source comparison now uses independent original-source hashes imported and verified before modification, so tests work without neighboring mod projects. C++ helper and native renderer build successfully in the new project; the Windows CPU-only memory test passes. No client, account or graphics context was started. Package-byte proof and SHA-256 values are generated by launcher/check-package.cjs for dist-bloxdy-v0.6.3. Visual layout, selection and native window behavior remain user checks.
