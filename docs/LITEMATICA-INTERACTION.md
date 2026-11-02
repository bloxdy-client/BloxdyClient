# Litematica interaction and refresh, Client 0.6.35

21. Oktober 2026. Auftrag: defektes Place, starke Performanceprobleme, langsame
und glitchy blaue/rote/pinke Vorschau sowie kompliziertes Menue. Die bisherigen
Releases waren keine nachgewiesene Gesamtloesung. Keine laufende Sitzung oder
Accounts bedient; keine neuen Live-FPS- oder Bildmessungen.

## Place: nachgestellter Clientadapterfehler

Der gemeinsame Modhost ersetzt `native = Object.defineProperty` im originalen
Discovery-Observer absichtlich durch eine No-op-Funktion, da der Host die echte
Definition bereits ausfuehrt. Die originale `command()`-Funktion verwendet
dieselbe Variable allerdings auch fuer `blmNativeCommand` auf ihren eigenen
Enter-/T-Tastaturereignissen. Dort ging die Markierung verloren. Der echte
Litematica-Capturelistener konnte das eigene Enter als neuen Paste-Hotkey
abfangen und mit `stopImmediatePropagation()` den nativen Chat blockieren.

Der SHA-gepruefte Zusatzadapter `launcher/litematica-interaction.cjs` verwendet
fuer diese Ereigniseigenschaft direkt `Object.defineProperty`. Discovery bleibt
beim gemeinsamen Modhost. Ein DOM-Test mit dem echten Command-/Shortcutcode
reproduziert den alten Fehler; die korrigierte Fassung erreicht den simulierten
nativen Chat und schickt genau `//schematic load`, danach `//paste x y z`.

Zusaetzlich gibt es im Menue einen ausdruecklichen Button **Paste at these
coordinates**. Dieser Nutzerklick darf ausschliesslich das native Settings-Menue
schliessen und wartet bis zu 2 Sekunden auf dessen Freigabe. Fehlendes Creative,
offener anderer Dialog/Chat, doppelte Starts, Abbruch und Weltwechsel geben
keinen Paste frei. Der bisherige Hotkey bleibt. Die echten servergeprueften
World-Builder-Pfade, Upload-, benannte Clipboard- und Serverresultatbestaetigung
bleiben erhalten; keine Terrain-/Inventar-/Paketmanipulation oder Rechteumgehung.
Creative und Owner-/Builderrechte bleiben erforderlich. Der Button fuehrt erst
beim spaeteren Nutzerklick im Spiel eine Aktion aus; der Agent hat nichts gepastet.

## Farbaktualisierung und CPU-Arbeit

Die bisherige Rundlaufpruefung konnte eine Zelle am Ende einer grossen Vorlage
erst nach vielen 50-ms-Intervallen erreichen. Vor dem Hintergrundlauf werden
nun Zellen entlang der echten Kamerablickrichtung bis 8 Bloecke bevorzugt.
Eine begrenzte Nahbereichstabelle enthaelt nur Referenzen auf bereits indexierte
eigene Vorlagenzeilen: maximal 65.536 Referenzen in 8er-Zellen im lokalen
5-x-5-x-5-Bereich. Kamera-/Auswahlwechsel verwerfen den Index; beim Kamerawechsel
wird er rollend mit maximal 1.024 vorhandenen Zeilen je Scan aufgebaut.

Nahbereichsaufbau (kooperativ 0,2 ms), Prioritaetspruefung (maximal 1.024 betrachtete
Zeilen/256 Weltlesungen, bis 0,4 ms ab Scanbeginn) und Hintergrundlauf teilen das
bisherige 1-ms-/1.536-Weltlesungen-Budget. Keine Nachholintervalle. Gespeicherte
Profile, Renderdistanz, Detailwahl, Farbstaerken und Aufloesung bleiben erhalten.
Die Blickrichtung ist ein Prioritaetshinweis, kein automatischer Bauvorgang.
Bei Bewegung kann der rollende Index spaeter bereit sein; entfernte Zellen und
ueberzaehlige ueberlappende Platzierungen behalten den Hintergrundlauf.

Maskierte Chunkansichten zerlegen ihre bisherigen 32er-Meshgruppen in 16er-
Arbeitsgruppen. Die vorhandenen Nachbarmasken gelten auch ueber diese Grenzen;
kleine unmaskierte Zeilen behalten ihre alten Gruppen und Nachbarpruefungen.
Eine einzelne Farbaenderung betrifft dadurch weniger Meshdaten. Die Zahl der
Drawgruppen kann wachsen: dies ist ein Abwaegen zwischen Zeichenzahl und
Aktualisierungsarbeit, keine allgemeine GPU-/FPS-Garantie.

