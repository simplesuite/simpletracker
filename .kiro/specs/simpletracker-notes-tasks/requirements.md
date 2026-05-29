# Requirements Document

## Introduction

This document defines the requirements for converting the existing simpleBudget budgeting application into simpleTracker — a notes and task tracking application. The conversion retains the same Supabase backend instance, authentication system, login procedures, and deployment infrastructure (Docker/Caddy). The differences are limited to the UI layout, data structures, and core functionality. The app will support markdown-based notes, tasks with recurring schedules, project-based organization, and sharing with a differentiated caching strategy (offline-first for non-shared items, online-only for shared items).

## Glossary

- **simpleTracker**: The renamed application, replacing simpleBudget
- **App**: The simpleTracker React/TypeScript single-page application
- **Supabase_Backend**: The existing Supabase instance providing database, authentication, and row-level security
- **Note**: A markdown-formatted text document owned by a user, optionally assigned to a Project
- **Task**: A trackable work item with status, optional due date, optional recurrence, and optional subtasks
- **Subtask**: A checklist item belonging to a Task
- **Project**: An organizational container that groups related Notes and Tasks, and enables sharing
- **Offline_Queue**: The IndexedDB-backed queue that stores pending mutations for later sync
- **Sync_Engine**: The module responsible for detecting connectivity and draining the Offline_Queue
- **Recurrence_Anchor**: A per-task setting that determines whether the next occurrence is calculated from the due date or the completed date
- **Shared_Item**: A Note or Task that is shared with other users via direct sharing or Project membership
- **Non_Shared_Item**: A Note or Task that belongs solely to the creator and is not shared

## Requirements

### Requirement 1: Application Rebranding

**User Story:** As a user, I want the application to be named simpleTracker with appropriate branding, so that the interface reflects its new purpose.

#### Acceptance Criteria

1. THE App SHALL display "simpleTracker" (exact camelCase spelling) as the application name in the toolbar header, the HTML document title, the PWA manifest `name` field, and the PWA manifest `short_name` field
2. THE App SHALL use the "simpleTracker" name in all user-facing text where the application name appears, including the HTML `apple-mobile-web-app-title` meta tag and the PWA manifest description
3. THE App SHALL retain the existing color scheme and theming system (dark/light mode toggle) without modification to theme colors or toggle behavior
4. THE App SHALL render the toolbar application name as "simple" in light font weight followed by "Tracker" in default font weight, preserving the existing two-part typographic style

### Requirement 2: Authentication Preservation

**User Story:** As a user, I want to log in with the same credentials and flow as before, so that I do not need to create a new account.

#### Acceptance Criteria

1. THE App SHALL authenticate users against the same Supabase_Backend instance used by simpleBudget, using the Supabase `signInWithPassword` method with email and password credentials
2. THE App SHALL support the following authentication flows with identical field requirements as simpleBudget: login (email + password), sign-up (full name + email + password + password confirmation with a minimum of 8 characters, requiring email verification before first login), forgot-password (email submission triggering a reset link), and reset-password (new password + confirmation with a minimum of 8 characters)
3. THE App SHALL persist authentication sessions in localStorage using the Supabase key format `sb-{hostname}-auth-token`, with `autoRefreshToken` enabled and `persistSession` set to true
4. THE App SHALL resolve Supabase backend configuration using the following priority order: (1) `window.__SUPABASE_CONFIG__` set via `public/config.js` for self-hosted deployments, (2) localStorage key `supabaseCustomConfig` for per-user runtime override, (3) `VITE_SUPABASE_URL` and `VITE_SUPABASE_KEY` environment variables at build time, (4) hardcoded production defaults
5. IF authentication fails due to invalid credentials or a network error, THEN THE App SHALL display an error message indicating the failure reason and SHALL remain on the login page without clearing the email field

### Requirement 3: Navigation Layout

**User Story:** As a user, I want a bottom navigation bar suited to notes and tasks, so that I can quickly switch between the main sections of the app.

#### Acceptance Criteria

