import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { IDBFactory } from 'fake-indexeddb';
import { enqueue, getAll } from '../offlineQueue';
import type { PendingMutation } from '../../types';

/**
 * Feature: simpletracker-notes-tasks, Property 13: Offline Queue FIFO Order
 *
 * For any sequence of mutations enqueued with monotonically increasing
 * _queuedAt timestamps, getAll() SHALL return them in ascending _queuedAt
 * order (oldest first).
 *
 * **Validates: Requirements 15.2**
 */
describe('Property 13: Offline Queue FIFO Order', () => {
    beforeEach(() => {
        // Replace globalThis.indexedDB with a fresh IDBFactory instance
        // This gives us a completely clean IndexedDB state for each test
        globalThis.indexedDB = new IDBFactory();
    });

    const entityTypeArb = fc.constantFrom<PendingMutation['entityType']>('note', 'task', 'subtask', 'project');
    const operationArb = fc.constantFrom<PendingMutation['operation']>('insert', 'update', 'delete');

    /**
     * Generate an array of PendingMutation objects with strictly increasing _queuedAt timestamps.
     * We start from a base timestamp and add increasing offsets to guarantee monotonic ordering.
     */
    const pendingMutationsArb = fc.array(
        fc.record({
            entityType: entityTypeArb,
            operation: operationArb,
            recordID: fc.uuid(),
            payload: fc.dictionary(
                fc.string({ minLength: 1, maxLength: 20 }),
                fc.oneof(fc.string({ maxLength: 50 }), fc.integer(), fc.boolean())
            ),
        }),
        { minLength: 1, maxLength: 10 }
    ).chain((mutations) => {
        // Generate a base timestamp and strictly increasing offsets
        return fc.tuple(
            fc.integer({ min: 1_000_000_000_000, max: 1_500_000_000_000 }),
            fc.array(
                fc.integer({ min: 1, max: 10_000 }),
                { minLength: mutations.length, maxLength: mutations.length }
            )
        ).map(([baseTimestamp, offsets]) => {
            // Convert offsets to cumulative sums for strictly increasing timestamps
            let cumulative = 0;
            return mutations.map((m, i) => {
                cumulative += offsets[i];
                const mutation: PendingMutation = {
                    id: `mutation-${i}-${cumulative}`,
                    entityType: m.entityType,
                    operation: m.operation,
                    recordID: m.recordID,
                    payload: m.payload as Record<string, unknown>,
                    _queuedAt: baseTimestamp + cumulative,
                };
                return mutation;
            });
        });
    });

    it('mutations enqueued with increasing timestamps are returned in ascending _queuedAt order', async () => {
        await fc.assert(
            fc.asyncProperty(pendingMutationsArb, async (mutations) => {
                // Reset IndexedDB for each property iteration
                globalThis.indexedDB = new IDBFactory();

                // Enqueue all mutations in order
                for (const mutation of mutations) {
                    await enqueue(mutation);
                }

                // Retrieve all mutations
                const result = await getAll();

                // Verify count matches
                expect(result).toHaveLength(mutations.length);

                // Verify FIFO order: _queuedAt should be in ascending order
                for (let i = 1; i < result.length; i++) {
                    expect(result[i]._queuedAt).toBeGreaterThan(result[i - 1]._queuedAt);
                }
            }),
            { numRuns: 20 }
        );
    }, 30000);

    it('mutations enqueued out of order are still returned sorted by _queuedAt ascending', async () => {
        await fc.assert(
            fc.asyncProperty(pendingMutationsArb, async (mutations) => {
                // Reset IndexedDB for each property iteration
                globalThis.indexedDB = new IDBFactory();

                // Shuffle the mutations before enqueueing to test that getAll
                // returns them sorted by _queuedAt regardless of insertion order
                const shuffled = [...mutations].sort(() => Math.random() - 0.5);

                for (const mutation of shuffled) {
                    await enqueue(mutation);
                }

                // Retrieve all mutations
                const result = await getAll();

                // Verify count matches
                expect(result).toHaveLength(mutations.length);

                // Verify ascending _queuedAt order
                for (let i = 1; i < result.length; i++) {
                    expect(result[i]._queuedAt).toBeGreaterThanOrEqual(result[i - 1]._queuedAt);
                }
            }),
            { numRuns: 20 }
        );
    }, 30000);
});
