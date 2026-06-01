export interface Note {
    recordID: string;
    creatorID: string;
    title: string;
    body: string;
    createdAt: number;
    updatedAt: number;
    projectID: string | null;
    archived: boolean;
    pinned: boolean;
    noteType: 'text' | 'list';
}

export interface NoteListItem {
    recordID: string;
    noteID: string;
    title: string;
    isCompleted: boolean;
    createdAt: number;
    updatedAt: number;
}

export interface NoteShared {
    recordID: string;
    noteID: string;
    creatorID: string;
    sharedToID: string;
}

export interface Task {
    recordID: string;
    creatorID: string;
    projectID: string | null;
    title: string;
    body: string;
    status: 'open' | 'completed';
    dueDate: number | null;
    isRecurring: boolean;
    recurrenceInterval: number | null;
    recurrenceUnit: 'days' | 'weeks' | 'months' | null;
    recurrenceAnchor: 'due_date' | 'completed_date';
    completedAt: number | null;
    createdAt: number;
    updatedAt: number;
}

export interface Subtask {
    recordID: string;
    taskID: string;
    title: string;
    isCompleted: boolean;
    createdAt: number;
    updatedAt: number;
}

export interface Project {
    recordID: string;
    creatorID: string;
    name: string;
    description: string;
    createdAt: number;
    updatedAt: number;
}

export interface ProjectShared {
    recordID: string;
    projectID: string;
    creatorID: string;
    sharedToID: string;
    createdAt: number;
}

export interface PendingMutation {
    id: string;
    entityType: 'note' | 'task' | 'subtask' | 'project' | 'noteListItem';
    operation: 'insert' | 'update' | 'delete';
    recordID: string;
    payload: Record<string, unknown>;
    _queuedAt: number;
}