1. THE App SHALL display a fixed bottom navigation bar with tabs for Notes, Tasks, Projects, and Settings on all authenticated pages
2. WHEN a user taps a navigation tab, THE App SHALL navigate to the corresponding page and update the active tab indicator to reflect the selected tab
3. THE App SHALL visually distinguish the currently active tab from inactive tabs by applying a differentiated style (such as color or weight) to the active tab's icon and label
4. WHEN an authenticated user navigates to the root path, THE App SHALL redirect to the Notes page
5. WHEN the current route changes via browser navigation or deep link, THE App SHALL update the active tab indicator to match the current page

### Requirement 4: Notes — Create and Edit

**User Story:** As a user, I want to create and edit markdown notes, so that I can capture information in a rich text format.

#### Acceptance Criteria

1. WHEN a user creates a new note, THE App SHALL store a Note record with a generated recordID, the user's creatorID, an empty title, an empty body, and current timestamps (createdAt and updatedAt as epoch milliseconds)
2. WHEN a user edits a note title or body, THE App SHALL update the Note record and set the updatedAt timestamp to the current time, enforcing a maximum title length of 255 characters and a maximum body length of 100,000 characters
3. THE App SHALL render the note body as markdown for display, supporting at minimum: headings, bold, italic, links, inline code, fenced code blocks, blockquotes, ordered lists, and unordered lists
4. THE App SHALL provide a text editing interface that accepts raw markdown input for the note body, with a maximum input length of 100,000 characters
5. WHEN a user assigns a note to a Project, THE App SHALL set the Note projectID field to the selected Project recordID
6. IF a note title exceeds 255 characters, THEN THE App SHALL prevent the input and display an indication that the maximum title length has been reached
7. IF a note save or update operation fails due to a network or server error, THEN THE App SHALL display an error message indicating the save failed and SHALL retain the user's unsaved edits in the editing interface

### Requirement 5: Notes — List and Archive

**User Story:** As a user, I want to view my notes in a list and archive notes I no longer need, so that I can keep my workspace organized.

#### Acceptance Criteria

1. THE App SHALL display a list of all non-archived Notes accessible to the current user, ordered by updatedAt descending, showing each Note's title and updatedAt timestamp
2. WHEN a user archives a note they have write access to, THE App SHALL set the Note archived field to true and update the updatedAt timestamp to the current time
3. THE App SHALL exclude archived Notes from the default notes list
4. WHEN a user requests to view archived notes, THE App SHALL display a list of archived Notes accessible to the current user, ordered by updatedAt descending
5. WHEN a user unarchives a note they have write access to, THE App SHALL set the Note archived field to false and update the updatedAt timestamp to the current time
6. IF an archive or unarchive operation fails due to a network error, THEN THE App SHALL retain the Note in its previous archived state and display an error message indicating the operation could not be completed

### Requirement 6: Notes — Delete

**User Story:** As a user, I want to permanently delete notes I own, so that I can remove unwanted content.

#### Acceptance Criteria

1. WHEN a user deletes a note they created and confirms the deletion, THE App SHALL remove the Note record and all associated notes_shared records from the Supabase_Backend
2. WHEN a user attempts to delete a note, THE App SHALL display a confirmation prompt before proceeding
3. IF the user cancels the confirmation prompt, THEN THE App SHALL abort the delete operation and leave the Note unchanged
4. THE App SHALL only present the delete option to the Note creator
5. IF the delete operation fails due to a network or server error, THEN THE App SHALL display an error message indicating the note was not deleted and leave the Note unchanged

### Requirement 7: Notes — Sharing

**User Story:** As a user, I want to share individual notes with other users, so that we can collaborate on content.

#### Acceptance Criteria

