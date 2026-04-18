# Writer

A web app for managing writing projects. Open a folder of markdown files, organize them with statuses and quality ratings, and edit multiple files at once.

## Usage

Point Writer at a folder of `.md` files on disk. Files appear in the sidebar — click to open, right-click for status/quality/rename/delete. Edit one or multiple files at once using the tab bar. Your writing stays on your computer as plain markdown.

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

Create a `.env` file in the repo root pointing at the folder you want Writer to manage:

```
WRITER_ROOT=/absolute/path/to/your/writing
```

### Run

```sh
npm run dev
```

Starts the Express backend (port 3456) and the Vite dev server concurrently. Open the URL Vite prints (typically http://localhost:5173).

### Build

```sh
npm run build
```

Compiles the frontend to `dist/`.

### Serve the built app

```sh
npm start
```

Builds the frontend, then serves it from the Express server on port 3456.

### Tech stack

- **Svelte 5** — UI
- **Vite** — dev server and frontend build
- **Express** — backend API and static file serving
