import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { useTaskStore } from '../taskStore';
import { useGlobalStore } from '../globalStore';

// Mock Supabase client
vi.mock('../../lib/supabase', () => ({
    supabase: {
        from: () => ({
            select: () => ({ order: () => ({ data: [], error: null }) }),
            insert: () => ({ data: null, error: null }),
            update: () => ({ eq: () => ({ data: null, error: null }) }),
            delete: () => ({ eq: () => ({ data: null, error: null }) }),
        }),
    },
}));

// Mock offlineSync functions
vi.mock('../../lib/offlineSync', () => ({
    insertWithOfflineSupport: vi.fn().mockResolvedValue({ success: true, queued: false }),
    updateWithOfflineSupport: vi.fn().mockResolvedValue({ success: true, queued: false }),
    deleteWithOfflineSupport: vi.fn().mockResolvedValue({ success: true, queued: false }),
}));

// Mock cache functions
vi.mock('../../lib/cache', () => ({
    getCachedTasks: vi.fn().mockReturnValue([]),
    setCachedTasks: vi.fn(),
    getCachedSubtasks: vi.fn().mockReturnValue({}),
    setCachedSubtasks: vi.fn(),
}));

// Mock recurrence module
vi.mock('../../lib/recurrence', () => ({
    spawnRecurringTask: vi.fn().mockReturnValue({ task: {}, subtasks: [] }),
}));

const NUM_RUNS = 100;
const TEST_USER_ID = 'test-user-id-12345';

// Helper to reset store state and set up user
function resetStoreState() {
    useTaskStore.setState({ tasks: [], subtasks: {}, statusFilter: 'open', loading: false, error: null });
    useGlobalStore.setState({
        currentUser: { recordID: TEST_USER_ID, fullName: 'Test User', userType: 'free' },
    });
}

/**
 * Feature: simpletracker-notes-tasks, Property 4: Task Creation Defaults
 *
 * For any valid title (1-255 characters) and authenticated user, creating a new task
 * SHALL produce a record with a non-empty recordID, creatorID equal to the user's ID,
 * the provided title, body="", status="open", dueDate=null, isRecurring=false,
 * completedAt=null, and createdAt equal to updatedAt.
 *
 * **Validates: Requirements 8.1**
 */
describe('Property 4: Task Creation Defaults', () => {
    beforeEach(() => {
        resetStoreState();
    });

    // Arbitrary for valid task titles: trimmed length between 1 and 255
    const validTitleArb = fc.string({ minLength: 1, maxLength: 255 })
        .filter((s) => s.trim().length >= 1 && s.trim().length <= 255);

    it('creates a task with non-empty recordID for any valid title', async () => {
        await fc.assert(
            fc.asyncProperty(validTitleArb, async (title) => {
                resetStoreState();
                const task = await useTaskStore.getState().createTask(title);
                expect(task).not.toBeNull();
                expect(task!.recordID).toBeDefined();
                expect(task!.recordID.length).toBeGreaterThan(0);
            }),
            { numRuns: NUM_RUNS }
        );
    });

    it('sets creatorID equal to the current user ID', async () => {
        await fc.assert(
            fc.asyncProperty(validTitleArb, async (title) => {
                resetStoreState();
                const task = await useTaskStore.getState().createTask(title);
                expect(task).not.toBeNull();
                expect(task!.creatorID).toBe(TEST_USER_ID);
            }),
            { numRuns: NUM_RUNS }
        );
    });

    it('stores the provided title (trimmed)', async () => {
        await fc.assert(
            fc.asyncProperty(validTitleArb, async (title) => {
                resetStoreState();
                const task = await useTaskStore.getState().createTask(title);
                expect(task).not.toBeNull();
                expect(task!.title).toBe(title.trim());
            }),
            { numRuns: NUM_RUNS }
        );
    });

    it('sets default fields: body="", status="open", dueDate=null, isRecurring=false, completedAt=null', async () => {
        await fc.assert(
            fc.asyncProperty(validTitleArb, async (title) => {
                resetStoreState();
                const task = await useTaskStore.getState().createTask(title);
                expect(task).not.toBeNull();
                expect(task!.body).toBe('');
                expect(task!.status).toBe('open');
                expect(task!.dueDate).toBeNull();
                expect(task!.isRecurring).toBe(false);
                expect(task!.completedAt).toBeNull();
            }),
            { numRuns: NUM_RUNS }
        );
    });

    it('sets createdAt equal to updatedAt', async () => {
        await fc.assert(
            fc.asyncProperty(validTitleArb, async (title) => {
                resetStoreState();
                const task = await useTaskStore.getState().createTask(title);
                expect(task).not.toBeNull();
                expect(task!.createdAt).toBe(task!.updatedAt);
            }),
            { numRuns: NUM_RUNS }
        );
    });
});