Eine FIFO-Set-Warteschlange verteilt Generatorabschnitte fair auf schmutzige
Gruppen. Nahe Aenderungen erhalten bis zu 8 bevorzugte Abschnitte; insgesamt
maximal 128 Abschnitte bzw. das bisherige kooperative 3-ms-Budget je Frame.
Veraltete Arbeiten werden vor ihrer Fortsetzung abgebrochen, ihre ausstehenden
Buffer freigegeben; der letzte fertig uebernommene Buffer bleibt bis zum neuen
atomaren Commit erhalten. Uploadschritte bleiben auf 256 KiB begrenzt. Leere
Ansichten geben eigene Grafikressourcen frei. Wiederverwendete Chunkzeilen
uebernehmen neue Translation/Rotation und verwerfen dabei alte Weltstatuswerte.
HUD-/Zaehlerfortschritt kommt alle 250 ms statt einmal pro Sekunde.

Die zweite Welterfassung aus 0.6.34 bleibt noetig, wenn eine Vorschau sichtbar
ist. Keine neuen GPU-Zielarten oder andere Renderingformeln. Ganze neue Vorlagen,
sehr viele Fehler und vom Spiel/Treiber nicht unterbrechbare Einzeloperationen
koennen weiterhin kosten. Kein Versprechen eines perfekten, glitchfreien Clients.

## Menue

Drei direkt sichtbare Aufgabenbuttons: **Build guide**, **Select & export**,
**Creative paste**. Kurze Anweisung passend zur Aufgabe, dauerhafte Farb-/Text-
Legende fuer fehlende/falsche/zusaetzliche Bloecke und Zielkoordinaten beim Paste.
**Appearance & layers** startet eingeklappt. Bestehende Detailoptionen, Shortcuts,
Bibliothek, Blockmapping, mehrere Platzierungen und Lazy-Menuewiederverwendung
bleiben erreichbar. Keine Profil-/Bibliotheksmigration durch den Agenten.

## Reine Verifikation und verbleibende Abnahme

Neue DOM-/VM-/CPU-Regressionen verwenden den echten adaptierten Katalogcode und
inerte Attrappen fuer nativen Chat, Serverantworten und GL. Sie pruefen den
nachgestellten alten Enterfehler, erfolgreichen Lade-/Pasteablauf, fremde
Clipboardantwort, Timeout, Berechtigungsfehler, unberuehrten Chattext, Button-
Mehrfachklick/Weltwechsel, Zielzelle hinter 20.000 anderen Zeilen, wiederholte
Blau-/Rot-/Pinkwechsel, Budget/Indexobergrenze, faire Meshfortschritte, begrenzte
Uploads, Freigabe und transformierte Zeilen sowie den gemeinsamen Modpreload.

Gesamt- und Releaseberichte: `outputs/litematica-overhaul-0.6.35/`. Paketpruefungen
lesen ausschliesslich Bytes. Der Originalkatalog bleibt unveraendert; auch bereits
installierte Originalmodule erhalten den Adapter beim naechsten Nutzerstart.
Native-/Iris-/Shader-/Charakter-/No-Ads-Pfade werden nicht weiterentwickelt.

386 reine Tests,42 Syntaxdateien,beide generierten Preloads und MemoryBudgetTests
bestanden.49 Paketquellen und native Ressourcen passend; Setup/Portable/Update
unter `dist-bloxdy-v0.6.35/`, Setup/Update bytegleich. Gegen0.6.34 nur der neue
Interaktionsadapter, dessen Einbindung und package.json im Paket geaendert.
CPU-Vergleich mit altem ASAR-Adapter: Ziel hinter20.000anderenZeilen300->0
synthetischems bis zum ersten geaenderten Status; lokaler Meshupload6912->5184Bytes.
Das sind zwei definierte CPU-Fixtures, keine universellen Geschwindigkeitswerte.

Realer Place-Erfolg, Darstellung und FPS im betroffenen Nutzerlauf bleiben
Nutzerabnahme. Es wurden keine Client-/Account-/Installer-/Grafikstarts oder
Profilmutationen durch den Agenten vorgenommen.
