# Builds the Tauri shell on Linux: the WebKit and GTK development libraries it links against.
FROM rust:1.99-slim-bookworm

RUN rustup component add clippy rustfmt \
    && apt-get update \
    && apt-get install -y --no-install-recommends \
        gcc git libc6-dev pkg-config libwebkit2gtk-4.1-dev libgtk-3-dev \
        libayatana-appindicator3-dev librsvg2-dev libsoup-3.0-dev \
        xvfb xauth imagemagick x11-utils dbus-x11 libgl1-mesa-dri \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace
