<p align="center">
<img width="250" height="250" alt="logo" src="https://github.com/user-attachments/assets/57426cb2-3e99-45ba-918c-8d79126c6571" />
</p>

# simpleTracker

[![Made with Supabase](https://supabase.com/badge-made-with-supabase.svg)](https://supabase.com)

A simple, mobile-first productivity app for managing notes, tasks, and projects. Installable as a PWA on iOS and Android.

## Features

- Create and manage notes with Markdown support
- Track tasks with subtasks, due dates, and completion status
- Organize notes and tasks into projects
- Recurring tasks with configurable intervals (days, weeks, months)
- Share notes and projects with other users via QR code
- Archive and restore notes
- Offline-capable with automatic sync when back online
- Dark/light theme
- PWA with auto-update prompts
- Designed for daily mobile use

## Tech Stack

- **React 19** with TypeScript
- **Vite** for builds and dev server
- **MUI 7** (Material UI) for components
- **Zustand** for state management
- **Supabase** for auth, database, and real-time
- **react-router-dom v7** for routing
- **dayjs** for date handling
- **react-markdown** with remark-gfm for note rendering
- **recharts** for data visualization
- **vite-plugin-pwa** for service worker and installability
- **Vitest** with fast-check for unit and property-based testing

## Getting Started

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Run tests
npm test

# Production build
npm run build

# Preview production build locally
npm run preview
```

## Environment Variables

Copy the example file and set your Supabase credentials:

```bash
cp .env.example .env.local
```

Then set `VITE_SUPABASE_URL` and `VITE_SUPABASE_KEY` in `.env.local`.

## Project Structure

```
src/
├── components/
│   ├── modals/          # Dialog components (ChangePassword, etc.)
│   ├── subcomponents/   # Shared UI (AppToolbar, AreYouSure, UpdatePrompt)
│   └── extras/          # Utilities (ensureSession, OfflineAlert)
├── store/               # Zustand stores (global, notes, tasks, projects, modals, pwa, offline)
├── lib/                 # Supabase client, caching, offline sync, recurrence, sharing, validation
└── types/               # TypeScript interfaces
```

## Docker

Build and run with Docker Compose:

```bash
docker compose up --build
```

The app will be available at `http://localhost:8080`, served by Caddy.

## License

[AGPL-3.0](LICENSE)