1. WHEN a note creator shares a note by entering a recipient's email address, THE App SHALL create a notes_shared record linking the Note to the recipient's user account
2. WHEN a note is shared with a user, THE App SHALL display that note in the recipient's notes list with a visual indicator distinguishing it from notes the recipient created
3. WHEN a note creator removes sharing for a user, THE App SHALL delete the corresponding notes_shared record and remove the note from the recipient's notes list
4. THE App SHALL only display sharing management controls to the Note creator and SHALL hide those controls from other users who have access to the note
5. WHEN a note is shared with a user, THE App SHALL grant the recipient the ability to edit the note title and body
6. IF a note creator attempts to share a note with an email address that does not match a registered user, THEN THE App SHALL display an error message indicating the user was not found
7. IF a note creator attempts to share a note with a user who already has access to that note, THEN THE App SHALL display a message indicating the note is already shared with that user

### Requirement 8: Tasks — Create and Edit

**User Story:** As a user, I want to create and edit tasks with titles, descriptions, and due dates, so that I can track my work items.

#### Acceptance Criteria

1. WHEN a user creates a new task, THE App SHALL store a Task record with a generated recordID, the user's creatorID, the provided title (between 1 and 255 characters), a default body of empty string, a default status of "open", and current timestamps for createdAt and updatedAt
2. IF a user attempts to create or save a task with a blank title or a title exceeding 255 characters, THEN THE App SHALL reject the operation and display a validation error indicating the title must be between 1 and 255 characters
3. WHEN a user edits a task's title, body, or dueDate, THE App SHALL update the Task record and set the updatedAt timestamp to the current time
4. WHEN a user assigns a task to a Project, THE App SHALL set the Task projectID field to the selected Project recordID
5. WHEN a user removes a task's Project assignment, THE App SHALL set the Task projectID field to null
6. THE App SHALL allow the user to set or clear an optional due date on a Task, stored as a Unix timestamp in milliseconds

### Requirement 9: Tasks — Status Management

**User Story:** As a user, I want to mark tasks as complete or reopen them, so that I can track progress.

#### Acceptance Criteria

1. WHEN a user marks a task as complete, THE App SHALL set the Task status to "completed", set completedAt to the current timestamp, and set updatedAt to the current timestamp
2. WHEN a user reopens a completed task, THE App SHALL set the Task status to "open", clear the completedAt field, and set updatedAt to the current timestamp
3. THE App SHALL display a filter control that allows the user to view tasks by status: "open", "completed", or all
4. IF a status change operation fails, THEN THE App SHALL retain the previous task status in the UI and display an error message indicating the status could not be updated

### Requirement 10: Tasks — Recurring Tasks

**User Story:** As a user, I want tasks to recur on a schedule based on either the due date or the completion date, so that I can track repeating responsibilities.

#### Acceptance Criteria

1. WHEN a user enables recurrence on a task, THE App SHALL set isRecurring to true and store the recurrenceInterval (an integer from 1 to 365), recurrenceUnit, and recurrenceAnchor
2. THE App SHALL support recurrenceUnit values of "days", "weeks", and "months"
3. WHEN a recurring task with recurrenceAnchor "due_date" is completed, THE App SHALL create a new Task with a dueDate calculated by adding recurrenceInterval recurrenceUnit to the original dueDate
4. WHEN a recurring task with recurrenceAnchor "completed_date" is completed, THE App SHALL create a new Task with a dueDate calculated by adding recurrenceInterval recurrenceUnit to the completedAt timestamp
5. WHEN a new recurring task is created upon completion, THE App SHALL set the new Task status to "open" and copy the title, body, projectID, recurrence settings, and subtask titles from the completed task
6. IF a recurring task with recurrenceAnchor "due_date" is completed and the task has no dueDate set, THEN THE App SHALL calculate the new dueDate by adding recurrenceInterval recurrenceUnit to the completedAt timestamp instead

### Requirement 11: Tasks — Subtasks

**User Story:** As a user, I want to break tasks into subtasks (checklist items), so that I can track granular progress within a task.

#### Acceptance Criteria

