#!/bin/sh
# Run manually after extracting the Linux archive. This never starts the client.
set -eu
cd -- "$(dirname -- "$0")"
if [ ! -f ./bloxdy-client ] || [ ! -f ./chrome-sandbox ]; then
  echo 'Place this script inside the extracted Bloxdy Client directory first.' >&2
  exit 1
fi
if [ "$(id -u)" -ne 0 ]; then
  echo 'Run: sudo sh install-linux.sh' >&2
  exit 1
fi
install -d /opt/bloxdy-client
cp -R ./. /opt/bloxdy-client/
chown -R root:root /opt/bloxdy-client
chmod 755 /opt/bloxdy-client/bloxdy-client /opt/bloxdy-client/chrome_crashpad_handler
chmod 4755 /opt/bloxdy-client/chrome-sandbox
ln -sf /opt/bloxdy-client/bloxdy-client /usr/local/bin/bloxdy-client
install -d /usr/local/share/applications
cat > /usr/local/share/applications/bloxdy-client.desktop <<'DESKTOP'
[Desktop Entry]
Type=Application
Name=Bloxdy Client
Exec=/opt/bloxdy-client/bloxdy-client
Terminal=false
Categories=Game;
DESKTOP
echo 'Installed. Open Bloxdy Client from the applications menu as your normal user.'
