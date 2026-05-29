import { describe, it, expect } from 'vitest';

// Replicates the allocateRestClick logic from EditCategory
function allocateRestOfBudget(
    categories: { recordID: string; sectionID: string; amount: number }[],
    sections: { recordID: string; sectionType: string }[],
    currentCategoryID: string,
    currentSectionType: string
) {
    const totalIncome = categories
        .filter(c => sections.find(s => s.recordID === c.sectionID)?.sectionType === 'income')
        .reduce((acc, c) => acc + Number(c.amount), 0);

    let remaining: number;
    if (currentSectionType === 'income') {
        const otherIncome = categories
            .filter(c => sections.find(s => s.recordID === c.sectionID)?.sectionType === 'income')
            .filter(c => c.recordID !== currentCategoryID)
            .reduce((acc, c) => acc + Number(c.amount), 0);
        remaining = totalIncome - otherIncome;
    } else {
        const totalExpense = categories
            .filter(c => sections.find(s => s.recordID === c.sectionID)?.sectionType === 'expense')
            .filter(c => c.recordID !== currentCategoryID)
            .reduce((acc, c) => acc + Number(c.amount), 0);
        remaining = totalIncome - totalExpense;
    }
    return Math.round(Math.max(remaining, 0) * 100) / 100;
}

describe('allocateRestOfBudget', () => {
    const sections = [
        { recordID: 's-inc', sectionType: 'income' },
        { recordID: 's-exp', sectionType: 'expense' },
    ];

    it('allocates remaining income to an expense category', () => {
        const categories = [
            { recordID: 'c1', sectionID: 's-inc', amount: 3000 },
            { recordID: 'c2', sectionID: 's-exp', amount: 1000 },
            { recordID: 'c3', sectionID: 's-exp', amount: 500 },
            { recordID: 'c4', sectionID: 's-exp', amount: 0 }, // target
        ];
        // income=3000, other expenses=1000+500=1500, remaining=1500
        expect(allocateRestOfBudget(categories, sections, 'c4', 'expense')).toBe(1500);
    });

    it('returns 0 when expenses already exceed income', () => {
        const categories = [
            { recordID: 'c1', sectionID: 's-inc', amount: 1000 },
            { recordID: 'c2', sectionID: 's-exp', amount: 800 },
            { recordID: 'c3', sectionID: 's-exp', amount: 500 },
            { recordID: 'c4', sectionID: 's-exp', amount: 0 },
        ];
        // income=1000, other expenses=800+500=1300, remaining=-300 → 0
        expect(allocateRestOfBudget(categories, sections, 'c4', 'expense')).toBe(0);
    });

    it('handles income category allocation', () => {
        const categories = [
            { recordID: 'c1', sectionID: 's-inc', amount: 2000 },
            { recordID: 'c2', sectionID: 's-inc', amount: 0 }, // target
        ];
        // totalIncome=2000, otherIncome=2000 (c1), remaining=2000-2000=0
        // Wait — totalIncome includes c2 (amount 0), so totalIncome=2000+0=2000
        // otherIncome = c1 = 2000, remaining = 2000 - 2000 = 0
        expect(allocateRestOfBudget(categories, sections, 'c2', 'income')).toBe(0);
    });

    it('works with single expense category', () => {
        const categories = [
            { recordID: 'c1', sectionID: 's-inc', amount: 5000 },
            { recordID: 'c2', sectionID: 's-exp', amount: 0 },
        ];
        expect(allocateRestOfBudget(categories, sections, 'c2', 'expense')).toBe(5000);
    });

    it('handles floating point amounts', () => {
        const categories = [
            { recordID: 'c1', sectionID: 's-inc', amount: 1000.50 },
            { recordID: 'c2', sectionID: 's-exp', amount: 333.17 },
            { recordID: 'c3', sectionID: 's-exp', amount: 0 },
        ];
        expect(allocateRestOfBudget(categories, sections, 'c3', 'expense')).toBe(667.33);
    });
});
