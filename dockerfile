FROM node:24-bookworm AS base

WORKDIR /app
COPY package.json /app/package.json
COPY package-lock.json /app/package-lock.json
COPY tsconfig.json /app/tsconfig.json
RUN npm install --include=dev