/**
 * Feature: simpletracker-notes-tasks, Property 8: Task Status Round-Trip
 *
 * For any open task, marking it complete SHALL set status="completed" and completedAt
 * to a non-null timestamp with updatedAt updated. Subsequently reopening it SHALL set
 * status="open", completedAt=null, and updatedAt updated. The task's title, body, and
 * projectID SHALL remain unchanged through both operations.
 *
 * **Validates: Requirements 9.1, 9.2**
 */
describe('Property 8: Task Status Round-Trip', () => {
    beforeEach(() => {
        resetStoreState();
    });

    // Arbitrary for valid task titles
    const validTitleArb = fc.string({ minLength: 1, maxLength: 100 })
        .filter((s) => s.trim().length >= 1 && s.trim().length <= 255);

    // Arbitrary for task body (any string)
    const bodyArb = fc.string({ maxLength: 200 });

    // Arbitrary for projectID (null or a uuid-like string)
    const projectIDArb = fc.option(fc.uuid(), { nil: null });

    it('completeTask sets status="completed" and completedAt to non-null, preserving title/body/projectID', async () => {
        await fc.assert(
            fc.asyncProperty(validTitleArb, bodyArb, projectIDArb, async (title, body, projectID) => {
                resetStoreState();

                // Create a task
                const task = await useTaskStore.getState().createTask(title);
                expect(task).not.toBeNull();

                // Update body and projectID
                await useTaskStore.getState().updateTask(task!.recordID, { body, projectID });

                // Complete the task
                const result = await useTaskStore.getState().completeTask(task!.recordID);
                expect(result).toBe(true);

                // Verify status change
                const completedTask = useTaskStore.getState().tasks.find((t) => t.recordID === task!.recordID);
                expect(completedTask).toBeDefined();
                expect(completedTask!.status).toBe('completed');
                expect(completedTask!.completedAt).not.toBeNull();
                expect(completedTask!.completedAt).toBeGreaterThan(0);

                // Verify title/body/projectID preserved
                expect(completedTask!.title).toBe(title.trim());
                expect(completedTask!.body).toBe(body);
                expect(completedTask!.projectID).toBe(projectID);
            }),
            { numRuns: NUM_RUNS }
        );
    });

    it('reopenTask sets status="open" and completedAt=null, preserving title/body/projectID', async () => {
        await fc.assert(
            fc.asyncProperty(validTitleArb, bodyArb, projectIDArb, async (title, body, projectID) => {
                resetStoreState();

                // Create and complete a task
                const task = await useTaskStore.getState().createTask(title);
                expect(task).not.toBeNull();

                await useTaskStore.getState().updateTask(task!.recordID, { body, projectID });
                await useTaskStore.getState().completeTask(task!.recordID);

                // Reopen the task
                const result = await useTaskStore.getState().reopenTask(task!.recordID);
                expect(result).toBe(true);

                // Verify status restored
                const reopenedTask = useTaskStore.getState().tasks.find((t) => t.recordID === task!.recordID);
                expect(reopenedTask).toBeDefined();
                expect(reopenedTask!.status).toBe('open');
                expect(reopenedTask!.completedAt).toBeNull();

                // Verify title/body/projectID preserved
                expect(reopenedTask!.title).toBe(title.trim());
                expect(reopenedTask!.body).toBe(body);
                expect(reopenedTask!.projectID).toBe(projectID);
            }),
            { numRuns: NUM_RUNS }
        );
    });

    it('complete then reopen is a full round-trip preserving all data fields', async () => {
        await fc.assert(
            fc.asyncProperty(validTitleArb, bodyArb, projectIDArb, async (title, body, projectID) => {
                resetStoreState();

                // Create task with specific fields
                const task = await useTaskStore.getState().createTask(title);
                expect(task).not.toBeNull();

                await useTaskStore.getState().updateTask(task!.recordID, { body, projectID });

                // Complete then reopen
                await useTaskStore.getState().completeTask(task!.recordID);
                await useTaskStore.getState().reopenTask(task!.recordID);

                // Verify final state
                const finalTask = useTaskStore.getState().tasks.find((t) => t.recordID === task!.recordID);
                expect(finalTask).toBeDefined();
                expect(finalTask!.status).toBe('open');
                expect(finalTask!.completedAt).toBeNull();
                expect(finalTask!.title).toBe(title.trim());
                expect(finalTask!.body).toBe(body);
                expect(finalTask!.projectID).toBe(projectID);
            }),
            { numRuns: NUM_RUNS }
        );
    });
});

