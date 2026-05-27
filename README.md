# Freq — Music Player

This repository contains a Tauri + Aurelia 2 music player app for Windows and Android.

Quick start (development):

```bash
npm install
npm run dev       # start vite dev server
npm run app       # start tauri dev (desktop)
```

Build for production:

```bash
npm run build
npx tauri build
```

Notes:
- Use the Settings page to scan folders and populate the playlist.
- Use the Player page to control playback, volume, and view the playlist.
# freq

This project is bootstrapped by [aurelia/new](https://github.com/aurelia/new).

## Quick start

    npm install
    npm start

Run unit tests:

    npm test
Run Storybook:

    npm run storybook
Run Playwright e2e:

    npx playwright install --with-deps
    npx playwright test

## Start dev web server

    npm start

## Build the app in production mode

    npm run build


## Unit Tests

    npm run test

Run unit tests in watch mode.

    npm run test:watch


## Playwright e2e test

You may need to install playwright test browsers if have not.

   npx playwright install --with-deps

All e2e tests are in `e2e/`.

Run e2e tests with:

    npm run test:e2e

Note the playwright config automatically runs "npm start" before playwright.

For more information, visit https://playwright.dev/docs/test-cli
