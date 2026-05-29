# Implementation Plan: simpleTracker Notes & Tasks

## Overview

This plan converts simpleBudget into simpleTracker by replacing all budget-specific UI, state, and data access with a notes/tasks/projects system. Implementation proceeds in layers: core infrastructure and types first, then domain stores, then UI pages, then offline/sync, then cleanup and wiring. Each step builds on the previous and ends with integrated, testable code.

## Tasks

- [x] 1. Core infrastructure and type definitions
  - [x] 1.1 Create shared TypeScript interfaces and types
    - Create `src/types/index.ts` with `Note`, `NoteShared`, `Task`, `Subtask`, `Project`, `ProjectShared`, `PendingMutation` interfaces matching the design document
    - Export all types for use across stores, components, and utilities
    - _Requirements: 4.1, 8.1, 11.1, 13.1, 15.1_

  - [x] 1.2 Implement input validation utility
    - Create `src/lib/validation.ts` with functions: `validateNoteTitle(title: string)`, `validateTaskTitle(title: string)`, `validateSubtaskTitle(title: string)`, `validateProjectName(name: string)`, `validateNoteBody(body: string)`
    - Each returns `{ valid: boolean; error?: string }` enforcing length constraints (255 for titles, 100 for project names, 100000 for note body)
    - _Requirements: 4.2, 4.6, 8.2, 11.2, 13.2_

  - [x] 1.3 Write property test for input validation (Property 2)
    - **Property 2: Input Length Validation**
    - Test that any string is accepted iff trimmed length is between 1 and the entity's max, rejected otherwise
    - Use fast-check `fc.string()` and `fc.nat()` arbitraries
    - **Validates: Requirements 4.2, 4.6, 8.2, 11.2, 13.2**

  - [x] 1.4 Implement recurrence calculator utility
    - Create `src/lib/recurrence.ts` with `calculateNextDueDate(anchor, originalDueDate, completedAt, interval, unit)` and `spawnRecurringTask(completedTask, subtasks)` functions
    - Use dayjs for date arithmetic (add days/weeks/months)
    - Handle the fallback case: if anchor is "due_date" but dueDate is null, use completedAt
    - _Requirements: 10.3, 10.4, 10.5, 10.6_

  - [x] 1.5 Write property test for recurrence date calculation (Property 9)
    - **Property 9: Recurring Task Date Calculation**
    - Test all anchor/dueDate combinations produce correct next due date
    - Use fast-check arbitraries for interval (1-365), unit, timestamps
    - **Validates: Requirements 10.3, 10.4, 10.6**

  - [x] 1.6 Write property test for recurrence field copying (Property 10)
    - **Property 10: Recurring Task Field Copying**
    - Test that spawned task has status="open", completedAt=null, and identical title, body, projectID, recurrence settings, subtask titles with isCompleted=false
    - **Validates: Requirements 10.5**

  - [x] 1.7 Implement sharing detection utility
    - Create `src/lib/sharing.ts` with `isSharedItem(item, currentUserID, noteShares, projectShares)` and `lookupUserByEmail(email)` functions
    - An item is shared if: it has a direct share record, belongs to a shared project, or creatorID differs from current user
    - `lookupUserByEmail` queries Supabase `users` table by email
    - _Requirements: 7.1, 14.1, 16.2, 16.6_

