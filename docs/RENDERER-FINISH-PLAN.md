# Tagesplan bis Sonntag, 18. Oktober 2026

Fortschreibung22.Oktober,0.6.39: kanonischer Vertrag3 mit zehn exakten
Treppenfamilien (40 Formen/Zustaende je Familie) und Jungle-/Cherry-Tuerhaelften.
Drehungen/Half/Eckformen geometrisch gegen Java26.3 geprueft; Links/Rechts bei
Quelltreppenecken bewusst vertauscht. Tueren rechts angeschlagen, powered
unbekannt; Pack-ID nur bei Konsens beider Powerwerte. Reine Capture-/Pipe-/
Welt-/Shadowtests, keine Produktionsaktivierung oder echte Bild-/FPS-Abnahme.
Naechster begrenzter Materialteil: belegte Log-Achsen/Holzarten und Grass-Block-
Zustaende, danach eigener Fluidvertrag. Uebrige Referenzdaten/Packfeatures/
Gesamtziel offen. [SHAPED-BLOCK-MAPPING.md](SHAPED-BLOCK-MAPPING.md).

Fortschreibung21.Oktober,0.6.32: interner begrenzter Resolver fuer bereits
vorverarbeitetes block.properties samt PackBlockId-Zeichenkonstante umgesetzt.
Keine produktive Loaderaktivierung oder komplette Packausfuehrung. Slabhinweis
des Nutzers geprueft: sechs genau belegte nichtfluessige Slabfamilien jetzt
waterlogged=false. Tueren/Treppen haben entsprechende Grundzustaende; deren
exakte Referenzabbildung bleibt naechster Quellen-/Materialteil. Praeprozessor,
Tags/Legacy/Layer, uebrige Referenzdaten und Nutzerabnahme weiter offen.
[PACK-BLOCK-MATERIAL-IDS.md](PACK-BLOCK-MATERIAL-IDS.md).

Fortschreibung21.Oktober,0.6.31: explizite Minecraft-Namen-/State-Zuordnung fuer
30 Vollblockfamilien und6 Slabfamilien umgesetzt. Slab-Wasserzustand und
unbelegte Varianten bleiben unbekannt. Naechster Materialteil ist die
packabhaengige Name-/Property-zu-ID-Aufloesung im separaten Shaderloader.
Schritt1/Gesamtziel und alle anderen Daten-/Produktions-/Nutzerabnahmegates
bleiben offen. Historische Tagesdaten sind keine neue Terminzusage.
[MINECRAFT-BLOCK-MAPPING.md](MINECRAFT-BLOCK-MAPPING.md).

Fortschreibung21.Oktober,0.6.30: Begrenzte beobachtete Quellname-/Familie-/
Variantenzustaende und effektive Renderproperties erreichen nun die native
Dictionary-/Drawkette. Naechster Materialteil ist die explizite begruendete
Minecraft-Name-/State-Abbildung; sie ist weiterhin nicht implementiert. Alle
anderen Referenz-/Quellen-/Produktions-/Nutzerabnahmegates bleiben offen.
Details: [SOURCE-BLOCK-MATERIALS.md](SOURCE-BLOCK-MATERIALS.md).

Fortschreibung 20. Oktober,0.6.29: Die folgenden Tagesdaten sind historisch und
keine neue Terminzusage. Im offenen Daten-/Materialblock erreicht jetzt belegte
rohe Quellblockidentitaet die echten Iris-Welt-/Shadowdraws. Naechster Materialteil:
exakte Quellname-/Propertyregistry mit Generationsbezug, danach explizite belegte
Minecraft-Name-/State-/Packzuordnung. Weltzeit/Wetter, Referenzlightmap/Scalar und
HUD-Handdaten bleiben offen; Schritt1 ist nicht komplett. Aktuelle Matrix und
Grenzen: [SOURCE-BLOCK-IDENTITY.md](SOURCE-BLOCK-IDENTITY.md).

