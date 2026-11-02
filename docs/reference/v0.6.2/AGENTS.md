# Verbindliche Nutzerregel: Client und Accounts

Der Nutzer hat am 12. Oktober 2026 ausdrücklich festgelegt: Der Agent darf den Client niemals selbst öffnen oder bedienen und auf dem Account nichts selbst ausführen. Notwendige Clientaktionen muss der Agent beim Nutzer anfragen; der Nutzer führt sie selbst aus.

- Keine Clientstarts durch den Agenten, einschließlich Electron, nativer Vorschau, Offline-Client und Tests, die diese Anwendungen starten.
- Keine Anmeldung, kein Accountwechsel und keine Bedienung einer laufenden Clientsitzung durch den Agenten. Das gilt auch für einen anderen Account.
- Keine Änderung von gespeicherten Anmeldungen, Cookies, Browserprofilen oder Accountdaten, um einen Accountwechsel vorzunehmen.
- Keine indirekte Bedienung über IPC, Diagnose-Kommandodateien, Browserautomation oder Prozesssteuerung.
- Quellcode bearbeiten und vorhandene lokale Dateien/Logs lesen ist erlaubt. Builds dürfen keine Anwendungen oder Clienttests automatisch starten.
- Wenn eine Prüfung eine Clientaktion benötigt, dem Nutzer die konkrete Aktion nennen und ihn bitten, sie selbst auszuführen. Seine Bereitschaft, sie auszuführen, erlaubt dem Agenten nicht, sie an seiner Stelle auszuführen.

Am 13. Oktober 2026 hat der Nutzer die vorherige Produktanforderung ausdrücklich geändert: Account- und Charakter-Sync dürfen wieder über vom Nutzer selbst geöffnete und bediente offizielle Bloxd-Fenster erfolgen. Der Agent darf diese Fenster weiterhin niemals selbst öffnen oder bedienen. Charaktere müssen aus tatsächlicher 3D-Geometrie und Texturdateien gespeichert und im Launcher als 3D-Modell angezeigt werden; keine Screenshots oder Fotos als Charaktervorschau. Eine direkte native OAuth-Anbindung bleibt unbestätigt; keine Bloxd-Herkunft nachahmen oder Schutzprüfungen umgehen.

Die Live-Anbindung wurde nach der vom Nutzer gemeldeten permanenten Accountsperre zunächst deaktiviert und anschließend auf seinen ausdrücklichen Wunsch im Code wieder aktiviert. Das erlaubt dem Agenten weiterhin weder Clientstarts noch Accountaktionen. Der Nutzer startet den Client selbst und nimmt einen eventuellen Accountwechsel selbst vor. Ein anderer Account wurde vom Agenten nicht eingerichtet. `--offline` und `--bridge-test` verwenden lokale synthetische Daten.

Ab Version 0.2.1 verwendet die Datenbrücke `build-streaming/Release/BloxdNative.exe`. Separat kompilieren, statt eine laufende Vorschau zu beenden. `BridgeCpuTests.exe` ist ein eigener reiner CPU-Vertragstest mit simulierten GL-Aufrufen: kein GLFW-Start, Fenster, Grafik-Kontext, Client-Prozess, Netzwerk oder Account. Solche Prüfungen, reine Node-Tests (`npm run test:unit`) und der eigenständige GLSL-Compiler sind vom Verbot der Clientstarts nicht betroffen. `npm test`, `npm run test:bridge` und CTest-GPU-Prüfungen starten dagegen die Grafik-Anwendung und bleiben ausschließlich Nutzeraktionen.

Der Nutzer hat anschließend automatischen Charakter-Sync beim nächsten Spielbeitritt verlangt: keine manuellen Charakter-Sync-Buttons und kein automatisches Öffnen/Bedienen des Charakter-Menüs. Das Spielermodell darf im Code der vom Nutzer gestarteten Sitzung gelesen werden. Die Homepage zeigt bei vorhandenem Modell nur Charakter und Namen; Modellsteuerung ausschließlich Mausdrehen ohne Zoom. Die Agentenregel gegen jeden eigenen Client-/Accountstart bleibt unverändert.
