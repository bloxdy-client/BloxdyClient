# Litematica import and visible schematics, Client 0.6.28

20. Oktober 2026. Nutzer bestaetigt starke Ruckler **beim Laden und dauerhaft
mit sichtbarer Vorlage**. 0.6.27 war keine Loesung dieses Gesamtfehlers: Dort
blieben die benoetigte Welterfassung bei sichtbaren Vorlagen, der eigentliche
Dateiparser und grosse abschliessende Pufferkopien weitgehend erhalten.

Der neueste nutzererzeugte Lauf `0f87b91390657ae5439c4f17` enthaelt ausschliesslich
Litematica, alle Skripte ohne protokollierten synchronen Startfehler und den
tatsaechlichen 0.6.27-Adapter. Kein gespeicherter F9-Messlauf; daraus werden weder
Live-FPS noch eine konkrete CPU-/GPU-Ursache im Nutzerlauf abgeleitet. Es wurde
nur vorhandener Bericht-/Preloadtext gelesen, keine laufende Sitzung bedient.

## Nachgewiesene Codepfade und Aenderungen

`launcher/litematica-loading.cjs` ergaenzt den SHA-geprueften Clientadapter fuer
`bloxdschem.js`, `placement.js`, `renderer.js`, `native-frame.js` und die
Import-Abbruchbindung in `litematica.js`. Originalkatalog und Originalprojekt
bleiben unveraendert; die Adaption gilt auch fuer bestehende Installationen.

Der alte als `async` deklarierte Parser laeuft in seinem grossen Zaehlloop ohne
Timerunterbrechung. Er zaehlt auch dichte komprimierte RLE-Bereiche Block fuer
Block. Neu wird die exakte Anzahl innerhalb der dreidimensionalen Auswahl aus
Differenzen einer X/Y/Z-Praefixzaehlung ermittelt. Grosse Dateien bleiben kompakt;
kleine Dateien behalten die bisherigen Zeilen. Varianten, Mapping, Chunkdaten,
Metadaten, Warnungen, Dimensions-/Datei-/8-Millionen-Grenzen und Fehlerpruefungen
bleiben erhalten. RLE-/kleine Zeilen-/Metadatenloops geben nach kooperativem
2-ms-Budget per Timer an die Ereignisschleife ab. Ein neuer Import oder Unload
widerruft einen alten noch laufenden Parsevorgang ueber das bestehende Token.

Chunkansichten verwenden ihren schon vorhandenen Quellen-Map und die bisherige
Zeilenliste beim Kamerawechsel weiter, statt erneut die gesamte Liste zu
kopieren. Das Emissionsbudget wird auch fuer uebersprungene Innen-/Layerzellen
geprueft. Eine fertig leere Ansicht entfernt die alte Vorlage korrekt; nur die
noch unfertige neue Ansicht behaelt die bisherige Ausgabe.

Die abschliessende Floatkonvertierung des Meshs gibt alle8192 Floats ab.
Uploads verwenden maximal256KiB pro `bufferSubData`-Schritt. Ein eigener
ausstehender Buffer wird erst nach vollstaendigem Upload und unveraenderter
Gruppenrevision uebernommen; die letzte fertige Geometrie bleibt bis dahin
erhalten. Abbruch/Ersetzung/Destroy gibt ausstehende eigene Buffer frei.
Alte temporaere Vertexarrays werden nach ihrer Uebernahme losgelassen.

Sichtbare Gruppen behalten einen eigenen VAO fuer unveraenderte Vertexbindungen.
Ein neuer Buffer widerruft diesen VAO. Vordergrundmasken verwenden weiterhin den
separaten Arbeits-VAO und koennen keine gecachten Gruppenattribute ueberschreiben.
Alle Originalgeometrie-, Textur-, Farb-, Alpha-, Tiefen- und Shaderformeln bleiben.

Die zweite Welterfassung schreibt Weltfarbe nur, wenn sichtbare Wrong-/Extra-
Flaechen diese Farbe wirklich abtasten; normale Missing-Vorschauen/Auswahl
verwenden ausschliesslich die volle native Tiefe. Die Farbtextur bleibt gueltig
angelegt. Vor dem Clear wird der passende Drawbuffer gewaehlt, auch beim Wechsel
zwischen Tiefen- und Farbbedarf.

Aus den projizierten AABB-Ecken sichtbarer Gruppen und der Auswahl wird ein
konservatives Pixelrechteck inklusive Outline-/DPR-Rand gebildet. Nur bei weniger
als75Prozent Bildschirmflaeche begrenzt es Clear/Fragmentarbeit der **sekundaeren**
Aufnahme. Bei Near-/W-Kreuzung bleibt die volle Aufnahme; Texturaufloesung,
Capture-UVs und Quelldraws bleiben erhalten. Die Quell-Scissor wird transparent
beobachtet, fuer die Aufnahme geschnitten und nach jedem Replay inklusive
Ausnahmen wiederhergestellt. Unbeobachtbare/ungueltige Schreibformen verzichten
auf die Bereichsoptimierung. READ_FRAMEBUFFER/Quelltiefe werden nicht ausgelesen
oder umgeleitet; kein neuer Welt-Renderpfad und kein Eingriff in Accounts.

Die notwendige Weltwiederholung fuer sichtbare Vorschauen besteht weiterhin.
Bei einer bildfuellenden Vorlage hilft die Bereichsbegrenzung nicht; dort wirken
die reduzierten Bindungen, Farbwrites und Vorbereitungskosten. Keine garantierte
FPS-Steigerung oder Behauptung vollstaendiger Dropfreiheit.

## Reine Verifikation

328 Node-/DOM-/VM-Tests,39 Syntaxdateien,beide generierten Preloads und
MemoryBudgetTests bestanden. Keine Client-/Account-/Installer-/Grafikstarts,
keine Profil-/Loginmutation.

Zwoelf neue Regressionen pruefen Ergebnisgleichheit des echten alten/neuen
Parsers mit abgeschnittenen Auswahlboxen/negativen Koordinaten/Varianten/Metadaten,
dichte7.995.392Bloecke aus244RLE-Bereichen statt7.995.392 Zelliterationen,
Timerabgaben/Abbruch, defekte Dateien und8-Millionen-Grenze. Die dichte Fixture
ergibt23 synthetisch zeitgesteuerte Timerabgaben, der Originalparser keine.
Weitere Nachweise betreffen konstante Vertexbindungen ueber31 sichtbare Frames,
volle Tiefenaufloesung bei kleinem Capturebereich, Wrong-Farbbedarf,
Scissorschnitt/-restaurierung und Fehlerfreigabe, volle Aufnahme bei W-Kreuzung,
256-KiB-Uploads, alte Ausgabe waehrend Uploadabbruch sowie gefilterte Zeilen und
endgueltig leere Ansichten. Das sind Operations-/Kontrollflussnachweise, keine
gemessenen GPU-Zeiten oder Live-FPS.

Nachweise unter `outputs/litematica-loading-0.6.28/`; Paketpruefung nur lesend.
Tatsaechliche Lade-/Spiel-FPS und Bildgleichheit bleiben Nutzerpruefung.
