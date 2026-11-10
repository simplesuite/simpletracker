#!/usr/bin/env node
/**
 * Find (and optionally remove) duplicate recurring-task occurrences.
 *
 * Before the deterministic-occurrence-ID fix, completing the same recurring
 * task on two devices spawned two copies of the next occurrence. This finds
 * open recurring tasks that are copies of each other and keeps one per group.
 *
 * Read-only by default: it prints what it would delete. Pass --apply to delete.
 * Signs in as YOU, so row-level security limits it to tasks you can see, and it
 * only ever touches tasks you created (never someone else's shared tasks).
 * Deleting a task also deletes its subtasks (ON DELETE CASCADE).
 *
 * Usage (from packages/core):
 *   SUPABASE_URL=... SUPABASE_KEY=<anon key> \
 *   SIMPLETRACKER_EMAIL=you@example.com SIMPLETRACKER_PASSWORD=... \
 *   node scripts/dedupe-recurring-tasks.mjs [--apply]
 */

/**
 * Two open recurring tasks are copies when everything the spawn copied
 * matches: owner, title, project, recurrence settings, and due date. Body is
 * deliberately NOT part of the key, so a copy someone edited is still caught;
 * the report flags differing bodies so you can check before applying.
 */
export function duplicateKey(task) {
    return JSON.stringify([
        task.creatorID,
        (task.title || '').trim(),
        task.projectID ?? null,
        task.recurrenceInterval ?? null,
        task.recurrenceUnit ?? null,
        task.recurrenceAnchor ?? null,
        task.dueDate ?? null,
    ]);
}

/** Keep the most recently edited copy; break ties by the oldest. */
function compareKeepFirst(a, b) {
    if (b.updatedAt !== a.updatedAt) return b.updatedAt - a.updatedAt;
    if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;
    return a.recordID < b.recordID ? -1 : a.recordID > b.recordID ? 1 : 0;
}

/**
 * Group duplicate open recurring tasks owned by `userID`.
 * Returns [{ keep, remove: [...], bodiesDiffer }] for each group with copies.
 */
export function findDuplicateRecurringTasks(tasks, userID) {
    const groups = new Map();
    for (const task of tasks) {
        if (!task || task.creatorID !== userID) continue;
        if (task.status !== 'open' || !task.isRecurring) continue;
        const key = duplicateKey(task);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(task);
    }

    const result = [];
    for (const members of groups.values()) {
        if (members.length < 2) continue;
        const sorted = [...members].sort(compareKeepFirst);
        const [keep, ...remove] = sorted;
        const bodiesDiffer = remove.some((t) => (t.body || '') !== (keep.body || ''));
        result.push({ keep, remove, bodiesDiffer });
    }
    return result;
}

function formatDue(dueDate) {
    return dueDate == null ? 'no due date' : new Date(dueDate).toISOString().slice(0, 16).replace('T', ' ');
}

async function main() {
    const apply = process.argv.includes('--apply');
    const { SUPABASE_URL, SUPABASE_KEY, SIMPLETRACKER_EMAIL, SIMPLETRACKER_PASSWORD } = process.env;
    const missing = ['SUPABASE_URL', 'SUPABASE_KEY', 'SIMPLETRACKER_EMAIL', 'SIMPLETRACKER_PASSWORD'].filter((k) => !process.env[k]);
    if (missing.length > 0) {
        console.error(`Missing env: ${missing.join(', ')}`);
        process.exit(2);
    }

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

    const { data: auth, error: authError } = await supabase.auth.signInWithPassword({
        email: SIMPLETRACKER_EMAIL,
        password: SIMPLETRACKER_PASSWORD,
    });
    if (authError || !auth?.user) {
        console.error(`Sign-in failed: ${authError?.message ?? 'no user'}`);
        process.exit(1);
    }
    const userID = auth.user.id;

    const { data: tasks, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('creatorID', userID)
        .eq('status', 'open')
        .eq('isRecurring', true);
    if (error) {
        console.error(`Could not load tasks: ${error.message}`);
        process.exit(1);
    }

    const groups = findDuplicateRecurringTasks(tasks || [], userID);
    if (groups.length === 0) {
        console.log(`No duplicate recurring tasks found (${(tasks || []).length} open recurring tasks checked).`);
        return;
    }

    let removeCount = 0;
    for (const { keep, remove, bodiesDiffer } of groups) {
        removeCount += remove.length;
        console.log(`\n"${keep.title}" due ${formatDue(keep.dueDate)}: ${remove.length + 1} copies`);
        console.log(`  keep    ${keep.recordID} (edited ${new Date(keep.updatedAt).toISOString()})`);
        for (const t of remove) console.log(`  remove  ${t.recordID} (edited ${new Date(t.updatedAt).toISOString()})`);
        if (bodiesDiffer) console.log('  NOTE: the copies have different notes/body text; check before applying.');
    }

    if (!apply) {
        console.log(`\nDry run: ${removeCount} duplicate(s) in ${groups.length} group(s). Re-run with --apply to delete them.`);
        return;
    }

    const ids = groups.flatMap((g) => g.remove.map((t) => t.recordID));
    const { error: deleteError } = await supabase.from('tasks').delete().in('recordID', ids).eq('creatorID', userID);
    if (deleteError) {
        console.error(`Delete failed: ${deleteError.message}`);
        process.exit(1);
    }
    console.log(`\nDeleted ${ids.length} duplicate task(s). Other devices drop them on their next refresh.`);
}

const isDirectRun = import.meta.url === `file://${process.argv[1]}`;
if (isDirectRun) {
    main().catch((err) => {
        console.error(err);
        process.exit(1);
    });
}