1. WHEN a user adds a subtask to a task, THE App SHALL create a task_subtasks record with a generated recordID, the parent Task's taskID, the provided title (maximum 255 characters), isCompleted set to false, and current timestamps for createdAt and updatedAt
2. IF a user attempts to add a subtask with an empty title or a title exceeding 255 characters, THEN THE App SHALL reject the input and display an error message indicating the title must be between 1 and 255 characters
3. WHEN a user toggles a subtask's completion state, THE App SHALL invert the isCompleted field on the task_subtasks record and set updatedAt to the current timestamp
4. WHEN a user deletes a subtask, THE App SHALL remove the task_subtasks record from the Supabase_Backend
5. THE App SHALL only allow the parent Task creator to delete subtasks
6. THE App SHALL display subtasks as a checklist within the parent task view, ordered by createdAt ascending
7. THE App SHALL allow a maximum of 50 subtasks per Task

### Requirement 12: Tasks — Delete

**User Story:** As a user, I want to delete tasks I own, so that I can remove items that are no longer relevant.

#### Acceptance Criteria

1. WHEN a user deletes a task they created and confirms the deletion, THE App SHALL remove the Task record and all associated task_subtasks records from the Supabase_Backend and remove the task from the displayed task list
2. WHEN a user attempts to delete a task, THE App SHALL display a confirmation prompt requiring the user to confirm or cancel before proceeding
3. WHEN a user cancels the deletion confirmation prompt, THE App SHALL retain the Task record unchanged and return the user to the previous view
4. IF a non-creator user attempts to delete a Task, THEN THE App SHALL not display the delete option for that Task
5. IF the deletion request to the Supabase_Backend fails, THEN THE App SHALL display an error message indicating the task was not deleted and retain the Task record in the displayed list

### Requirement 13: Projects — Create and Manage

**User Story:** As a user, I want to create projects to organize related notes and tasks, so that I can group work by context.

#### Acceptance Criteria

1. WHEN a user creates a project, THE App SHALL store a task_projects record with a generated recordID, the user's creatorID, the provided name, and current timestamps
2. IF a user submits a project name that is empty or exceeds 100 characters, THEN THE App SHALL reject the creation or edit and display an error message indicating the name must be between 1 and 100 characters
3. WHEN a user edits a project name or description, THE App SHALL update the task_projects record and set updatedAt to the current time
4. WHEN a user attempts to delete a project, THE App SHALL display a confirmation prompt before proceeding
5. WHEN a user confirms project deletion, THE App SHALL remove the task_projects record and set projectID to null on all associated Notes and Tasks
6. THE App SHALL only allow the Project creator to edit or delete the Project
7. THE App SHALL display a list of projects created by or shared with the current user, ordered by updatedAt descending

### Requirement 14: Projects — Sharing

**User Story:** As a user, I want to share projects with other users so that all notes and tasks within the project become accessible to collaborators.

#### Acceptance Criteria

1. WHEN a project creator shares a project with another user, THE App SHALL create a task_projects_shared record with a generated recordID, the Project recordID, the recipient's user ID, and the current timestamp
2. WHEN a project is shared with a user, THE App SHALL grant the recipient read and edit access to all Notes and Tasks within that Project, but SHALL NOT grant the recipient permission to delete Notes or Tasks they did not create
3. WHEN a project is shared with a user, THE App SHALL display that project and its associated Notes and Tasks in the recipient's project list
4. WHEN a project creator removes sharing for a user, THE App SHALL delete the corresponding task_projects_shared record and the recipient SHALL no longer see the project or its contents in their lists
5. THE App SHALL only allow the Project creator to manage project sharing permissions
6. IF a project creator attempts to share a project with themselves or with a user who already has access, THEN THE App SHALL display an error message indicating the reason the share cannot be created and SHALL NOT create a duplicate record

### Requirement 15: Offline-First Caching for Non-Shared Items

**User Story:** As a user, I want my personal notes and tasks to be available offline and sync when connectivity returns, so that I can work without interruption.

#### Acceptance Criteria

