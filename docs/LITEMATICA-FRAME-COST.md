# Litematica visible-frame costs, Client 0.6.34

21. Oktober 2026. Nutzer meldet weiterhin glitchy Vorschauen, extremen FPS-Verlust
und starke Drops nach dem Laden, unabhaengig von Schematicgroesse und sichtbarer
Blockzahl. Die bisherigen 0.6.27-/0.6.28-Fixes haben den Gesamtfehler nicht geloest.
Keine neue Live-Reproduktion oder gemessene Nutzer-FPS behaupten.

## Gelesene Laufdaten

Neuester vorhandener Nutzerlauf `0893086fe996712ed9af5007`: Litematica und No Ads,
alle Litematica-Skripte als geladen protokolliert. Kein gespeicherter F9-Bericht.
Der generierte Preload enthaelt die bisherigen Lade-/Performanceadapter. Ein
separater No-Ads-CSS-Startupfehler ist vorhanden; er beweist keine Ursache der
Litematica-Drops und ist nicht Gegenstand dieses Rendererfixes. Nur Dateien
gelesen; keine Sitzung, Einstellungen oder Accountdaten bedient/geaendert.

## Nachgewiesene feste Kosten

Die sichtbare Vorschau erfasst weiterhin die Welt in einem eigenen Ziel. Bisher
wurde nach JEDEM Quellzeichenvorgang das DRAW_FRAMEBUFFER auf das Captureziel und
zurueck gebunden. Bei 1.000 Weltaufrufen sind das 2.000 zusaetzliche Bindungen,
auch fuer eine sehr kleine Vorschau. Fragment-Scissor und weniger Vorlagenbloecke
verhindern diese Wechsel und die erneute Weltgeometriearbeit nicht.

Die Vordergrundmaske suchte zusaetzlich alle 500 ms in allen Szenenmeshes und bis
zu 16 Parents je Mesh nach Spieler-/Handgeometrie. Die Spitzengroesse dieser
Schleife hing an der Welt, nicht an der Vorlage.

## Umsetzung

`launcher/litematica-capture.cjs` wird nach den bisherigen Adaptern auf die
SHA-geprueften Originaldateien angewendet. Der Katalog und bestehende originale
Installationsdateien bleiben gleich; auch bereits installierte Mods erhalten
die Anpassung durch den neuen Clientpreload.

Direkte native WebGL2-Zeichenaufrufe werden weiterhin sofort mit denselben
Argumenten auf dem Quellziel ausgefuehrt. Ausschliesslich ihre zweite Aufnahme
wird innerhalb der Weltgruppe gebuendelt. Programm-/Uniform-/VAO-/Textur-/Sampler-
und Rasteraenderungen werden in Reihenfolge auf dem privaten Captureziel
wiedergegeben. Benoetigte Anfangswerte werden vor ihrer ersten Aenderung gesichert;
Uniformaliase werden in umgekehrter Reihenfolge restauriert. Wiederverwendete
einzelne Vektor-/Matrixarrays werden kopiert. Keine pauschalen Uniformabfragen
pro Draw; vor der ersten Programmverwendung gesetzte Werte brauchen keine.

Ressourcenwrites, Uploads, Geometrieattribute, Elementbuffer-, UBO-, Attachment-,
Framebuffer-, Stencil- und Bulk-/Offset-Uniformaenderungen sind Grenzen: Vorherige
Leser werden VOR dem echten Quellwrite fertig aufgenommen. Der Write selbst
laeuft nur einmal. Bulk-Uniforms werden nicht als vollstaendige Arrays geraten.
Maximal 4.096 Befehle und 1 MiB konservativ abgerechneter Befehls-/Argumentdaten
je Batch; ein voller Batch wird geordnet abgeschlossen. Das ist keine Messung
der JavaScript-Heapgroesse oder harte Framezeitgarantie.

Bei bereits vor der Erfassung umwickelten Zeichenmethoden und Multi-Draw bleibt
die bisherige unmittelbare Aufnahme als Kompatibilitaetspfad. Dort wird keine
gleich starke Wechselreduktion behauptet. Native Queries/Transformfeedback
pausieren die Aufnahme mit Status, statt Quellabfragen oder Ausgabebuffer durch
zusaetzliche Draws zu veraendern. Ein Capturefehler verwirft die eigene Vorschau,
restauriert den letzten Quellzustand und unterdrueckt keine Quellaufrufe.

