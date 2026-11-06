set -e
cd /workspace
cargo build -p brnch-desktop --features tauri/custom-protocol 2>&1 | tail -3
export HOME=/tmp/smokehome; mkdir -p $HOME
export WEBKIT_DISABLE_DMABUF_RENDERER=1 WEBKIT_DISABLE_COMPOSITING_MODE=1 LIBGL_ALWAYS_SOFTWARE=1 BRNCH_DATA_DIRECTORY=/tmp/smokedata
Xvfb :99 -screen 0 1440x900x24 >/tmp/xvfb.log 2>&1 &
sleep 2; export DISPLAY=:99
ls target/debug | grep -v '\.d$' | head
BIN=target/debug/brnch-desktop
"$BIN" >/tmp/app.log 2>&1 &
sleep 12
xwininfo -root -tree | grep -i brnch || echo "no window"
import -window root /workspace/apps/desktop/smoke/window.png
tail -20 /tmp/app.log