Stand: Donnerstag, 15. Oktober; experimenteller Renderer 0.6.19.
Fortschreibung 16. Oktober: interner Zielgraph und explizite Gbuffers-/Shadow-
Geometriebindungen samt Referenz-Handprojektion/Tiefenkompression umgesetzt.
Produktionsaktivierung weiter aus: autoritative aktuelle Hand-/Spieler-/Welt-
und Semantikdaten, weitere Quellenadapter sowie GPU-/Bild-/FPS-Abnahme fehlen.
Verbindliche Details: IRIS-GEOMETRY-BINDINGS.md und die aktualisierten Abschlussgates.
Ziel: vollständiger Renderer für Minecraft Java 26.3 / Iris 1.11.7 nach den
Abschlussbedingungen in MINECRAFT-RENDER-CONTRACT.md. Shaderloader bleibt die
vereinbarte spätere separate Mod. Dieser ambitionierte Ablauf ist keine
belastbare Zusage: Quelldatenlücken und echte Renderfehler können länger dauern.

## Nutzung und Modelle

Aktuelle Nutzervorgabe: tägliche Oktober-Komplettresets für die Planung annehmen;
das Wochenlimit wird deshalb nicht als Planungsgrenze berücksichtigt. Es wird
kein Reset automatisch eingelöst, kein Kauf oder zusätzliches Abo vorausgesetzt.
Das 5-Stunden-Fenster bleibt für den Verbrauch innerhalb eines Runs relevant.

Die Stunden unten sind grobe aktive Arbeitsbudgets einschließlich Analyse,
Implementierung und erlaubter Prüfung. Sie sind keine abrechenbaren
Nutzungsstunden und keine garantierte Dauer bis zum Abschluss. Ein 5-Stunden-
Limit ist keine Zusage für fünf Stunden Dauerarbeit. Modell, Kontext,
Reasoning, Werkzeuge und Fehlerkorrekturen verändern den Verbrauch. Genaue
Prozentwerte pro Baustein sind ohne vergleichbare Messläufe nicht belastbar.
Vor und nach einem größeren Codingrun die Live-Limits lesen und den weiteren
Plan anhand des gemessenen Verbrauchs anpassen.

GPT-6 Astra High für die schwersten Architektur-/GPU-Bausteine; GPT-6.1 Sol
High für wiederholte Implementierung, Integration und Fehlerbehebung. Extra
High (xhigh) gezielt bei einem festgestellten schweren Problem, nicht pauschal
für jeden Run. Medium für klar eingegrenzte einfache Abschlussarbeiten; Luna
High kann nach technischer Prüfung reine Berichte/Paketlisten übernehmen.
Modell und Reasoning im Modellwähler einstellen; ein Prompt allein ist keine
zuverlässige Änderung der Modellkonfiguration. Standard-Geschwindigkeit für
die Planung; Fast verbraucht laut Dokumentation mehr inkludierte Nutzung.

