<p align="center">
  <img width="250" height="250" alt="simpletracker" src="https://github.com/user-attachments/assets/d6e0b16c-ac28-41c4-8467-04f0618dbcb1" />
</p>

# simpleTracker

[![Made with Supabase](https://supabase.com/badge-made-with-supabase.svg)](https://supabase.com)

A simple, mobile-first productivity app for managing notes, tasks, and projects. Installable as a PWA on iOS and Android with full offline support.

## Features

### Notes
- Create and edit notes with full Markdown support (live preview, formatting toolbar)
- Two note types: **text** (freeform Markdown) and **list** (checklist items)
- Pin important notes to the top
- Archive and restore notes
- Organize notes into projects
- Share individual notes with other users

### Tasks
- Track tasks with subtasks (up to 50 per task), due dates, and completion status
- Recurring tasks with configurable intervals (days, weeks, months)
- Recurrence anchored to due date or completion date
- Due date indicators (overdue, today, tomorrow)
- Organize tasks into projects
- Search and filter tasks

### Projects
- Group related notes and tasks together
- Share entire projects with collaborators
- Project descriptions

### Sharing
- Share notes directly or share entire projects
- Exchange user IDs via QR code scanning
- Shared items sync in real-time via Supabase

### Offline Support
- Full offline-first architecture for non-shared items
- Optimistic local updates with IndexedDB-backed mutation queue
- Automatic sync when connectivity returns
- "Lie-fi" detection (pings Supabase to verify real connectivity beyond `navigator.onLine`)
- Periodic 30-second heartbeat checks
- Re-sync on app visibility change (handles mobile app suspension)
- localStorage cache with 50 MB limit and LRU eviction

### Notifications
- Daily browser notifications for due and overdue tasks
- Uses Service Worker notifications for mobile compatibility
- Once-per-day throttling to avoid spam

### PWA
- Installable on iOS and Android home screens
- Service worker with offline asset caching
- Auto-update prompts with safe SW activation (no black screen on Android)
- Core routes eagerly loaded for offline access

### Other
- Dark and light themes
- Configurable Supabase backend (self-hosted, per-user, or env var)
- CSV data export
- Input validation (title/body length limits)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19 + TypeScript |
| Build | Vite 8 |
| UI | MUI 7 (Material UI) |
| State | Zustand 5 |
| Backend | Supabase (Auth, PostgreSQL, RLS) |
| Routing | react-router-dom v7 |
| Dates | dayjs + @mui/x-date-pickers |
| Markdown | react-markdown + remark-gfm |
| Charts | Recharts |
| QR Codes | qrcode.react + html5-qrcode |
| PWA | vite-plugin-pwa + Workbox |
| Testing | Vitest + fast-check (property-based) + happy-dom + fake-indexeddb |

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Install and Run

```bash
# Install dependencies
npm install

# Start dev server (http://localhost:3000)
npm run dev

# Run tests
npm test

# Production build
npm run build

# Preview production build locally
npm run preview
```

### Environment Variables

Create a `.env.local` file in the project root:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_KEY=your-anon-key-here
```

If no env vars are set, the app falls back to the built-in production backend.

## Self-Hosting

simpleTracker supports multiple ways to point at your own Supabase instance:

1. **Global config (recommended for self-hosted deployments):** Edit `public/config.js` to set `window.__SUPABASE_CONFIG__` with your Supabase URL and anon key. This applies to all users.

2. **Per-user override:** Users can navigate to `/backend-config` in the app to enter a custom Supabase URL and key, stored in their browser's localStorage.

3. **Build-time env vars:** Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_KEY` before building.

Priority order: config.js > localStorage override > env vars > production defaults.

## Project Structure

```
src/
├── components/
│   ├── modals/          # Dialog components (ChangePassword)
│   ├── subcomponents/   # Shared UI (AppToolbar, AreYouSure, UpdatePrompt, NotificationPrompt)
│   ├── extras/          # Utilities (ensureSession, OfflineAlert)
│   ├── NotesPage.tsx    # Notes list view
│   ├── NoteDetailPage.tsx
│   ├── TasksPage.tsx    # Tasks list view
│   ├── TaskDetailPage.tsx
│   ├── ProjectsPage.tsx
│   ├── ProjectDetailPage.tsx
│   ├── SettingsPage.tsx
│   ├── LoginPage.tsx
│   ├── SignUpPage.tsx
│   └── ...
├── store/               # Zustand stores
│   ├── globalStore.ts   # Theme, auth, snackbar, loading state
│   ├── noteStore.ts     # Notes CRUD + sharing logic
│   ├── taskStore.ts     # Tasks CRUD + recurrence + subtasks
│   ├── projectStore.ts  # Projects CRUD + sharing logic
│   ├── offlineStore.ts  # Online/offline state, pending count, sync status
│   ├── pwaStore.ts      # Service worker update state
│   ├── notificationStore.ts  # Notification preferences
│   └── modalStore.ts    # Dialog open/close state
├── lib/
│   ├── supabase.ts      # Supabase client init + config resolution
│   ├── cache.ts         # localStorage cache with LRU eviction
│   ├── offlineQueue.ts  # IndexedDB-backed mutation queue
│   ├── offlineSync.ts   # Sync engine (heartbeat, retry, conflict resolution)
│   ├── networkUtils.ts  # Network timeout wrapper
│   ├── recurrence.ts    # Recurring task logic
│   ├── sharing.ts       # Shared item detection (local + remote)
│   ├── notifications.ts # Task due date notifications
│   └── validation.ts    # Input validation helpers
├── types/
│   └── index.ts         # TypeScript interfaces (Note, Task, Project, Subtask, etc.)
├── App.tsx              # Root layout with bottom navigation
└── index.tsx            # Entry point, routing, SW registration
```

## Data Model

| Entity | Key Fields |
|--------|-----------|
| Note | title, body, noteType (text/list), pinned, archived, projectID |
| NoteListItem | noteID, title, isCompleted |
| Task | title, body, status, dueDate, isRecurring, recurrenceInterval/Unit/Anchor, projectID |
| Subtask | taskID, title, isCompleted |
| Project | name, description |
| PendingMutation | entityType, operation (insert/update/delete), recordID, payload |

## Offline Architecture

The app uses an offline-first approach for non-shared items:

1. **Write path:** All mutations are enqueued in IndexedDB immediately, then a background sync attempt fires. If it fails, mutations stay queued.
2. **Read path:** On startup, cached data from localStorage renders instantly while a fresh fetch runs in the background.
3. **Sync triggers:** Browser `online` event, periodic 30s heartbeat, visibility change (app foregrounded).
4. **Conflict resolution:** Duplicate key conflicts (23505) are resolved by deferring to the server. Permanent failures (RLS violations, FK violations) are discarded from the queue.
5. **Shared items:** Bypass the offline queue and require connectivity, since they involve multi-user state.

## License

[AGPL-3.0](LICENSE)