- [x] 2. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Generalized offline queue and sync engine
  - [x] 3.1 Refactor offline queue to support generic mutations
    - Rewrite `src/lib/offlineQueue.ts` to use `PendingMutation` interface instead of `PendingTransaction`
    - Change IndexedDB database name to `simpleTrackerOffline`, store name to `pendingMutations`
    - Add `removeByRecordID(recordID)` method for cache invalidation when items become shared
    - Keep FIFO ordering by `_queuedAt` timestamp
    - _Requirements: 15.1, 15.2_

  - [x] 3.2 Write property test for offline queue FIFO order (Property 13)
    - **Property 13: Offline Queue FIFO Order**
    - Test that mutations enqueued with increasing timestamps are dequeued in ascending order
    - **Validates: Requirements 15.2**

  - [ ]* 3.3 Write property test for queue storage (Property 17)
    - **Property 17: Offline Queue Stores Mutations with Timestamp**
    - Test that every enqueued mutation retains its complete payload and _queuedAt timestamp
    - **Validates: Requirements 15.1**

  - [x] 3.4 Refactor sync engine for generic entity types
    - Rewrite `src/lib/offlineSync.ts` to use `PendingMutation` and handle insert/update/delete operations across notes, tasks, subtasks, and projects tables
    - Implement `insertWithOfflineSupport`, `updateWithOfflineSupport`, `deleteWithOfflineSupport` functions
    - Retain existing connectivity verification (HEAD request every 30s), heartbeat, and visibility change handling
    - Handle duplicate key conflicts by removing from queue and notifying user
    - _Requirements: 15.2, 15.3, 15.5, 17.1, 17.2, 17.3, 17.4, 17.5, 17.6_

  - [x] 3.5 Implement localStorage cache manager with LRU eviction
    - Create `src/lib/cache.ts` with functions to read/write cached notes, tasks, subtasks, projects
    - Implement LRU eviction: when total cached size exceeds 50MB, evict items with oldest updatedAt first
    - Implement `removeCachedItem(key, recordID)` for removing items that become shared
    - Clear legacy budget cache keys on startup (`cachedBudgets`, `cachedSections`, `cachedCategories`, `cachedTransactions`)
    - _Requirements: 15.4, 15.6, 16.6, 18.4_

  - [ ]* 3.6 Write property test for LRU eviction (Property 16)
    - **Property 16: Cache LRU Eviction**
    - Test that eviction removes items in ascending updatedAt order until under the size limit
    - **Validates: Requirements 15.6**

  - [x] 3.7 Write property test for shared items excluded from cache (Property 14)
    - **Property 14: Shared Items Excluded from Offline Cache**
    - Test that shared items are never present in localStorage cache and are removed when an item becomes shared
    - **Validates: Requirements 16.2, 16.6**

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Domain Zustand stores
  - [x] 5.1 Implement noteStore
    - Create `src/store/noteStore.ts` implementing the `NoteStore` interface from the design
    - `fetchNotes` loads non-shared notes from cache first (< 200ms), then fetches from Supabase and updates cache
    - `createNote` generates recordID via uuid, sets defaults (empty title/body, archived=false, timestamps)
    - `updateNote` validates title length, updates updatedAt, uses offline support for non-shared items
    - `archiveNote`/`unarchiveNote` toggle archived field with updatedAt update
    - `deleteNote` removes note and associated notes_shared records
    - `shareNote`/`unshareNote` manage notes_shared records, remove item from local cache when shared
    - _Requirements: 4.1, 4.2, 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 7.1, 7.3, 15.4, 16.4_

  - [x] 5.2 Write property tests for noteStore (Properties 3, 5, 6, 12)
    - **Property 3: Note Creation Defaults** — verify all default fields
    - **Property 5: List Ordering** — verify notes sorted by updatedAt desc, archived excluded
    - **Property 6: Archive Round-Trip** — verify archive/unarchive preserves title/body
    - **Property 12: Mutations Update Timestamp** — verify updatedAt increases on update
    - **Validates: Requirements 4.1, 5.1, 5.2, 5.3, 5.4, 5.5, 4.2**

  - [x] 5.3 Implement taskStore
    - Create `src/store/taskStore.ts` implementing the `TaskStore` interface from the design
    - `createTask` validates title (1-255 chars), generates recordID, sets defaults (status="open", body="", etc.)
    - `completeTask` sets status="completed", completedAt=now, updatedAt=now; if isRecurring, calls recurrence calculator and creates new task
    - `reopenTask` sets status="open", completedAt=null, updatedAt=now
    - `fetchSubtasks` loads subtasks for a task, ordered by createdAt ascending
    - `addSubtask` validates title, enforces max 50 subtasks per task
    - `toggleSubtask` inverts isCompleted, updates updatedAt
    - `deleteSubtask` removes subtask record (creator-only enforced by RLS)
    - Status filter state (`open` | `completed` | `all`) for list filtering
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 9.1, 9.2, 9.3, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 12.1_

  - [x] 5.4 Write property tests for taskStore (Properties 4, 8, 11, 12)
    - **Property 4: Task Creation Defaults** — verify all default fields for valid titles
    - **Property 8: Task Status Round-Trip** — verify complete/reopen preserves title/body/projectID
    - **Property 11: Subtask Toggle Involution** — verify double-toggle restores original state
    - **Property 12: Mutations Update Timestamp** — verify updatedAt increases on task update
    - **Validates: Requirements 8.1, 9.1, 9.2, 11.3, 8.3**

  - [x] 5.5 Implement projectStore
    - Create `src/store/projectStore.ts` implementing the `ProjectStore` interface from the design
    - `createProject` validates name (1-100 chars), generates recordID, sets timestamps
    - `deleteProject` removes project record (cascade sets projectID=null on notes/tasks via DB)
    - `shareProject`/`unshareProject` manage task_projects_shared records
    - `fetchProjects` loads projects ordered by updatedAt descending
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 14.1, 14.3, 14.4, 14.5_

  - [x] 5.6 Write property tests for projectStore (Properties 5, 7, 15)
    - **Property 5: List Ordering** — verify projects sorted by updatedAt desc
    - **Property 7: Creator-Only Permissions** — verify only creator can delete/edit/share
    - **Property 15: Shared Project Permission Model** — verify shared users get read/edit but not delete
    - **Validates: Requirements 13.6, 13.7, 14.2, 14.5**

  - [x] 5.7 Update modalStore for new modals
    - Modify `src/store/modalStore.ts` to remove budget-related modal state and add: `confirmDelete`, `shareNote`, `shareProject`, `shareTask` modal states
    - _Requirements: 6.2, 12.2, 13.4_

