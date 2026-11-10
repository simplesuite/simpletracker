import { describe, it, expect } from 'vitest';
import { classifySyncError, shouldAbandonWrite } from '../syncErrors';

describe('classifySyncError', () => {
    it.each([
        'duplicate key value violates unique constraint "tasks_pkey"',
        'insert or update on table "task_subtasks" violates foreign key constraint "task_subtasks_taskID_fkey"',
        'null value in column "title" of relation "tasks" violates not-null constraint',
        'invalid input syntax for type uuid: "abc"',
        'value too long for type character varying(255)',
        'Could not find the \'foo\' column of \'tasks\' in the schema cache',
    ])('treats %s as a constraint error', (message) => {
        expect(classifySyncError(message)).toBe('constraint');
    });

    it('treats an RLS denial as access-denied', () => {
        expect(classifySyncError('new row violates row-level security policy for table "notes"')).toBe('access-denied');
        expect(classifySyncError('permission denied for table tasks')).toBe('access-denied');
    });

    it.each(['Failed to fetch', 'JWT expired', 'Network request failed', 'upstream timeout', ''])(
        'treats %s as transient',
        (message) => {
            expect(classifySyncError(message)).toBe('transient');
        }
    );
});

describe('shouldAbandonWrite', () => {
    const rls = 'new row violates row-level security policy for table "notes"';
    const fk = 'violates foreign key constraint "x"';

    it('abandons a write the server rejects on constraint grounds', () => {
        expect(shouldAbandonWrite({ message: fk, type: 'set', isAuthenticated: true })).toBe(true);
        expect(shouldAbandonWrite({ message: fk, type: 'set', isAuthenticated: false })).toBe(true);
    });

    it('abandons an RLS-denied write only while signed in', () => {
        expect(shouldAbandonWrite({ message: rls, type: 'set', isAuthenticated: true })).toBe(true);
        // A lapsed session hits RLS as anon; that heals on re-auth, so keep the work.
        expect(shouldAbandonWrite({ message: rls, type: 'set', isAuthenticated: false })).toBe(false);
    });

    it('never abandons transient failures or reads', () => {
        expect(shouldAbandonWrite({ message: 'Failed to fetch', type: 'set', isAuthenticated: true })).toBe(false);
        expect(shouldAbandonWrite({ message: fk, type: 'get', isAuthenticated: true })).toBe(false);
        expect(shouldAbandonWrite({ message: fk, type: undefined, isAuthenticated: true })).toBe(false);
    });
});
