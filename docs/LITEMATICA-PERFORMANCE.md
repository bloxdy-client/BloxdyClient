# Litematica performance, Client 0.6.27

20. Oktober 2026. Nutzer meldet viele FPS-Drops und allgemein niedrige FPS mit
Litematica. Keine Live-Reproduktion und kein gespeicherter F9-Messlauf fuer diesen
Auftrag. Analyse und Nachweise verwenden den vorhandenen 0.14.1-Katalogsnapshot
und reine Node-/DOM-/VM-Pruefungen. Keine Client-, Account- oder Grafikstarts.

## Nachgewiesene Arbeit im bisherigen Code

- `renderer.js` ruft den Vorlagenlieferanten sowohl vor als auch nach der
  Weltgruppe auf. Dabei koennen Chunkansichten und mehrere Platzierungen erneut
  vorbereitet werden. Gepinnte Ansichten besitzen jeweils ihr eigenes 3-ms-Budget.
- Der Tiefenabgleich zeichnet die echten Weltaufrufe in einen separaten
  Vollaufloesungspuffer nach. Vorher passiert dies auch bei vollstaendig korrekten,
  ausgeblendeten oder ausserhalb des Bildes liegenden Vorlagen ohne sichtbare
  Vorschauflaeche. Dazu kommen zwei komplette GL-Zustandsabfragen pro Frame.
- Blockpruefungen laufen pro Frame, bis zu 512 Zellen beziehungsweise 1,5 ms.
  Ein neuer Zeilenindex wird ohne Unterbrechung vollstaendig aufgebaut.
- Normale Spieleinstellungen bauen auch das komplette Litematica-Menue auf.
  Materialtabellen und versteckte UI-Bereiche werden weiter aktualisiert.
- Bei mehreren Platzierungen werden wachsende Quellarrays bisher nur ueber ihre
  Identitaet erkannt. Anhaenge an dasselbe Array werden uebersehen; naives
  vollstaendiges Kopieren dieser Listen wuerde seinerseits neue Spitzen erzeugen.

## Clientinterne Behebung

`launcher/litematica-performance.cjs` adaptiert ausschliesslich die beiden
SHA-256-geprueften Dateien `renderer.js` und `litematica.js` waehrend der vorhandenen
Preloaderzeugung. Auch bereits installierte Katalogdateien erhalten damit den
Fix. Originalmod, Kataloghashes, Spielrenderer, native Bruecke und Shader bleiben
erhalten. Keine gespeicherten Profile oder Einstellungen werden umgeschrieben.

Vorlagenvorbereitung, Index und Blockklassifikation laufen vor der Weltaufnahme.
Fruehe Gruppe -1 und regulaere Gruppe 0 teilen dieselbe Vorbereitung. Nur eine
tatsaechlich zeichnungsfaehige Gruppe im konservativen Bild-/Entfernungsbereich
oder eine sichtbare Auswahlbox aktiviert die Welterfassung. Korrekte Bloecke,
deaktivierte Fehlerfarben und unsichtbare Platzierungen brauchen keine Aufnahme.
Blockpruefungen und Meshaufbau gehen dabei weiter, sodass spaetere Welt- oder
Einstellungswechsel die Vorschau automatisch zurueckbringen.

GL-Zustand wird erst bei wirklicher GPU-Arbeit gelesen. Neue Texturen werden nur
bei ausstehendem Upload durchsucht. Quads werden beim Bau/Entfernen inkrementell
gezaehlt. Bei sichtbarer Vorschau bleiben die bisherige Aufnahme, volle Aufloesung,
Originalshader, Tiefen-/Alpharegeln, Zustandswiederherstellung und Vordergrundmaske
erhalten. Die notwendige zweite Weltzeichnung bei sichtbarer Vorschau bleibt ein
GPU-Kostenpunkt; kein allgemeiner FPS- oder vollstaendiger Dropfix behauptet.

