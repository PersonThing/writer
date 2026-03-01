# Writer

A desktop app for managing writing projects. Open a folder of markdown files, organize them with statuses and quality ratings, and edit multiple files at once.

## Install

Download the latest release for your platform:

**[Download Writer](https://github.com/PersonThing/writer/releases/latest)**

- **Mac** — download the `.dmg`, open it, and drag Writer to your Applications folder
- **Windows** — download the `.exe` installer and run it

Writer auto-updates when new versions are available.

## Usage

1. Open Writer
2. Click "Open Folder" and select a folder containing `.md` files (or an empty folder to start fresh)
3. Your files appear in the sidebar — click to open, right-click for status/quality/rename/delete
4. Edit one or multiple files at once using the tab bar

Your writing stays on your computer — Writer reads and writes plain markdown files directly on disk.

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) v20+
- npm (included with Node.js)

### Setup

```sh
git clone git@github.com:PersonThing/writer.git
cd writer
npm install
```

### Run

```sh
npm run dev
```

Starts the app with hot-reload via electron-vite.

### Build

```sh
npm run build
```

Compiles to the `out/` directory.

### Package

```sh
npm run dist        # Mac + Windows
npm run dist:mac    # Mac only (.dmg)
npm run dist:win    # Windows only (.exe)
```

### Release

Releases are automated via GitHub Actions. Push a version tag to trigger a build:

```sh
npm version patch   # or minor, major
git push --follow-tags
```

This builds and publishes installers for Mac and Windows to [GitHub Releases](https://github.com/PersonThing/writer/releases).

### Tech stack

- **Electron** — desktop shell
- **Svelte 5** — UI
- **electron-vite** — dev server and build
- **electron-builder** — packaging and auto-updates
