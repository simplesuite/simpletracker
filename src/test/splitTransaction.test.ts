import { describe, it, expect } from 'vitest';

// Replicates the split amount validation from AddTransaction handleSubmit
function validateSplitTotal(transactionAmount: number, splitArr: { transAmount: number | string }[]) {
    const splitTotal = splitArr.reduce((acc, obj) => acc + Number(obj.transAmount), 0);
    return Math.abs(Number(transactionAmount) - splitTotal) <= 0.01;
}

// Replicates the allocateRest logic from AddTransaction
function allocateRest(
    transactionAmount: number,
    splitArr: { recId: string; transAmount: number | string }[],
    targetRecId: string
) {
    const otherTotal = splitArr
        .filter(obj => obj.recId !== targetRecId)
        .reduce((acc, obj) => acc + Number(obj.transAmount), 0);
    const remaining = Math.round((Number(transactionAmount) - otherTotal) * 100) / 100;
    return remaining > 0 ? remaining : 0;
}

describe('split transaction validation', () => {
    it('passes when split amounts equal total', () => {
        expect(validateSplitTotal(100, [
            { transAmount: 60 },
            { transAmount: 40 },
        ])).toBe(true);
    });

    it('passes within penny tolerance', () => {
        expect(validateSplitTotal(100, [
            { transAmount: 33.33 },
            { transAmount: 33.33 },
            { transAmount: 33.34 },
        ])).toBe(true);
    });

    it('fails when amounts do not match', () => {
        expect(validateSplitTotal(100, [
            { transAmount: 50 },
            { transAmount: 30 },
        ])).toBe(false);
    });

    it('handles string amounts from text inputs', () => {
        expect(validateSplitTotal(100, [
            { transAmount: '60' as any },
            { transAmount: '40' as any },
        ])).toBe(true);
    });

    it('fails with empty splits', () => {
        expect(validateSplitTotal(100, [])).toBe(false);
    });
});

describe('allocateRest', () => {
    it('allocates remaining amount to target', () => {
        const splits = [
            { recId: 'a', transAmount: 30 },
            { recId: 'b', transAmount: 0 },
        ];
        expect(allocateRest(100, splits, 'b')).toBe(70);
    });

    it('returns 0 when others already exceed total', () => {
        const splits = [
            { recId: 'a', transAmount: 120 },
            { recId: 'b', transAmount: 0 },
        ];
        expect(allocateRest(100, splits, 'b')).toBe(0);
    });

    it('handles single split', () => {
        const splits = [{ recId: 'a', transAmount: 0 }];
        expect(allocateRest(75.50, splits, 'a')).toBe(75.50);
    });

    it('handles three-way split', () => {
        const splits = [
            { recId: 'a', transAmount: 25 },
            { recId: 'b', transAmount: 25 },
            { recId: 'c', transAmount: 0 },
        ];
        expect(allocateRest(100, splits, 'c')).toBe(50);
    });
});