1. WHILE a Non_Shared_Item is created, updated, or deleted offline, THE Offline_Queue SHALL store the mutation in IndexedDB with a timestamp indicating when it was queued
2. WHEN connectivity is restored, THE Sync_Engine SHALL drain the Offline_Queue in FIFO order (oldest queued mutation first) and apply pending mutations to the Supabase_Backend
3. IF a pending mutation fails with a non-conflict error during sync, THEN THE Sync_Engine SHALL retain the mutation in the Offline_Queue and reattempt it on the next sync cycle
4. THE App SHALL display Non_Shared_Items from the local IndexedDB cache within 200 milliseconds of page render without waiting for a network response
5. WHEN a sync conflict occurs for a Non_Shared_Item (duplicate key), THE Sync_Engine SHALL treat the existing server record as authoritative, remove the queued item, and display a notification to the user indicating the conflict was resolved
6. THE App SHALL cache up to 50 MB of Non_Shared_Item data in localStorage for instant load on subsequent app launches, and SHALL evict the least-recently-updated items when the storage limit is reached

### Requirement 16: Online-Only Access for Shared Items

**User Story:** As a user, I want shared notes and tasks to always reflect the latest server state, so that collaborators see consistent data without merge conflicts.

#### Acceptance Criteria

1. WHEN a user opens or navigates to a Shared_Item, THE App SHALL fetch the current state from the Supabase_Backend and SHALL NOT display the item content until the fetch completes or fails
2. THE App SHALL NOT cache Shared_Items in the Offline_Queue, IndexedDB, or localStorage for offline viewing or editing
3. IF the network is unavailable when a user attempts to view or edit a Shared_Item, THEN THE App SHALL display an inline message indicating that shared items require an internet connection and SHALL prevent editing of the item
4. WHEN a user modifies a Shared_Item, THE App SHALL write the change directly to the Supabase_Backend and confirm success before updating the UI
5. IF a write to the Supabase_Backend fails when a user modifies a Shared_Item, THEN THE App SHALL retain the user's input in the editing interface and display an error message indicating the save failed
6. WHEN a Non_Shared_Item becomes a Shared_Item through direct sharing or Project sharing, THE App SHALL remove any locally cached copy of that item from localStorage and the Offline_Queue

### Requirement 17: Connectivity Detection and Sync Status

**User Story:** As a user, I want to know my connectivity status and pending sync count, so that I understand when my changes will be saved to the server.

#### Acceptance Criteria

1. WHEN the device loses network connectivity, THE App SHALL display a persistent visual indicator in the App toolbar showing the offline state
2. IF the count of pending mutations in the Offline_Queue is greater than zero, THEN THE App SHALL display the numeric count of pending mutations alongside the offline indicator
3. WHILE the Sync_Engine is actively syncing pending mutations, THE App SHALL display a syncing indicator that includes the pending mutation count
4. THE App SHALL perform connectivity verification every 30 seconds using an HTTP HEAD request to the Supabase_Backend REST endpoint with a 5-second timeout
5. WHEN the App detects a transition from offline to online via connectivity verification, THE App SHALL automatically trigger synchronization of all pending mutations in the Offline_Queue
6. WHEN the device's visibility state changes to visible, THE App SHALL perform an immediate connectivity verification and, if online, trigger synchronization of pending mutations

### Requirement 18: Data Migration from Budget Structure

**User Story:** As a developer, I want the app to use the notes and tasks database schema instead of the budget schema, so that the data layer matches the new functionality.

#### Acceptance Criteria

1. THE App SHALL issue all database queries exclusively against the notes, notes_shared, tasks, task_subtasks, task_projects, and task_projects_shared tables using the column names and types defined in the notes_migrations and tasks_migrations files
2. THE App SHALL NOT contain any source code that queries, reads from, or writes to the budgets, sections, categories, transactions, or shared tables from the previous schema
3. THE App SHALL connect to Supabase as an authenticated user so that the row-level security policies defined in the migration files are enforced by the database for all data access operations
4. WHEN the App starts, THE App SHALL disregard any previously cached data associated with the old budget schema (cachedBudgets, cachedSections, cachedCategories, cachedTransactions) so that stale budget data is not loaded into the application state
