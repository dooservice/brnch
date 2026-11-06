# Toolchain to build, lint and test the Rust crates. gcc builds the C code that rustls' ring
# crypto ships with. Nothing is installed on the host.
FROM rust:1.99-slim-bookworm

RUN rustup component add clippy rustfmt \
    && apt-get update \
    && apt-get install -y --no-install-recommends gcc libc6-dev pkg-config \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace
