export interface ValidationResult {
    valid: boolean;
    error?: string;
}

/**
 * Validates a note title.
 * Note titles can be empty but cannot exceed 255 characters (trimmed).
 */
export function validateNoteTitle(title: string): ValidationResult {
    const trimmedLength = title.trim().length;
    if (trimmedLength > 255) {
        return { valid: false, error: 'Note title must not exceed 255 characters' };
    }
    return { valid: true };
}

/**
 * Validates a task title.
 * Task titles are required and must be between 1 and 255 characters (trimmed).
 */
export function validateTaskTitle(title: string): ValidationResult {
    const trimmedLength = title.trim().length;
    if (trimmedLength < 1) {
        return { valid: false, error: 'Task title must be between 1 and 255 characters' };
    }
    if (trimmedLength > 255) {
        return { valid: false, error: 'Task title must be between 1 and 255 characters' };
    }
    return { valid: true };
}

/**
 * Validates a subtask title.
 * Subtask titles are required and must be between 1 and 255 characters (trimmed).
 */
export function validateSubtaskTitle(title: string): ValidationResult {
    const trimmedLength = title.trim().length;
    if (trimmedLength < 1) {
        return { valid: false, error: 'Subtask title must be between 1 and 255 characters' };
    }
    if (trimmedLength > 255) {
        return { valid: false, error: 'Subtask title must be between 1 and 255 characters' };
    }
    return { valid: true };
}

/**
 * Validates a project name.
 * Project names are required and must be between 1 and 100 characters (trimmed).
 */
export function validateProjectName(name: string): ValidationResult {
    const trimmedLength = name.trim().length;
    if (trimmedLength < 1) {
        return { valid: false, error: 'Project name must be between 1 and 100 characters' };
    }
    if (trimmedLength > 100) {
        return { valid: false, error: 'Project name must be between 1 and 100 characters' };
    }
    return { valid: true };
}

/**
 * Validates a note body.
 * Note bodies can be empty but cannot exceed 100,000 characters (trimmed).
 */
export function validateNoteBody(body: string): ValidationResult {
    const trimmedLength = body.trim().length;
    if (trimmedLength > 100000) {
        return { valid: false, error: 'Note body must not exceed 100,000 characters' };
    }
    return { valid: true };
}
