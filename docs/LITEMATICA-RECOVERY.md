# Litematica: Ladefortschritt und zusammenhaengender Meshaufbau, 0.6.37

21. Oktober 2026. Nutzer meldet nach 0.6.36 keine periodischen FPS-Drops mehr,
aber etwa 30 FPS, nur etwa 10 Prozent sichtbare Vorlage und starke Glitches.
0.6.36 war damit keine Gesamtloesung. Der letzte vorhandene Nutzerlauf enthaelt
keine Modstartfehler und keinen gespeicherten F9-Messbericht. Die gemeldeten
30 FPS sind eine Nutzerbeobachtung, keine agentenseitige Messung.

## Rein nachgestellte Fehler

Die Warteschlange aus 0.6.35 brach einen laufenden Generator vor seiner naechsten
Fortsetzung ab, sobald die 50-ms-Weltpruefung eine weitere Farb-/Statusrevision
der Gruppe erzeugte. Bei laengerem Meshaufbau konnte dadurch jeder Versuch vor
seinem Upload enden. In der CPU-Fixture mit dem echten ausgelieferten
0.6.36-Adapter: 96 Frames mit weiteren Statuswechseln, 47 Abbrueche und kein
fertiger Mesh. Der geaenderte Adapter uebernimmt im selben Versuch 11 Meshes
ohne solche Abbrueche. Bei dauernden Aenderungen bleibt weitere Arbeit uebrig.

Die bisherige Auswahl startet zudem bei jeder ueberquerten 16er-Kamerazelle neu.
Ein Test mit vier Quellchunks und wechselnder Kamera beiderseits einer Grenze
erreichte ueber 260 Abrufe hoechstens einen fertigen Chunk. Jetzt endet die erste
vollstaendige Auswahl im siebten Abruf; alle vier Chunks werden erreicht.
Das sind definierte synthetische Zeit-/Aufrufbudgets, keine Spielzeiten/FPS.

## Korrektur

- Ein Meshgenerator liest eine private Kopie der benoetigten Zeileneigenschaften,
  in 128er-Schritten erstellt. Weltchecks duerfen die Originalzeilen weiter
  aktualisieren. Ein begonnener Aufbau endet mit einem zusammenhaengenden
  Buffercommit; eine neuere Revision wird danach erneut eingereiht. Dadurch kann
  eine Farbe kurz hinter dem neuesten Weltstatus liegen, statt dass jede neue
  Beobachtung den gesamten Fortschritt verwirft. Fertige, unveraenderte Gruppen ruhen.
- Hoechstens zwei Generatoren bleiben gleichzeitig offen; normale Arbeit wird
  zuerst fertiggestellt, bevor weitere Gruppen ihre temporaeren Mesharrays
  aufbauen. Bevorzugte Arbeit teilt weiter das 3-ms-/128-Abschnittsbudget.
- Neue Auswahl, veraenderte Darstellung, Freigabe und Fehler schliessen den alten
  Generator und loeschen seinen Pendingbuffer. Der bisherige Commit bleibt bis
  zum neuen vollstaendigen Upload erhalten. Uploads weiter maximal 256 KiB.
- Originale 32er-Quellgruppen bleiben zusammen. Die zusaetzlichen 16er-Splits aus
  0.6.35 entfallen. Eine 32 x 1 x 32-Fixture hat dadurch eine statt vier Gruppen,
  sechs statt 16 Quads und vier statt sieben Overlay-/Compositezeichenvorgaenge.
  Aussenmasken, Aufloesung, Farbstaerken und gespeicherte Detailwerte bleiben.
- Eine laufende Kameraauswahl wird bei gleichem Mapping/gleichen Optionen und
  hoechstens 32 Bloecken Abstand zur Startkamera erst abgeschlossen. Die neueste
  Kameraanforderung bleibt als pending sichtbar und wird danach bearbeitet.
  Groessere Spruenge sowie explizite Layer-/Mapping-/Positionsaenderungen ersetzen
  sie sofort. Der Launcher kann einen wartenden Kameraauftrag dadurch nicht
  versehentlich als bereits erledigt behandeln.

## Pruefung und Grenzen

401 reine Node-/DOM-/VM-Tests,42 Syntaxdateien,beide generierten Preloads und
MemoryBudgetTests bestanden. Sieben neue Regressionen: Fortschritt bei laufenden
Statuswechseln und anschliessendes Ruhen, zusammengefasste Aussenflaechen,
unveraenderte Zeilensnapshots waehrend Generatorpausen, begrenzte offene Jobs mit
vollstaendigem Abschluss von 32 Gruppen, Uploadabbruch/Freigabe und Kameraauftraege
mit sofortigen ausdruecklichen Einstellungs-/Transformationswechseln.

Die Vergleichsquelle kommt aus `dist-bloxdy-v0.6.36/.../app.asar`, nicht aus einer
nachgebauten angeblichen Altversion. Nachweise und reproduzierbarer CPU-Vergleich:
`outputs/litematica-recovery-0.6.37/`.

Die sichtbare Vorschau erfasst weiterhin die Welt ein zweites Mal; deren
GPU-Kosten werden durch diese Aenderung nicht beseitigt. Groessere zusammenhaengende
Gruppen sparen Draws, eine lokale Statusaenderung kann dafuer mehr Geometrie neu
aufbauen. Diese Arbeit bleibt kooperativ verteilt. Renderdistanz und vom Nutzer
gespeichertes Surface-detail-Limit koennen weiterhin eine Ansicht begrenzen.

Keine echte 30-FPS-Ursachenmessung, vollstaendige Nutzerfehlereproduktion oder
bestaetigte Glitchfreiheit. Client-/Account-/Installer-/Grafikstarts und
Profilmutationen wurden nicht vorgenommen. Originalmodpakete, Place-/Menue-/
Leerlauffunktionen, Capture-/Shaderformeln und native-/Iris-/Accountpfade bleiben
erhalten. Reale FPS und Darstellung prueft ausschliesslich der Nutzer.

Release0.6.37: Setup/Portable/Update unter `dist-bloxdy-v0.6.37/` fertig und
bytegeprueft;49Paketquellen/nativeRessourcen passend,keineprivatenOrdner.
Setup/Update bytegleich. Gegen0.6.36 nurzweiLitematicaadapter/package.jsonanders,
beideNativeEXEs/Originalkataloge/Shaderliterale/Qualitaetsdefaults bytegleich.
Version/Lock synchron. Pruefsummen imReleaseordner,Distribution-/Scope-/Buildlogs
im genannten Nachweisverzeichnis. Nichts gestartet/installiert/hochgeladen.
