# Verifikation — 12. Oktober 2026

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
