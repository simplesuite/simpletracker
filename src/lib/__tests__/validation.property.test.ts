import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
    validateNoteTitle,
    validateTaskTitle,
    validateSubtaskTitle,
    validateProjectName,
    validateNoteBody,
} from '../validation';

/**
 * Feature: simpletracker-notes-tasks, Property 2: Input Length Validation
 *
 * For any string input, the system SHALL accept the input if and only if its
 * trimmed length is within the entity's valid range, and SHALL reject it otherwise.
 *
 * Validates: Requirements 4.2, 4.6, 8.2, 11.2, 13.2
 */
describe('Property 2: Input Length Validation', () => {
    const NUM_RUNS = 100;

    describe('validateNoteTitle - max 255 chars, CAN be empty (valid if trimmed length 0-255)', () => {
        it('accepts any string whose trimmed length is between 0 and 255', () => {
            fc.assert(
                fc.property(fc.string(), (input) => {
                    const trimmedLength = input.trim().length;
                    if (trimmedLength >= 0 && trimmedLength <= 255) {
                        const result = validateNoteTitle(input);
                        expect(result.valid).toBe(true);
                        expect(result.error).toBeUndefined();
                    }
                }),
                { numRuns: NUM_RUNS }
            );
        });

        it('rejects any string whose trimmed length exceeds 255', () => {
            fc.assert(
                fc.property(
                    fc.nat({ max: 1000 }).chain((extra) =>
                        fc.tuple(
                            fc.constant(extra),
                            fc.string({ minLength: 256 + extra, maxLength: 256 + extra })
                        )
                    ),
                    ([, input]) => {
                        // Only test if trimmed length actually exceeds 255
                        if (input.trim().length > 255) {
                            const result = validateNoteTitle(input);
                            expect(result.valid).toBe(false);
                            expect(result.error).toBeDefined();
                        }
                    }
                ),
                { numRuns: NUM_RUNS }
            );
        });

        it('validates based on trimmed length, not raw length', () => {
            fc.assert(
                fc.property(
                    fc.string(),
                    fc.nat({ max: 50 }),
                    fc.nat({ max: 50 }),
                    (core, leadingSpaces, trailingSpaces) => {
                        const padded = ' '.repeat(leadingSpaces) + core + ' '.repeat(trailingSpaces);
                        const trimmedLength = padded.trim().length;
                        const result = validateNoteTitle(padded);
                        if (trimmedLength <= 255) {
                            expect(result.valid).toBe(true);
                        } else {
                            expect(result.valid).toBe(false);
                            expect(result.error).toBeDefined();
                        }
                    }
                ),
                { numRuns: NUM_RUNS }
            );
        });
    });

    describe('validateTaskTitle - 1-255 chars required (valid if trimmed length 1-255)', () => {
        it('accepts any string whose trimmed length is between 1 and 255', () => {
            fc.assert(
                fc.property(
                    fc.string({ minLength: 1, maxLength: 255 }).filter(s => s.trim().length >= 1 && s.trim().length <= 255),
                    (input) => {
                        const result = validateTaskTitle(input);
                        expect(result.valid).toBe(true);
                        expect(result.error).toBeUndefined();
                    }
                ),
                { numRuns: NUM_RUNS }
            );
        });

        it('rejects any string whose trimmed length is 0 (empty after trim)', () => {
            fc.assert(
                fc.property(
                    fc.nat({ max: 100 }).map((n) => ' '.repeat(n)),
                    (input) => {
                        // All whitespace strings have trimmed length 0
                        const result = validateTaskTitle(input);
                        expect(result.valid).toBe(false);
                        expect(result.error).toBeDefined();
                    }
                ),
                { numRuns: NUM_RUNS }
            );
        });

        it('rejects any string whose trimmed length exceeds 255', () => {
            fc.assert(
                fc.property(
                    fc.nat({ max: 500 }).map((extra) => 'x'.repeat(256 + extra)),
                    (input) => {
                        const result = validateTaskTitle(input);
                        expect(result.valid).toBe(false);
                        expect(result.error).toBeDefined();
                    }
                ),
                { numRuns: NUM_RUNS }
            );
        });

        it('for any string, valid iff trimmed length is between 1 and 255', () => {
            fc.assert(
                fc.property(fc.string(), (input) => {
                    const trimmedLength = input.trim().length;
                    const result = validateTaskTitle(input);
                    if (trimmedLength >= 1 && trimmedLength <= 255) {
                        expect(result.valid).toBe(true);
                    } else {
                        expect(result.valid).toBe(false);
                        expect(result.error).toBeDefined();
                    }
                }),
                { numRuns: NUM_RUNS }
            );
        });
    });

    describe('validateSubtaskTitle - 1-255 chars required (valid if trimmed length 1-255)', () => {
        it('accepts any string whose trimmed length is between 1 and 255', () => {
            fc.assert(
                fc.property(
                    fc.string({ minLength: 1, maxLength: 255 }).filter(s => s.trim().length >= 1 && s.trim().length <= 255),
                    (input) => {
                        const result = validateSubtaskTitle(input);
                        expect(result.valid).toBe(true);
                        expect(result.error).toBeUndefined();
                    }
                ),
                { numRuns: NUM_RUNS }
            );
        });

        it('rejects any string whose trimmed length is 0', () => {
            fc.assert(
                fc.property(
                    fc.nat({ max: 100 }).map((n) => ' '.repeat(n)),
                    (input) => {
                        const result = validateSubtaskTitle(input);
                        expect(result.valid).toBe(false);
                        expect(result.error).toBeDefined();
                    }
                ),
                { numRuns: NUM_RUNS }
            );
        });

        it('rejects any string whose trimmed length exceeds 255', () => {
            fc.assert(
                fc.property(
                    fc.nat({ max: 500 }).map((extra) => 'a'.repeat(256 + extra)),
                    (input) => {
                        const result = validateSubtaskTitle(input);
                        expect(result.valid).toBe(false);
                        expect(result.error).toBeDefined();
                    }
                ),
                { numRuns: NUM_RUNS }
            );
        });

        it('for any string, valid iff trimmed length is between 1 and 255', () => {
            fc.assert(
                fc.property(fc.string(), (input) => {
                    const trimmedLength = input.trim().length;
                    const result = validateSubtaskTitle(input);
                    if (trimmedLength >= 1 && trimmedLength <= 255) {
                        expect(result.valid).toBe(true);
                    } else {
                        expect(result.valid).toBe(false);
                        expect(result.error).toBeDefined();
                    }
                }),
                { numRuns: NUM_RUNS }
            );
        });
    });

    describe('validateProjectName - 1-100 chars required (valid if trimmed length 1-100)', () => {
        it('accepts any string whose trimmed length is between 1 and 100', () => {
            fc.assert(
                fc.property(
                    fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length >= 1 && s.trim().length <= 100),
                    (input) => {
                        const result = validateProjectName(input);
                        expect(result.valid).toBe(true);
                        expect(result.error).toBeUndefined();
                    }
                ),
                { numRuns: NUM_RUNS }
            );
        });

        it('rejects any string whose trimmed length is 0', () => {
            fc.assert(
                fc.property(
                    fc.nat({ max: 100 }).map((n) => ' '.repeat(n)),
                    (input) => {
                        const result = validateProjectName(input);
                        expect(result.valid).toBe(false);
                        expect(result.error).toBeDefined();
                    }
                ),
                { numRuns: NUM_RUNS }
            );
        });

        it('rejects any string whose trimmed length exceeds 100', () => {
            fc.assert(
                fc.property(
                    fc.nat({ max: 500 }).map((extra) => 'b'.repeat(101 + extra)),
                    (input) => {
                        const result = validateProjectName(input);
                        expect(result.valid).toBe(false);
                        expect(result.error).toBeDefined();
                    }
                ),
                { numRuns: NUM_RUNS }
            );
        });

        it('for any string, valid iff trimmed length is between 1 and 100', () => {
            fc.assert(
                fc.property(fc.string(), (input) => {
                    const trimmedLength = input.trim().length;
                    const result = validateProjectName(input);
                    if (trimmedLength >= 1 && trimmedLength <= 100) {
                        expect(result.valid).toBe(true);
                    } else {
                        expect(result.valid).toBe(false);
                        expect(result.error).toBeDefined();
                    }
                }),
                { numRuns: NUM_RUNS }
            );
        });
    });

    describe('validateNoteBody - max 100,000 chars, CAN be empty (valid if trimmed length 0-100000)', () => {
        it('accepts any string whose trimmed length is between 0 and 100000', () => {
            fc.assert(
                fc.property(fc.string(), (input) => {
                    const trimmedLength = input.trim().length;
                    if (trimmedLength >= 0 && trimmedLength <= 100000) {
                        const result = validateNoteBody(input);
                        expect(result.valid).toBe(true);
                        expect(result.error).toBeUndefined();
                    }
                }),
                { numRuns: NUM_RUNS }
            );
        });

        it('rejects any string whose trimmed length exceeds 100000', () => {
            fc.assert(
                fc.property(
                    fc.nat({ max: 1000 }).map((extra) => 'c'.repeat(100001 + extra)),
                    (input) => {
                        const result = validateNoteBody(input);
                        expect(result.valid).toBe(false);
                        expect(result.error).toBeDefined();
                    }
                ),
                { numRuns: NUM_RUNS }
            );
        });

        it('validates based on trimmed length, not raw length', () => {
            fc.assert(
                fc.property(
                    fc.string({ maxLength: 500 }),
                    fc.nat({ max: 50 }),
                    fc.nat({ max: 50 }),
                    (core, leadingSpaces, trailingSpaces) => {
                        const padded = ' '.repeat(leadingSpaces) + core + ' '.repeat(trailingSpaces);
                        const trimmedLength = padded.trim().length;
                        const result = validateNoteBody(padded);
                        if (trimmedLength <= 100000) {
                            expect(result.valid).toBe(true);
                        } else {
                            expect(result.valid).toBe(false);
                            expect(result.error).toBeDefined();
                        }
                    }
                ),
                { numRuns: NUM_RUNS }
            );
        });
    });
});
