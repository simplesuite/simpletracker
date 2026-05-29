import { describe, it, expect, beforeEach } from 'vitest';
import { useGlobalStore } from '../store/globalStore';
import { useModalStore } from '../store/modalStore';
import { useTableStore } from '../store/tableStore';

describe('globalStore', () => {
    beforeEach(() => {
        useGlobalStore.setState({
            snackBarText: 'message',
            snackBarSeverity: 'success',
            snackBarOpen: false,
            mainLoading: false,
            areYouSureAccept: false,
            addTransactionCategory: null,
            addTransactionType: 'expense',
        });
    });

    it('sets and gets snackbar state', () => {
        const { setSnackBarText, setSnackBarSeverity, setSnackBarOpen } = useGlobalStore.getState();
        setSnackBarText('hello');
        setSnackBarSeverity('error');
        setSnackBarOpen(true);
        const state = useGlobalStore.getState();
        expect(state.snackBarText).toBe('hello');
        expect(state.snackBarSeverity).toBe('error');
        expect(state.snackBarOpen).toBe(true);
    });

    it('sets mainLoading', () => {
        useGlobalStore.getState().setMainLoading(true);
        expect(useGlobalStore.getState().mainLoading).toBe(true);
    });

    it('sets areYouSure fields', () => {
        const s = useGlobalStore.getState();
        s.setAreYouSureTitle('Delete?');
        s.setAreYouSureDetails('This is permanent');
        s.setAreYouSureAccept(true);
        const state = useGlobalStore.getState();
        expect(state.areYouSureTitle).toBe('Delete?');
        expect(state.areYouSureDetails).toBe('This is permanent');
        expect(state.areYouSureAccept).toBe(true);
    });

    it('defaults addTransactionType to expense', () => {
        expect(useGlobalStore.getState().addTransactionType).toBe('expense');
    });
});

describe('modalStore', () => {
    beforeEach(() => {
        useModalStore.setState({
            addSection: false,
            addCategory: false,
            editCategory: false,
            editTransaction: false,
            addTransaction: false,
            selectBudget: false,
            areYouSure: false,
            currentSection: '',
            currentCategory: '',
            currentTransaction: '',
        });
    });

    it('toggles modal booleans', () => {
        const s = useModalStore.getState();
        s.setAddTransaction(true);
        s.setEditCategory(true);
        s.setAreYouSure(true);
        const state = useModalStore.getState();
        expect(state.addTransaction).toBe(true);
        expect(state.editCategory).toBe(true);
        expect(state.areYouSure).toBe(true);
    });

    it('sets current IDs', () => {
        const s = useModalStore.getState();
        s.setCurrentSection('sec-1');
        s.setCurrentCategory('cat-1');
        s.setCurrentTransaction('trans-1');
        const state = useModalStore.getState();
        expect(state.currentSection).toBe('sec-1');
        expect(state.currentCategory).toBe('cat-1');
        expect(state.currentTransaction).toBe('trans-1');
    });
});

describe('tableStore', () => {
    beforeEach(() => {
        useTableStore.setState({
            budgets: [],
            sections: [],
            categories: [],
            transactions: [],
        });
    });

    it('sets arrays directly', () => {
        useTableStore.getState().setBudgets([{ recordID: 'b1', creatorID: 'u1', budgetName: 'Test' }]);
        expect(useTableStore.getState().budgets).toHaveLength(1);
        expect(useTableStore.getState().budgets[0].budgetName).toBe('Test');
    });

    it('supports functional updates for arrays', () => {
        useTableStore.getState().setCategories([{ recordID: 'c1', sectionID: 's1', categoryName: 'Food', amount: 100 }]);
        useTableStore.getState().setCategories((prev) => [...prev, { recordID: 'c2', sectionID: 's1', categoryName: 'Gas', amount: 50 }]);
        expect(useTableStore.getState().categories).toHaveLength(2);
        expect(useTableStore.getState().categories[1].categoryName).toBe('Gas');
    });

    it('sets currentBudgetAndMonth', () => {
        useTableStore.getState().setCurrentBudgetAndMonth({ budgetID: 'b1', year: 2026, month: 'April' });
        const state = useTableStore.getState();
        expect(state.currentBudgetAndMonth.budgetID).toBe('b1');
        expect(state.currentBudgetAndMonth.year).toBe(2026);
        expect(state.currentBudgetAndMonth.month).toBe('April');
    });
});