Blockpruefungen verwenden eine 50-ms-Kadenz mit hoechstens 1.536 Zellen und 1 ms
kooperativem Budget; kein Nachholen verpasster Intervalle. Der Mengendeckel
entspricht bei 20 Hz dem alten 512er-Deckel bei 60 Hz, das Zeitbudget reduziert
die dauerhafte CPU-Last. Grosse Indizes pausieren nach 128er-Gruppen bei 0,75 ms.
Nur bereits indexierte Zellen werden gelesen; unvollstaendige Ersatzindizes
halten noch benoetigte eigene GPU-Ressourcen bis zum Abschluss vor. Meshbau
behaelt sein bisheriges 3-ms-Budget. Einzelne JS-/Treiberoperationen sind dabei
nicht unterbrechbar; dies ist keine harte Framezeitgarantie.

Aktive und gepinnte Chunkansichten teilen 3 ms Vorbereitungszeit je Frame.
Gepinnte Ansichten beachten den bisherigen 16-/100-ms-Rhythmus. Wachsende
Zeilenlisten und zusammengesetzte Ansichten haengen nur neue Zeilen an und
behalten vorhandene Objekte; echter Ersatz baut die Ansicht neu auf.
`retainPrevious`-Abschluss wird auch ohne Arrayersatz weitergereicht.

Normale Einstellungen erhalten nur den Reiter. Erst Auswahl von Litematica baut
die komplette Seite; Kategorienwechsel haengt sie ab, spaetere Auswahl verwendet
dieselben Controls. Versteckte Materialtabellen und Seiten werden nicht weiter
aktualisiert. Alle bisherigen Optionen und gespeicherten Qualitaetswerte bleiben.

## Reine Nachweise

316 Tests, 38 Syntaxdateien und beide generierten Preloads bestanden;
MemoryBudgetTests bestanden. Zwoelf neue Litematica-CPU-/VM-Tests und ein neuer
gemeinsamer Preload-/DOM-Test pruefen unter anderem:

- korrekt -> fehlend, Offscreen -> sichtbar, Distanzwechsel, Fehlerfarben,
  100-Prozent-Transparenz und Rueckkehr, Auswahl, Disable und Ressourcenfreigabe;
- erforderliche Aufnahme mit derselben Vollaufloesung und wiederhergestelltem
  Quellframebuffer; Originalweltaufruf bleibt erhalten;
- Kadenz, Pause ohne Nachholsturm, Invalidierung und fruehe/regulaere Weltgruppen;
- unterbrochene Indexierung, Ersatz waehrenddessen und spaeteres Anhaengen;
- mehrere Platzierungen, gemeinsames Budget, identische Zeilen-/Arrayobjekte
  beim Anhaengen, Abschluss des vorherigen Sichtbereichs;
- gemeinsamer Shader-/Litematica-Preload mit erst auf Auswahl gebauter und nach
  DOM-Menueersatz wiederverwendeter vollstaendiger Litematica-Seite.

600 synthetische Frames mit dem echten Original-/Adaptercode und einer inerten
JavaScript-GL-Attrappe liefern folgende **Aufrufzahlen, keine gemessenen FPS**:

| Fall | Original / adaptiert: Weltwiederholungen | Vorlagenabrufe | GL-Zustandslesungen |
| --- | --- | --- | --- |
| vollstaendig korrekt | 600 / 0 | 1.200 / 600 | 51.600 / 42 |
| ausserhalb des Bildes | 600 / 0 | 1.200 / 600 | 51.600 / 42 |
| sichtbar und fehlend | 600 / 600 | 1.200 / 600 | 51.600 / 51.600 |

Der unveraenderte Originalrenderer reproduziert die unnoetigen Aufrufe im selben
Test. Berichte: `outputs/litematica-performance-0.6.27/verification.json`,
`unit-tests.tap`, `change-scope.json`, `distribution.json`. Releasepruefung liest
nur Paketbytes, keine EXE-Ausfuehrung oder Installation.

## Verbleibende Nutzerpruefung

Die tatsaechlichen FPS und Drops im betroffenen Modus bleiben ungemessen. Nutzer
kann dieselbe Welt/Vorlage mit 0.6.27 pruefen, auch nach Import, beim Drehen sowie
mit fertiger/ausgeblendeter Vorlage. Bei weiterem Fehler F9-Messlauf durch den
Nutzer speichern; vorhandene Berichte duerfen anschliessend nur gelesen werden.
