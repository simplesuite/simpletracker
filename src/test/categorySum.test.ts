import { describe, it, expect, beforeEach } from 'vitest';
import { useTableStore } from '../store/tableStore';

// Replicates the grabCategorySum logic from GlobalJS.tsx
function grabCategorySum(transactions: any[], catID: string) {
    let expenses = transactions
        .filter(x => x.categoryID === catID && x.transactionType === "expense")
        .reduce((acc, obj) => acc + obj.amount, 0);
    let incomes = transactions
        .filter(x => x.categoryID === catID && x.transactionType === "income")
        .reduce((acc, obj) => acc + obj.amount, 0);
    return Math.round((incomes - expenses + Number.EPSILON) * 100) / 100;
}

describe('grabCategorySum', () => {
    it('returns 0 for no transactions', () => {
        expect(grabCategorySum([], 'cat-1')).toBe(0);
    });

    it('sums expenses as negative', () => {
        const transactions = [
            { categoryID: 'cat-1', transactionType: 'expense', amount: 50 },
            { categoryID: 'cat-1', transactionType: 'expense', amount: 25.50 },
        ];
        expect(grabCategorySum(transactions, 'cat-1')).toBe(-75.50);
    });

    it('sums incomes as positive', () => {
        const transactions = [
            { categoryID: 'cat-1', transactionType: 'income', amount: 100 },
            { categoryID: 'cat-1', transactionType: 'income', amount: 200 },
        ];
        expect(grabCategorySum(transactions, 'cat-1')).toBe(300);
    });

    it('nets income minus expenses', () => {
        const transactions = [
            { categoryID: 'cat-1', transactionType: 'income', amount: 100 },
            { categoryID: 'cat-1', transactionType: 'expense', amount: 40 },
            { categoryID: 'cat-1', transactionType: 'expense', amount: 30 },
        ];
        expect(grabCategorySum(transactions, 'cat-1')).toBe(30);
    });

    it('ignores transactions from other categories', () => {
        const transactions = [
            { categoryID: 'cat-1', transactionType: 'expense', amount: 50 },
            { categoryID: 'cat-2', transactionType: 'expense', amount: 999 },
        ];
        expect(grabCategorySum(transactions, 'cat-1')).toBe(-50);
    });

    it('handles floating point correctly', () => {
        const transactions = [
            { categoryID: 'cat-1', transactionType: 'expense', amount: 0.1 },
            { categoryID: 'cat-1', transactionType: 'expense', amount: 0.2 },
        ];
        // 0.1 + 0.2 = 0.30000000000000004 in JS, should round to -0.3
        expect(grabCategorySum(transactions, 'cat-1')).toBe(-0.3);
    });
});