Scissor wird je sekundarem Draw mit dem Quellbereich geschnitten. Das Quellziel
wird nur fuer die Aufnahme verlassen; READ_FRAMEBUFFER/READ_BUFFER werden nicht
umgebunden, Quelltiefe wird nicht gelesen, ersetzt oder geloescht. Volle bisherige
Aufloesung, Farbwrites bei Wrong/Extra, Shader, Texturen, Alpha-/Tiefenregeln und
Vordergrundgeometrie bleiben erhalten. Keine neuen GPU-Ziele oder Qualitaetswerte.
Die zusaetzlichen Weltzeichnungen selbst bleiben: kein Versprechen kostenloser
Vorschauen oder vollstaendiger Dropfreiheit.

Bei reiner Tiefenaufnahme werden direkte native Draws ohne moeglichen Tiefen-
oder Stencilwrite nicht erneut ausgefuehrt. Beobachtete Depthmask/Depthtest und
Stenciltest entscheiden; Quellaufgaben laufen normal. Wrong-/Extra-Farbaufnahme,
Stencil und umwickelte Methoden behalten die benoetigten Draws. Eine nur aus
solchen Himmelaufrufen bestehende Szene behaelt ihren gueltigen geclearten
Tiefenstand und damit die Vorschau. Keine Vermutung anhand von Materialnamen.

Vordergrundentdeckung verwendet vorhandene Mesh-Add-/Remove-Ereignisse plus eine
rollende Nachpruefung fuer spaetes Parenting. Maximal 128 Meshpruefungen und ein
kooperatives 1-ms-Budget je sichtbarem Frame, davon hoechstens 64 neue Kandidaten;
maximal 256 ausstehende Kandidaten je Szene. Eine abgeschlossene Szene wartet
wie bisher 500 ms bis zum naechsten Audit. Grosse Audits werden verteilt; damit
kann ein bereits vorhandenes, erst spaeter umgehaengtes Mesh spaeter als nach
500 ms erkannt werden. Neue Ereigniskandidaten werden bevorzugt. Ergebnislisten
werden unveraendert wiederverwendet, Szenenersatz/Disconnect/Destroy entfernen
eigene Listener. Kein unbegrenzter Weltszenen-Vollscan in einem einzelnen Aufruf.

## Reine Nachweise

Die CPU-/VM-Regressionen vergleichen Quell- und Captureaufnahmen mit wechselnden
Programmen, Matrizen, Uniformen samt Aliasen, VAOs, Texturen und Samplern. Weitere
Faelle: mutable Arrays, Sourceupload zwischen Draws, Offscreenziel, Stencil-/Bulk-
Grenzen, Budgetflush, Capturefehler, originale Returns/Exceptions, Queries,
Transformfeedback, alte umwickelte Drawmethoden und Hookbesitz/Detach.

Im echten alten/neuen Native-Frame-Code mit inerten JavaScript-GL-Recordern:
1.000 unveraenderte Weltaufrufe ergeben dieselben 1.000 Captureaufrufe und
**2.000 -> 2 DRAW_FRAMEBUFFER-Bindungen** im gemessenen Abschnitt. Uploads und
andere Grenzen koennen weitere Batches erzeugen; dies ist keine allgemeine
Anzahlgarantie und keine GPU-Zeit-/FPS-Messung.

Eine 20.000-Mesh-Fixture prueft die begrenzte Auditmenge sowie sofortige
Ereignisentdeckung, Entfernung, Parent-/Kamerawechsel, Terrainausschluss,
Szenenersatz und Listenerfreigabe. Bestehende Tests fuer Parser, progressive
Ansichten, Auswahl, Farb-/Tiefenaufnahme, volle Aufloesung, regionale Scissor,
VAOs, Uploadabbruch und gemeinsame Modmenues bleiben Teil der Verifikation.

Vollstaendige Test-/Paketberichte unter `outputs/litematica-frame-cost-0.6.34/`.
369 reine Tests,41Syntaxdateien,beidePreloads und MemoryBudgetTests bestanden.
Keine Client-/Account-/Installer-/Grafikstarts oder Profilmutation. Reale FPS,
Dropverhalten und sichtbare Glitches bleiben ausdruecklich Nutzerpruefung.