- [x] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Application rebranding and navigation restructure
  - [x] 7.1 Rebrand application to simpleTracker
    - Update `src/store/globalStore.ts`: change `appName` from `'simpleBudget'` to `'simpleTracker'`
    - Update `index.html`: change `<title>` to "simpleTracker", update `apple-mobile-web-app-title` meta tag
    - Update PWA manifest in vite config: set `name` to "simpleTracker", `short_name` to "simpleTracker"
    - Update `package.json` name field to "simpletracker"
    - Update toolbar to render "simple" in light font weight + "Tracker" in default weight
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 7.2 Restructure navigation to Notes/Tasks/Projects/Settings
    - Rewrite bottom navigation in `src/App.tsx` to show Notes, Tasks, Projects, Settings tabs
    - Replace budget/transactions/analytics icons with appropriate MUI icons (NotesIcon, TaskAltIcon, FolderIcon, SettingsIcon)
    - Update route configuration: remove `/budget`, `/transactions`, `/analytics`; add `/notes`, `/tasks`, `/projects`
    - Default redirect from `/` to `/notes`
    - Update active tab tracking to match new routes
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 7.3 Update App.tsx to remove budget logic and wire new stores
    - Remove all budget-related imports, state, and functions (grabAllBudgets, setBudget, supaRefresh, loadFromCache)
    - Remove budget-related modals (AddBudget, SelectBudget, AddTransaction, EditTransaction)
    - Initialize offline sync with the new generalized sync engine
    - Load cached notes/tasks/projects from localStorage on startup via cache manager
    - Clear legacy budget cache keys on startup
    - _Requirements: 18.2, 18.4_

- [x] 8. Notes UI pages
  - [x] 8.1 Implement NotesPage component
    - Create `src/components/NotesPage.tsx` displaying non-archived notes list sorted by updatedAt desc
    - Show each note's title (or "Untitled" placeholder) and formatted updatedAt timestamp
    - Add FAB button to create a new note (calls `noteStore.createNote()` then navigates to detail)
    - Add toggle/tab to switch between active and archived notes views
    - Show visual indicator on shared notes (notes where creatorID !== currentUser)
    - _Requirements: 5.1, 5.3, 5.4, 7.2_

  - [x] 8.2 Implement NoteDetailPage component
    - Create `src/components/NoteDetailPage.tsx` with route `/notes/:id`
    - Provide text input for title (max 255 chars with validation feedback)
    - Provide textarea for body (raw markdown input, max 100,000 chars)
    - Render markdown preview using `react-markdown` with remark-gfm plugin (headings, bold, italic, links, code, blockquotes, lists)
    - Add project assignment dropdown (from projectStore.projects)
    - Add archive/unarchive button
    - Add delete button (visible only to creator, with confirmation dialog)
    - Add share management section (visible only to creator): input email, list current shares, remove share
    - Show error messages for failed saves, user-not-found on share, duplicate share
    - For shared items: fetch from server on load, show offline message if no connectivity
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 5.2, 5.5, 6.1, 6.2, 6.3, 6.4, 6.5, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 16.1, 16.3, 16.5_

  - [x] 8.3 Install react-markdown and remark-gfm dependencies
    - Add `react-markdown` and `remark-gfm` to package.json dependencies
    - _Requirements: 4.3_