/**
 * Feature: simpletracker-notes-tasks, Property 11: Subtask Toggle Involution
 *
 * For any subtask, toggling its isCompleted state SHALL invert the boolean value
 * and update updatedAt. Toggling it twice SHALL restore the original isCompleted value.
 *
 * **Validates: Requirements 11.3**
 */
describe('Property 11: Subtask Toggle Involution', () => {
    beforeEach(() => {
        resetStoreState();
    });

    // Arbitrary for valid subtask titles (1-255 chars)
    const validSubtaskTitleArb = fc.string({ minLength: 1, maxLength: 100 })
        .filter((s) => s.trim().length >= 1 && s.trim().length <= 255);

    // Arbitrary for valid task titles
    const validTitleArb = fc.string({ minLength: 1, maxLength: 100 })
        .filter((s) => s.trim().length >= 1 && s.trim().length <= 255);

    it('single toggle inverts isCompleted from false to true', async () => {
        await fc.assert(
            fc.asyncProperty(validTitleArb, validSubtaskTitleArb, async (taskTitle, subtaskTitle) => {
                resetStoreState();

                // Create a task and add a subtask
                const task = await useTaskStore.getState().createTask(taskTitle);
                expect(task).not.toBeNull();

                const subtask = await useTaskStore.getState().addSubtask(task!.recordID, subtaskTitle);
                expect(subtask).not.toBeNull();
                expect(subtask!.isCompleted).toBe(false);

                // Toggle once
                const result = await useTaskStore.getState().toggleSubtask(subtask!.recordID);
                expect(result).toBe(true);

                // Verify inverted
                const subtasks = useTaskStore.getState().subtasks[task!.recordID];
                expect(subtasks).toBeDefined();
                const toggled = subtasks.find((s) => s.recordID === subtask!.recordID);
                expect(toggled).toBeDefined();
                expect(toggled!.isCompleted).toBe(true);
            }),
            { numRuns: NUM_RUNS }
        );
    });

    it('double toggle restores original isCompleted state (involution)', async () => {
        await fc.assert(
            fc.asyncProperty(validTitleArb, validSubtaskTitleArb, async (taskTitle, subtaskTitle) => {
                resetStoreState();

                // Create a task and add a subtask
                const task = await useTaskStore.getState().createTask(taskTitle);
                expect(task).not.toBeNull();

                const subtask = await useTaskStore.getState().addSubtask(task!.recordID, subtaskTitle);
                expect(subtask).not.toBeNull();
                const originalState = subtask!.isCompleted; // false

                // Toggle twice
                await useTaskStore.getState().toggleSubtask(subtask!.recordID);
                await useTaskStore.getState().toggleSubtask(subtask!.recordID);

                // Verify restored
                const subtasks = useTaskStore.getState().subtasks[task!.recordID];
                expect(subtasks).toBeDefined();
                const restored = subtasks.find((s) => s.recordID === subtask!.recordID);
                expect(restored).toBeDefined();
                expect(restored!.isCompleted).toBe(originalState);
            }),
            { numRuns: NUM_RUNS }
        );
    });

    it('toggle updates updatedAt timestamp', async () => {
        await fc.assert(
            fc.asyncProperty(validTitleArb, validSubtaskTitleArb, async (taskTitle, subtaskTitle) => {
                resetStoreState();

                // Create a task and add a subtask
                const task = await useTaskStore.getState().createTask(taskTitle);
                expect(task).not.toBeNull();

                const subtask = await useTaskStore.getState().addSubtask(task!.recordID, subtaskTitle);
                expect(subtask).not.toBeNull();
                const originalUpdatedAt = subtask!.updatedAt;

                // Small delay to ensure timestamp difference
                await new Promise((resolve) => setTimeout(resolve, 2));

                // Toggle
                await useTaskStore.getState().toggleSubtask(subtask!.recordID);

                // Verify updatedAt increased
                const subtasks = useTaskStore.getState().subtasks[task!.recordID];
                expect(subtasks).toBeDefined();
                const toggled = subtasks.find((s) => s.recordID === subtask!.recordID);
                expect(toggled).toBeDefined();
                expect(toggled!.updatedAt).toBeGreaterThanOrEqual(originalUpdatedAt);
            }),
            { numRuns: NUM_RUNS }
        );
    });
});

/**
 * Feature: simpletracker-notes-tasks, Property 12: Mutations Update Timestamp
 *
 * For any successful update operation on a task, the entity's updatedAt field
 * SHALL be set to a value greater than or equal to its previous updatedAt value.
 *
 * **Validates: Requirements 8.3**
 */
