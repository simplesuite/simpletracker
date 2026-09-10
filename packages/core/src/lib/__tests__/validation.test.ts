import { describe, it, expect } from 'vitest';
import {
    validateNoteTitle,
    validateTaskTitle,
    validateSubtaskTitle,
    validateProjectName,
    validateNoteBody,
} from '../validation';

describe('validateNoteTitle', () => {
    it('accepts an empty title', () => {
        expect(validateNoteTitle('')).toEqual({ valid: true });
    });

    it('accepts a title within 255 characters', () => {
        expect(validateNoteTitle('My Note')).toEqual({ valid: true });
    });

    it('accepts a title at exactly 255 characters', () => {
        const title = 'a'.repeat(255);
        expect(validateNoteTitle(title)).toEqual({ valid: true });
    });

    it('rejects a title exceeding 255 characters', () => {
        const title = 'a'.repeat(256);
        const result = validateNoteTitle(title);
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
    });

    it('validates based on trimmed length', () => {
        const title = ' '.repeat(300);
        expect(validateNoteTitle(title)).toEqual({ valid: true });
    });
});

describe('validateTaskTitle', () => {
    it('rejects an empty title', () => {
        const result = validateTaskTitle('');
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
    });

    it('rejects a whitespace-only title', () => {
        const result = validateTaskTitle('   ');
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
    });

    it('accepts a valid title', () => {
        expect(validateTaskTitle('Buy groceries')).toEqual({ valid: true });
    });

    it('accepts a title at exactly 255 characters', () => {
        const title = 'a'.repeat(255);
        expect(validateTaskTitle(title)).toEqual({ valid: true });
    });

    it('rejects a title exceeding 255 characters', () => {
        const title = 'a'.repeat(256);
        const result = validateTaskTitle(title);
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
    });
});

describe('validateSubtaskTitle', () => {
    it('rejects an empty title', () => {
        const result = validateSubtaskTitle('');
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
    });

    it('rejects a whitespace-only title', () => {
        const result = validateSubtaskTitle('   ');
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
    });

    it('accepts a valid title', () => {
        expect(validateSubtaskTitle('Step 1')).toEqual({ valid: true });
    });

    it('accepts a title at exactly 255 characters', () => {
        const title = 'a'.repeat(255);
        expect(validateSubtaskTitle(title)).toEqual({ valid: true });
    });

    it('rejects a title exceeding 255 characters', () => {
        const title = 'a'.repeat(256);
        const result = validateSubtaskTitle(title);
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
    });
});

describe('validateProjectName', () => {
    it('rejects an empty name', () => {
        const result = validateProjectName('');
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
    });

    it('rejects a whitespace-only name', () => {
        const result = validateProjectName('   ');
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
    });

    it('accepts a valid name', () => {
        expect(validateProjectName('My Project')).toEqual({ valid: true });
    });

    it('accepts a name at exactly 100 characters', () => {
        const name = 'a'.repeat(100);
        expect(validateProjectName(name)).toEqual({ valid: true });
    });

    it('rejects a name exceeding 100 characters', () => {
        const name = 'a'.repeat(101);
        const result = validateProjectName(name);
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
    });
});

describe('validateNoteBody', () => {
    it('accepts an empty body', () => {
        expect(validateNoteBody('')).toEqual({ valid: true });
    });

    it('accepts a body within 100,000 characters', () => {
        expect(validateNoteBody('Hello world')).toEqual({ valid: true });
    });

    it('accepts a body at exactly 100,000 characters', () => {
        const body = 'a'.repeat(100000);
        expect(validateNoteBody(body)).toEqual({ valid: true });
    });

    it('rejects a body exceeding 100,000 characters', () => {
        const body = 'a'.repeat(100001);
        const result = validateNoteBody(body);
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
    });

    it('validates based on trimmed length', () => {
        const body = ' '.repeat(200000);
        expect(validateNoteBody(body)).toEqual({ valid: true });
    });
});
