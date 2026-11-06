# Node with pnpm for the interface. Nothing is installed on the host.
FROM node:24-slim

RUN npm install -g pnpm

WORKDIR /workspace/apps/desktop
