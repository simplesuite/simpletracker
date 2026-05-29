import { create } from "zustand";

interface ModalState {
    addSection: boolean;
    setAddSection: (val: boolean) => void;
    addCategory: boolean;
    setAddCategory: (val: boolean) => void;
    currentSection: string;
    setCurrentSection: (val: string) => void;
    currentCategory: string;
    setCurrentCategory: (val: string) => void;
    editCategory: boolean;
    setEditCategory: (val: boolean) => void;
    editTransaction: boolean;
    setEditTransaction: (val: boolean) => void;
    editSection: boolean;
    setEditSection: (val: boolean) => void;
    currentTransaction: string;
    setCurrentTransaction: (val: string) => void;
    addTransaction: boolean;
    setAddTransaction: (val: boolean) => void;
    selectBudget: boolean;
    setSelectBudget: (val: boolean) => void;
    copyBudget: boolean;
    setCopyBudget: (val: boolean) => void;
    addBudget: boolean;
    setAddBudget: (val: boolean) => void;
    shareBudget: boolean;
    setShareBudget: (val: boolean) => void;
    areYouSure: boolean;
    setAreYouSure: (val: boolean) => void;
    openViewCategory: boolean;
    setOpenViewCategory: (val: boolean) => void;
    openChangePassword: boolean;
    setOpenChangePassword: (val: boolean) => void;
    exportToCSV: boolean;
    setExportToCSV: (val: boolean) => void;
}

export const useModalStore = create<ModalState>((set) => ({
    addSection: false,
    setAddSection: (val) => set({ addSection: val }),
    addCategory: false,
    setAddCategory: (val) => set({ addCategory: val }),
    currentSection: '',
    setCurrentSection: (val) => set({ currentSection: val }),
    currentCategory: '',
    setCurrentCategory: (val) => set({ currentCategory: val }),
    editCategory: false,
    setEditCategory: (val) => set({ editCategory: val }),
    editTransaction: false,
    setEditTransaction: (val) => set({ editTransaction: val }),
    editSection: false,
    setEditSection: (val) => set({ editSection: val }),
    currentTransaction: '',
    setCurrentTransaction: (val) => set({ currentTransaction: val }),
    addTransaction: false,
    setAddTransaction: (val) => set({ addTransaction: val }),
    selectBudget: false,
    setSelectBudget: (val) => set({ selectBudget: val }),
    copyBudget: false,
    setCopyBudget: (val) => set({ copyBudget: val }),
    addBudget: false,
    setAddBudget: (val) => set({ addBudget: val }),
    shareBudget: false,
    setShareBudget: (val) => set({ shareBudget: val }),
    areYouSure: false,
    setAreYouSure: (val) => set({ areYouSure: val }),
    openViewCategory: false,
    setOpenViewCategory: (val) => set({ openViewCategory: val }),
    openChangePassword: false,
    setOpenChangePassword: (val) => set({ openChangePassword: val }),
    exportToCSV: false,
    setExportToCSV: (val) => set({ exportToCSV: val }),
}));