Offizielle Quellen, am 15. Oktober gelesen:
- [Modelle und Reasoning](https://learn.chatgpt.com/docs/models)
- [Nutzungsgrenzen und Geschwindigkeit](https://learn.chatgpt.com/docs/pricing)

## Tagesübersicht

| Tag | Baustein | Arbeitsbudget | Empfohlenes Modell / Reasoning | Risiko fürs 5-h-Kontingent |
| --- | --- | --- | --- | --- |
| Do., 15.10. | Iris-Rendergraph und Stufen-/Pufferlebenszyklus | 4–6 h | GPT-6 Astra High | hoch |
| Fr., 16.10. | Autoritativer Welt-/Materialvertrag und Vertex-/Instanzvertrag | 6–10 h | GPT-6.1 Sol High; gezielt Extra High bei schwerer Semantik-/Matrixfrage | hoch |
| Sa., 17.10. | GPU-Partikel, Sprites und verbleibende Materialien/Entities/Kameras | 8–12 h | GPT-6 Astra High | sehr hoch |
| So., 18.10. | Integration, Bild-/FPS-Abnahme, Fehlerbehebung und Abnahmepaket | 4–8 h | GPT-6.1 Sol High; Medium für einfache Abschlussarbeiten | mittel bis hoch |

Gesamt: grob 22–36 aktive Arbeitsstunden, zusätzlich etwa 2–4 Stunden manuelle
Nutzerprüfung über die Tage verteilt. Größere unbekannte Programme oder fehlende
autoritative Werte können erheblich mehr Zeit erfordern. Ein einzelnes
5-Stunden-Kontingent pro Tag ist für diese Arbeitsbudgets nicht zugesichert.

## Gemeinsame Regeln

AGENTS.md und aktuellen PROJECT-CONTEXT.md zuerst lesen. Nur experimentellen
Renderer entwickeln. Default-Bloxd-Renderer, Originalmodule, Sichtweite 10,
aktive Auswahl, Budgets und Fallback-/Besitzschutz erhalten. Keine Quelldaten
erfinden oder Simulation/Quellzustand verändern. Kein Client-, Browser-,
Preview-, Account- oder Grafikkontextstart durch den Agenten, auch nicht indirekt.
Nur explizit erlaubte reine Tests, Compiler und Builds. Alle echten Clienttests
führt der Nutzer aus. Fortschritt und offene Gates am Runende dokumentieren.

Pro Run einen zusammenhängenden Baustein bis zu seinen Abnahmekriterien
bearbeiten. Installer am Tagesabschluss oder für eine konkrete Nutzerprüfung
paketieren. Breite Tests nur nach Änderungen oder für ein konkretes Risiko
wiederholen. Fallback gilt nicht als implementierte Quellenabdeckung. Keine
neuen kosmetischen Effekte vorziehen. Vollständige Referenzverträge bleiben
verbindlich; der Termin reduziert ihren Umfang nicht.

## Donnerstag: Iris-Rendergraph

Arbeitsstand 15. Oktober: Ausfuehrbare Graph-/Ressourcenmechanik und echte
Renderer-Anbindung implementiert und rein geprueft; Details/Nachweise in
[IRIS-RENDER-GRAPH.md](IRIS-RENDER-GRAPH.md). Vollstaendige Referenzbindung bleibt
offen: native Geometrieadapter sind noch keine allgemeinen Iris-Programme,
Clear-Handgruppen benoetigen passende Handprojektion, optionale Image-/Setup-/
Sampler-/Viewportvertraege und Produktionsaktivierung fehlen. Diesen Tagesblock
nicht pauschal als komplett abgenommen behandeln. Keine automatische Aktivierung
von Testprogrammen und keine Bild-/FPS-Abnahme durch den Agenten.

Hinzufügen: explizite Stufenplanung und Ressourcenlebensdauer auf der vorhandenen
Fullscreen-Laufzeit. Die benötigten Compute-/Image-/SSBO-Verträge gehören zur
Prüfung der Pipeline, soweit sie Teil der festgelegten Referenz sind; bloße
Stufennamen schließen keine Implementierungslücke.

Nutzerprüfung heute: 20–30 Minuten F8/F9-Basislauf. Festhalten, ob tatsächlich
native Ausgabe oder Source-Fallback vorliegt. Der Agent liest anschließend nur
die vorhandenen lokalen Messdateien. So wird die Abnahme nicht auf Sonntag
verschoben.

Kopierbarer Prompt:

```text
Lies zuerst AGENTS.md, den aktuellen PROJECT-CONTEXT.md und
docs/MINECRAFT-RENDER-CONTRACT.md. Implementiere als nächsten zusammenhängenden
Baustein den Iris-Zielrendergraph auf der nativen 0.6.19-Laufzeit: echte
Begin-/Shadow-/Shadowcomp-/Prepare-/Gbuffers-/Deferred-/Composite-/Final-Stufen,
explizite Ein-/Ausgaben, Reihenfolge, Depth-/Handgrenzen, Clear-/Flip-/Persistenz
und Fehlerweitergabe. Prüfe die erforderlichen Programm-, Compute-/Image-/SSBO-
und Pufferverträge gegen Primärquellen unserer festgelegten Referenz. Keine
leeren Platzhalter als erledigte Stufen zählen. Shaderloader bleibt separat;
verwende interne Engineprogramme und kontrollierte Prüfprogramme. Erhalte
Speichergrenzen und bedarfsgesteuerte Ressourcen. Prüfe Reihenfolge, Bindungen,
State-Wiederherstellung und fehlgeschlagene Frames mit erlaubten reinen Tests
und Compilern. Aktualisiere Projektstand und offene Gates. Niemals Client oder
Accounts starten/bedienen; Defaultmodus und Schutzregeln erhalten.
```

Abnahme: nachvollziehbare echte Stufen, passende Ressourcen und Bindungen,
keine unerlaubten Feedbacks oder Fehlercommits. Alle verbleibenden Vertragslücken
werden einzeln aufgeführt.

## Freitag: Welt-, Material-, Vertex- und Instanzvertrag

Hinzufügen: tatsächliche Quellen und Gültigkeit der Welt-/Spielerwerte,
nachvollziehbare Material-/Blocksemantik, vollständige Geometrie-/Instanz- und
Koordinatenbindungen. Zwei einzeln prüfbare Arbeitsblöcke einplanen. Früh klären,
welche Pflichtwerte nicht aus der Quelle gewonnen werden können; diese Frage
beeinflusst den Fertigstellungstermin direkt.

Kopierbarer Prompt:

```text
Lies zuerst AGENTS.md, den aktuellen PROJECT-CONTEXT.md und den Rendervertrag.
Schließe die Daten- und Geometrieverträge für Minecraft Java 26.3 / Iris 1.11.7
in zwei prüfbaren Blöcken. Ermittle echte Quellen für Weltzeit, Wetter,
Spieler-/Augen-/Fußposition, Licht, eigene Blockemission und Block-/Material-
eigenschaften; übertrage Werte mit Herkunft und expliziter Gültigkeit. Bloxd-IDs
dürfen nicht als Minecraft-Semantik ausgegeben werden. Vervollständige Vertex-/
Instanz-/Koordinatenbindungen, bewegte Thin-Instanzidentitäten, Quadmitten,
Blockzentren, Atlasraum und Schatteneingaben der bereits geladenen Welt.
Erfinde keine fehlenden Pflichtwerte und streiche keine Abnahmekriterien.
Prüfe insbesondere Rebase, Resize, Identitätswechsel und Framefehler mit den
erlaubten CPU-/VM-/GLSL-Prüfungen. Dokumentiere Herkunft, Implementierung und
offene Gates. Keine Client-/Accountstarts; Defaultmodus, Sichtweite, aktive
Auswahl, Originalmodule und Schutzregeln erhalten.
```

Abnahme: jeder Pflichtwert hat eine belegte Quelle oder einen ausdrücklich
offenen Status. Instanzbewegung und Koordinatenwechsel erzeugen keine erfundene
Historie. Eine Quelldatenlücke wird nicht durch einen Defaultwert abgeschlossen.

## Samstag: Quellenabdeckung

Hinzufügen: GPU-Partikel und Sprites, danach verbleibende Material-, Entity- und
Kameravarianten. Bekannte echte Sourceprogramme und ihre Zustände vollständig
abbilden. Weniger gemeldete Fallbacks allein sind kein Funktionsnachweis.

Kopierbarer Prompt:

```text
Lies zuerst AGENTS.md, den aktuellen PROJECT-CONTEXT.md und den Rendervertrag.
Schließe die verbleibende native Quellenabdeckung in zwei prüfbaren Blöcken:
zuerst echte GPU-Partikel und Sprites, danach verbleibende Materialien,
Entityvarianten, kombinierte Cape-/Skelettfälle und Kamera-/Overlayvarianten.
Ermittle die wirklichen Sourceprogramme und Bufferverträge anhand ihrer
Quellen. Übernimm ausschließlich aktive echte Szenendaten, ohne Simulation,
zusätzliche Chunkanforderungen oder Mutation der Quellszene. Erhalte Texturen,
Posen, Alpha-/Depth-/Blend-/Sortierregeln und Ressourcenlebensdauer; verbinde
die Wege mit dem Rendergraph. Fallback ersetzt keine angeforderte Umsetzung:
für weiterhin unbekannte Zustände erhalten und die Lücke offen ausweisen.
Prüfe Pakete, Ressourcen, Limits, Freigabe, Fallback und Wiederaufnahme mit
erlaubten reinen Tests/Compilern. Aktualisiere die konkrete Abdeckungsmatrix
und paketiere einmal für meine Nutzerprüfung. Client und Accounts niemals
starten oder bedienen. Defaultmodus und alle Schutzregeln erhalten.
```

Abnahme: benötigte Wege werden tatsächlich nativ ausgegeben, Ressourcen korrekt
freigegeben und nicht unterstützte Zustände ehrlich erfasst. Der Nutzer prüft
die entsprechenden Szenen, damit Bildfehler vor Sonntag bekannt werden.

## Sonntag: Integration und Abnahme

Hinzufügen/abschließen: Verbindungen zwischen allen Bausteinen, Behebung echter
Bild-/Stabilitäts-/Leistungsfehler, Abnahmematrix und separates geprüftes Paket.
Die Nutzerbeobachtungen aus den vorherigen Tagen werden schon vorher bearbeitet;
Sonntag ist für Abschlussintegration und erneute Abnahme reserviert.

Kopierbarer Prompt:

```text
Lies zuerst AGENTS.md, den aktuellen PROJECT-CONTEXT.md und den Rendervertrag.
Führe die Abschlussintegration des experimentellen Renderers durch. Prüfe jede
Abschlussbedingung gegen konkrete Implementierung und Nachweise. Behebe die in
meinen lokalen F8/F9-Messungen und Rückmeldungen erkennbaren Bild-, Stabilitäts-
und Leistungsfehler. Unterscheide Source-Fallback und echte native Ausgabe;
keine FPS aus Mocktests oder Vermutungen ableiten. Prüfe die Verbindungen von
Stufen, Weltwerten, Materialien, Instanzen, Historie, Partikeln, Sprites und
Ausgabe sowie Resize, Rebase, Weltwechsel und Fallback/Wiederaufnahme. Führe
passende erlaubte Regressionen aus, baue ein separates Abnahmepaket und prüfe
die Paketdateien. Gib pro Gate bestanden/offen mit Beleg an. Du startest oder
bedienst niemals Client oder Accounts. Fehlende Nutzerbeobachtungen bleiben
offen. Markiere den Renderer erst als abgeschlossen, wenn alle technischen
Gates und meine echte Bild-/FPS-Abnahme erfüllt sind.
```

## Entscheidung über den Abschluss

Alle fünf Gates aus MINECRAFT-RENDER-CONTRACT.md müssen geschlossen sein:
Quellenabdeckung, autoritative Semantik, Geometrie/Koordinaten, Referenzpipeline
und nutzerbediente GPU-Abnahme. Kein Testzähler und kein Modell ersetzt diese
Nachweise. Wenn am Samstag Daten oder ganze Wege fehlen, ist der Termin neu
zu bewerten. Sie werden am Sonntag nicht zu fertigen Features umbenannt.
Keine Hintergrundautomation eingerichtet; dieser Auftrag ändert nur den Plan.
