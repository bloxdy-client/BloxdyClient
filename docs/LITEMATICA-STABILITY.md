# Litematica: native Maustaste und Frameabschluss, 0.6.38

22. Oktober 2026. Nutzer meldet weiter unbrauchbare Platzierung und extrem
flackernde Vorschau. 0.6.37 hat seinen Gesamtfehler nicht geloest. Der zuletzt
vorhandene Nutzerlauf laedt Litematica und No Ads ohne Startupfehler; Build-Modus
und EZ Building sind eingeschaltet. Kein gespeicherter F9-Messbericht.

## Konkreter Eingabefehler

Das bisher unveraenderte `building.js` konsumiert `inputs.down.emit('alt-fire')`
und teils auch das zugehoerige Loslassen. Dadurch fehlen dem offiziellen Client
seine normalen rechten Maustastenereignisse. Die nur gelesene Quellreferenz
`outputs/renderer-source-audit/public-8.js` verbindet diese beiden Ereignisse
unter anderem mit DownFireSecondary/UpFireSecondary und dem nativen Held-Zustand.
Diese Referenz ist Quellenkontext, keine Behauptung exakter Live-Bundleabdeckung.

Zusaetzlich ruft der Bindungswechsel nach einem automatischen Hotbarwechsel
`detach()` auf. Das beendet den noch vom Nutzer gehaltenen Klick. In der
CPU-Fixture mit dem echten ausgelieferten 0.6.37-Adapter: verzogerte native
Hotbarauswahl, danach kein Platzierungsaufruf, Held=false und nur das Up-Ereignis.
Jetzt: ein nativer Platzierungsaufruf, Held=true bis zum Loslassen und genau ein
unveraendertes Down-/Up-Paar. Kein zusaetzlicher Nutzerklick erforderlich.

Der SHA-gepruefte Adapter fuer `building.js` laesst die nativen Ereignisse mit
ihren Argumenten, Rueckgaben und Ausnahmen durch. Nur der eigentliche native
Blockplatzierungsaufruf bleibt durch die vorhandene Schematiclogik gefuehrt.
Ein Hotbar-/Held-Item-Wechsel in derselben Welt mit denselben Inputs erhaelt eine
noch gehaltene Geste. Loslassen, Blur, Menue, Weltwechsel und Deaktivieren brechen
weiter ab. Ein Adapterfehler macht den ausdruecklichen nativen Nutzerklick wieder
verfuegbar; eine Ausnahme des originalen Place-Aufrufs wird nicht verschluckt oder
erneut ausgefuehrt. Native Rechte-/Inventar-/Serverpruefungen bleiben erhalten.
Keine direkt geschriebenen Weltbloecke oder erfundenen Netzwerkpakete.

## Frame- und Tiefenfehler

Die Vorschau begann ihre Aufnahme bereits vor Gruppe -1, wartete mit dem
Zusammensetzen aber auf die als vorhanden markierte Gruppe0. Bleibt deren
Ereignis aus, konnte die Aufnahme ueber mehrere Frames offenbleiben. Weitere
Begin-Aufrufe wurden dann uebersprungen. Ein definierter 12-Frame-Test mit nur
zwei tatsaechlichen Gruppe0-Ereignissen erzeugte bisher nur zwei Vorschauframes.
Mit dem neuen Abschluss entstehen zwoelf von zwoelf Vorschauframes.

Der Renderer schliesst eine wartende Weltaufnahme vor der naechsten passenden
Vordergrundgruppe, sonst am Szenenende. Ein abgebrochener Frame verwirft seine
noch ausstehenden Capturebefehle am naechsten Szenenbeginn. Kein Wiedergeben
alter Aufnahmen in einer neuen Kamera-/Frameumgebung. Alle zusaetzlichen
Beobachter werden beim Trennen/Leerlauf/Destroy entfernt. Diagnose: abortedFrames.

Der alte feste Tiefenabstand3e-8 lag unter einer 24-Bit-Quantisierungsstufe. Die
Platzierungs-/Linienvorschau verwendet nun zwei Stufen des eigenen16-/24-Bit-
Ziels bzw. eine kleine Floattoleranz bei32F. Deutlich verdeckte Flaechen werden
weiter verworfen. Wrong-/Extra-Flaechen pruefen erst den aus der nativen Tiefe
rekonstruierten Punkt gegen die eigentliche Zielzelle; der umgebende Proxywuerfel
darf diesen Punkt nicht vorher durch seinen eigenen Tiefenvergleich verwerfen.

Capture und Overlay verwenden intern den kanonischen Tiefenbereich0..1. Der
native Quellaufruf behaelt seinen Bereich und bekommt seinen Endzustand danach
exakt zurueck. Auch geklemmte oder ungueltige Eingaben werden nicht als erfundener
Quellzustand restauriert. Umgekehrte Bereiche sind in WebGL ungueltig; deshalb
wird dort der tatsaechlich unveraenderte Zustand verwendet.
Siehe [Khronos, Viewport Depth Range](https://registry.khronos.org/webgl/specs/latest/1.0/).
READ_FRAMEBUFFER/Quelltiefe werden nicht kopiert oder
umgeschrieben, keine CPU-Pixelreadbacks. Aufloesung, Renderdistanz, Farben,
Surface-detail-Limit und originale Modpakete bleiben erhalten.

## Verifikation und Grenzen

416 reine Node-/DOM-/VM-Tests,42 Syntaxdateien,beide generierten Preloads,
MemoryBudgetTests und die verlinkte ES300-Vorschau-VS/FS-Compilerpruefung bestanden.
15 neue Tests behandeln nativen Eingabefluss/Return/Payload, synchrone und
asynchrone Hotbarwechsel, Originalausnahmen/Adapterfehler, Guards/Abbruch/Hash,
ausfallende Gruppen, fruehen Abschluss, Frameabbruch, Tiefenbereich/Restaurierung,
Beobachterfreigabe und Quantisierung/weiterhin wirksame Verdeckung.

CPU- und Quellnachweise: `outputs/litematica-stability-0.6.38/`. Der Vergleich
verwendet echte Adapter aus dem ausgelieferten0.6.37-ASAR. Eine Folge ausfallender
Gruppe0-Ereignisse und die empfindliche Tiefenpruefung sind nachgestellte
Fehlerfaelle; ihr Anteil am konkreten Liveflackern des Nutzers ist nicht gemessen.
Keine Behauptung einer vollstaendigen Live-Reproduktion oder Glitchfreiheit.

Keine Client-/Account-/Installer-/Grafikstarts oder Profilmutation. Alle
Platzierungen in Tests verwenden Attrappen. Echte Darstellung, Mausbedienung und
Servererfolg prueft ausschliesslich der Nutzer. Die zweite Weltaufnahme kostet
weiter GPU-Arbeit; kein gemessener Live-FPS-Gewinn. Iris-Gesamtziel weiter offen.


Release0.6.38: Setup/Portable/Update fertig und bytegeprueft;49Paketquellen/nativeRessourcen passend,keineprivatenOrdner,Setup/Updateidentisch,Version/Locksynchron. Nur3Litematicaadapter/package.json anders;nativeBinaerdateien/Originalkataloge/Qualitaetsdefaults erhalten. Pruefsummen unterdist-bloxdy-v0.6.38/SHA256SUMS.txt,Nachweise outputs/litematica-stability-0.6.38/. Nichts installiert/gestartet/hochgeladen.