describe('Property 12: Mutations Update Timestamp', () => {
    beforeEach(() => {
        resetStoreState();
    });

    // Arbitrary for valid task titles
    const validTitleArb = fc.string({ minLength: 1, maxLength: 100 })
        .filter((s) => s.trim().length >= 1 && s.trim().length <= 255);

    // Arbitrary for new valid titles to update to
    const newTitleArb = fc.string({ minLength: 1, maxLength: 100 })
        .filter((s) => s.trim().length >= 1 && s.trim().length <= 255);

    // Arbitrary for body updates
    const bodyArb = fc.string({ maxLength: 200 });

    it('updateTask increases updatedAt for title changes', async () => {
        await fc.assert(
            fc.asyncProperty(validTitleArb, newTitleArb, async (originalTitle, newTitle) => {
                resetStoreState();

                // Create a task
                const task = await useTaskStore.getState().createTask(originalTitle);
                expect(task).not.toBeNull();
                const originalUpdatedAt = task!.updatedAt;

                // Small delay to ensure timestamp difference
                await new Promise((resolve) => setTimeout(resolve, 2));

                // Update the title
                const result = await useTaskStore.getState().updateTask(task!.recordID, { title: newTitle });
                expect(result).toBe(true);

                // Verify updatedAt increased
                const updatedTask = useTaskStore.getState().tasks.find((t) => t.recordID === task!.recordID);
                expect(updatedTask).toBeDefined();
                expect(updatedTask!.updatedAt).toBeGreaterThanOrEqual(originalUpdatedAt);
            }),
            { numRuns: NUM_RUNS }
        );
    });

    it('updateTask increases updatedAt for body changes', async () => {
        await fc.assert(
            fc.asyncProperty(validTitleArb, bodyArb, async (title, newBody) => {
                resetStoreState();

                // Create a task
                const task = await useTaskStore.getState().createTask(title);
                expect(task).not.toBeNull();
                const originalUpdatedAt = task!.updatedAt;

                // Small delay to ensure timestamp difference
                await new Promise((resolve) => setTimeout(resolve, 2));

                // Update the body
                const result = await useTaskStore.getState().updateTask(task!.recordID, { body: newBody });
                expect(result).toBe(true);

                // Verify updatedAt increased
                const updatedTask = useTaskStore.getState().tasks.find((t) => t.recordID === task!.recordID);
                expect(updatedTask).toBeDefined();
                expect(updatedTask!.updatedAt).toBeGreaterThanOrEqual(originalUpdatedAt);
            }),
            { numRuns: NUM_RUNS }
        );
    });

    it('completeTask increases updatedAt', async () => {
        await fc.assert(
            fc.asyncProperty(validTitleArb, async (title) => {
                resetStoreState();

                // Create a task
                const task = await useTaskStore.getState().createTask(title);
                expect(task).not.toBeNull();
                const originalUpdatedAt = task!.updatedAt;

                // Small delay to ensure timestamp difference
                await new Promise((resolve) => setTimeout(resolve, 2));

                // Complete the task
                await useTaskStore.getState().completeTask(task!.recordID);

                // Verify updatedAt increased
                const completedTask = useTaskStore.getState().tasks.find((t) => t.recordID === task!.recordID);
                expect(completedTask).toBeDefined();
                expect(completedTask!.updatedAt).toBeGreaterThanOrEqual(originalUpdatedAt);
            }),
            { numRuns: NUM_RUNS }
        );
    });

    it('reopenTask increases updatedAt', async () => {
        await fc.assert(
            fc.asyncProperty(validTitleArb, async (title) => {
                resetStoreState();

                // Create and complete a task
                const task = await useTaskStore.getState().createTask(title);
                expect(task).not.toBeNull();

                await useTaskStore.getState().completeTask(task!.recordID);

                const completedTask = useTaskStore.getState().tasks.find((t) => t.recordID === task!.recordID);
                expect(completedTask).toBeDefined();
                const afterCompleteUpdatedAt = completedTask!.updatedAt;

                // Small delay to ensure timestamp difference
                await new Promise((resolve) => setTimeout(resolve, 2));

                // Reopen the task
                await useTaskStore.getState().reopenTask(task!.recordID);

                // Verify updatedAt increased
                const reopenedTask = useTaskStore.getState().tasks.find((t) => t.recordID === task!.recordID);
                expect(reopenedTask).toBeDefined();
                expect(reopenedTask!.updatedAt).toBeGreaterThanOrEqual(afterCompleteUpdatedAt);
            }),
            { numRuns: NUM_RUNS }
        );
    });
});
