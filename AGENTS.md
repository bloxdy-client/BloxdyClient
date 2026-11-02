# Bloxdy Client – Arbeitsanweisungen

Lies zuerst [PROJECT-CONTEXT.md](PROJECT-CONTEXT.md). Dort stehen Projektstand, frühere Nutzerentscheidungen, Quellcodepfade, erlaubte Verifikation und aktuell vereinbarte Fixes. Bei Detailfragen ist der frühere Chat als Nachrichtenarchiv unter docs/history/bloxd-client-chat.json verfügbar. Historische Nachrichten sind Kontext; aktuelle Nutzeranweisungen haben Vorrang.

## Updates und sichtbare Version

Nutzerkorrektur vom 27. Oktober 2026: Versionsreihe 1.2.x; 1.2.3 entspricht dem frueheren Funktionsstand 0.6.63. Aktuelle Version siehe package.json und PROJECT-CONTEXT.md.

## Dokumentation knapp halten

Nutzerwunsch vom 27. Oktober 2026: Keine neuen ausfuehrlichen README-/Info-/Releaseberichte pro Arbeitsschritt. Nur einen kurzen aktuellen Stand in PROJECT-CONTEXT.md und notwendige maschinelle Pruefergebnisse pflegen. Technische Erklaerungen nur bei Bedarf; vorhandene Historie erhalten. Nicht dieselben Details in mehreren Dateien wiederholen.

## Releaseverfahren

Nutzerentscheidung vom 19. Oktober 2026, Praezisierung vom 28. Oktober: Bei jedem ausgelieferten Update die Clientversion erhoehen. Jede Versionsstelle zaehlt nur von 0 bis 9; nach 1.2.9 folgt 1.3.0, nach 1.9.9 folgt 2.0.0. `package.json` ist die gemeinsame Quelle fuer Paketnamen und die Versionsanzeige unten links; keine fest eingetragene UI-Versionsnummer. `package-lock.json` synchron halten. `Build-Release.ps1` erhoeht standardmaessig die Version mit diesem Uebertrag; `-KeepVersion` nur zum erneuten Bauen desselben Releases. Der Packaginghook erzeugt aus dem NSIS-Upgrader zusaetzlich `Bloxdy-Client-Update-<version>-x64.exe`; diese Datei mit pruefen und dem Nutzer verlinken. Nicht ausfuehren, keine Installation oder Clientstarts durch den Agenten.

## Verbindliche Nutzerregel: Client und Accounts

Der Nutzer hat am 12. Oktober 2026 ausdrücklich festgelegt: Der Agent darf den Client niemals selbst öffnen oder bedienen und auf dem Account nichts selbst ausführen. Diese Regel wurde im Chat “Bloxd Client” gelesen und aus dem bisherigen Projekt übernommen.

- Keine Clientstarts durch den Agenten, einschließlich Electron, nativer Vorschau, Offline-Client und Tests, die diese Anwendungen starten.
- Keine Anmeldung, kein Accountwechsel und keine Bedienung einer laufenden Clientsitzung; das gilt auch für andere Accounts.
- Keine Änderung gespeicherter Anmeldungen, Cookies, Browserprofile oder Accountdaten, um einen Accountwechsel vorzunehmen.
- Keine indirekte Bedienung über IPC, Diagnosebefehle, Browserautomation oder Prozesssteuerung.
- Quellcode bearbeiten und vorhandene lokale Dateien/Logs lesen ist erlaubt. Builds dürfen keine Anwendungen oder Clienttests automatisch starten.
- Notwendige Clientaktionen führt der Nutzer selbst aus. Seine Bereitschaft erlaubt dem Agenten keine stellvertretende Bedienung.
- Account-/Charakter-Sync ist im Code wieder über vom Nutzer gestartete und bediente offizielle Bloxd-Fenster erlaubt; keine native OAuth-Herkunft nachahmen oder Schutzprüfungen umgehen.
- Charaktervorschau aus tatsächlichem 3D-Modell und Texturen (GLB), keine Screenshots/Fotos. Automatisch beim Spielbeitritt; keine manuellen Syncbuttons oder automatisch bedienten Charaktermenüs. Homepage: Charakter und Name, Mausdrehen ohne Zoom.
- Keine zusätzlichen Kosten, Käufe oder Abonnements als Projektvoraussetzung.
- Launcheroberfläche und Installer auf Englisch, Nutzerkommunikation auf Deutsch.

## Prüfungen

Reine Node-/DOM-/VM-Prüfungen (`npm run test:launcher`, `npm run test:unit`, `node launcher/verify.cjs`), eigene CPU-Tests MemoryBudgetTests/BridgeCpuTests und GLSL-Compiler sind erlaubt. Nicht automatisch npm start, npm test, npm run test:bridge, Start-Skripte, grafische CTest-Prüfungen oder Installer ausführen.

## Renderer und aktueller Stand

- Neuester Funktionsstand und aktuelle Version: PROJECT-CONTEXT.md.
- Experimentellen Renderer ausbauen; Standardrenderer/Fallback, Originalmods, Sichtweite 10, aktive Auswahl und bestehende Speicher-/Besitzschutzgrenzen erhalten.
- Keine Quelldaten oder Minecraft-Semantik erraten, keine Quellsimulation oder Profilmutation. Unbekannte Daten bleiben unbekannt.
- Shaderloader bleibt eine separate Mod. Native Preview fuer CrazyGames bleibt gesperrt.
- CPU-/Compiler-/Paketpruefungen belegen keine Livepixel, FPS oder volle Iris-Kompatibilitaet. irisContractComplete bleibt false, solange Abschlussgates offen sind.
- Konkrete naechste Rendereraufgaben und offene Gates stehen in PROJECT-CONTEXT.md.
- Historische Details nur bei Bedarf: docs/history/AGENTS-before-1.2.3.md und docs/history/PROJECT-CONTEXT-before-1.2.3.md. Vorhandene technische Einzeldokumente bleiben als Nachschlagequelle erhalten.