- [x] 9. Tasks UI pages
  - [x] 9.1 Implement TasksPage component
    - Create `src/components/TasksPage.tsx` displaying tasks filtered by statusFilter
    - Show task title, status indicator, due date (if set), and project name (if assigned)
    - Add FAB button to create a new task (prompt for title, then navigate to detail)
    - Add filter control to switch between "open", "completed", and "all" views
    - _Requirements: 9.3, 8.1_

  - [x] 9.2 Implement TaskDetailPage component
    - Create `src/components/TaskDetailPage.tsx` with route `/tasks/:id`
    - Provide title input (1-255 chars with validation), body textarea, due date picker (MUI DatePicker)
    - Add complete/reopen button toggling task status
    - Add recurrence settings section: toggle isRecurring, interval input (1-365), unit select (days/weeks/months), anchor select (due_date/completed_date)
    - Add subtask checklist: display ordered by createdAt asc, toggle completion, add new (max 50), delete (creator only)
    - Add project assignment dropdown
    - Add delete button (creator only, with confirmation)
    - Show error messages for validation failures and network errors
    - For shared items: fetch from server, show offline message if no connectivity
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 9.1, 9.2, 9.4, 10.1, 10.2, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 12.1, 12.2, 12.3, 12.4, 12.5, 16.1, 16.3, 16.5_

- [x] 10. Projects UI pages
  - [x] 10.1 Implement ProjectsPage component
    - Create `src/components/ProjectsPage.tsx` displaying projects list sorted by updatedAt desc
    - Show project name and description preview
    - Add create project button/dialog (name input with 1-100 char validation)
    - _Requirements: 13.1, 13.2, 13.7_

  - [x] 10.2 Implement ProjectDetailPage component
    - Create `src/components/ProjectDetailPage.tsx` with route `/projects/:id`
    - Show project name (editable by creator), description (editable by creator)
    - List notes and tasks belonging to this project
    - Add sharing management section (creator only): input email, list shares, remove share
    - Add delete button (creator only, with confirmation explaining cascade behavior)
    - Show error messages for validation, user-not-found, duplicate share, self-share
    - _Requirements: 13.3, 13.4, 13.5, 13.6, 14.1, 14.2, 14.3, 14.4, 14.5, 14.6_

- [x] 11. Connectivity UI and sync status
  - [x] 11.1 Implement connectivity indicator in toolbar
    - Update `src/components/subcomponents/AppToolbar.tsx` to display offline indicator when `offlineStore.isOnline` is false
    - Show pending mutation count badge when `offlineStore.pendingCount > 0`
    - Show syncing animation when `offlineStore.isSyncing` is true
    - _Requirements: 17.1, 17.2, 17.3_

  - [x] 11.2 Wire connectivity detection into App lifecycle
    - Ensure `initOfflineSync()` is called on app mount with the new generalized sync engine
    - Verify 30-second heartbeat, visibility change handling, and online/offline event listeners are active
    - _Requirements: 17.4, 17.5, 17.6_

- [x] 12. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Settings page and data migration cleanup
  - [x] 13.1 Update SettingsPage for simpleTracker
    - Modify `src/components/SettingsPage.tsx` to remove any budget-related settings
    - Retain theme toggle (dark/light), account info display, Supabase config override, and sign-out
    - _Requirements: 1.3, 2.1_

  - [x] 13.2 Remove all budget-related source code
    - Delete `src/components/BudgetPage.tsx`, `src/components/AnalyticsPage.tsx`, `src/components/TransactionsPage.tsx`
    - Delete `src/components/modals/AddBudget.tsx`, `AddCategory.tsx`, `AddSection.tsx`, `AddTransaction.tsx`, `CopyBudget.tsx`, `EditCategory.tsx`, `EditSection.tsx`, `EditTransaction.tsx`, `ExportToCSV.tsx`, `SelectBudget.tsx`, `ShareBudget.tsx`
    - Delete `src/components/subcomponents/BudgetSection.tsx`
    - Delete `src/components/extras/GrabBudgetData.tsx`, `useCategoryActions.ts`, `useHistoricalBudget.ts`
    - Delete or refactor `src/components/extras/api_functions.ts` (remove budget API functions)
    - Delete `src/store/tableStore.ts`
    - Remove all imports of deleted files from remaining source
    - _Requirements: 18.2_

  - [x] 13.3 Update router configuration
    - Update route definitions (likely in `src/index.tsx` or router config) to register new routes: `/notes`, `/notes/:id`, `/tasks`, `/tasks/:id`, `/projects`, `/projects/:id`, `/settings`
    - Remove old routes: `/budget`, `/transactions`, `/analytics`
    - Ensure login/signup/forgot-password/reset-password routes remain unchanged
    - _Requirements: 3.1, 3.4, 2.2_

- [x] 14. Integration wiring and final polish
  - [x] 14.1 Wire shared item online-only behavior
    - In noteStore and taskStore fetch/update methods, check `isSharedItem()` before using offline support
    - For shared items: always fetch from server, write directly to server, show error if offline
    - For non-shared items: use cache + offline queue as designed
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5_

  - [x] 14.2 Implement confirmation dialogs for delete operations
    - Wire the `AreYouSure` component (already exists) to note delete, task delete, and project delete flows
    - Ensure cancel aborts the operation, confirm proceeds
    - _Requirements: 6.2, 6.3, 12.2, 12.3, 13.4_

  - [x] 14.3 Wire Supabase config resolution (verify existing implementation)
    - Verify `src/lib/supabase.ts` config resolution priority is correct: window config > localStorage > env vars > defaults
    - No changes expected — existing implementation already matches requirements
    - _Requirements: 2.4_

  - [ ]* 14.4 Write property test for Supabase config resolution (Property 1)
    - **Property 1: Supabase Config Resolution Priority**
    - Test that the highest-priority non-empty source is always selected
    - **Validates: Requirements 2.4**

  - [ ]* 14.5 Write property test for creator-only permissions (Property 7)
    - **Property 7: Creator-Only Permissions**
    - Test that delete/share controls are available iff user ID equals entity creatorID
    - **Validates: Requirements 6.4, 7.4, 11.5, 12.4, 13.6, 14.5**

  - [x] 14.6 Write integration tests for end-to-end flows
    - Test note create → edit → archive → unarchive → delete flow
    - Test task create → complete (with recurrence) → verify new task spawned
    - Test project create → share → verify shared user access
    - Test offline queue → go online → verify sync drains queue
    - _Requirements: 4.1, 9.1, 10.3, 14.1, 15.2_

- [x] 15. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The existing `offlineStore.ts` is retained as-is — it already matches the design's needs
- Authentication pages (Login, SignUp, ForgotPassword, ResetPassword, SupabaseConfig) are retained without modification
- The `react-markdown` dependency must be installed before the NoteDetailPage can render markdown

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.4", "1.7"] },
    { "id": 2, "tasks": ["1.3", "1.5", "1.6", "3.1"] },
    { "id": 3, "tasks": ["3.2", "3.3", "3.4", "3.5"] },
    { "id": 4, "tasks": ["3.6", "3.7", "5.1", "5.3", "5.5", "5.7"] },
    { "id": 5, "tasks": ["5.2", "5.4", "5.6", "7.1"] },
    { "id": 6, "tasks": ["7.2", "7.3", "8.3"] },
    { "id": 7, "tasks": ["8.1", "8.2", "9.1", "9.2", "10.1", "10.2"] },
    { "id": 8, "tasks": ["11.1", "11.2", "13.1", "13.2"] },
    { "id": 9, "tasks": ["13.3", "14.1", "14.2", "14.3"] },
    { "id": 10, "tasks": ["14.4", "14.5", "14.6"] }
  ]
}
```
