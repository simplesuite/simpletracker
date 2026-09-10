import { create } from "zustand";

interface ConfirmDeleteState {
    open: boolean;
    entityType: string;
    entityId: string;
    onConfirm: () => void;
}

interface ShareNoteState {
    open: boolean;
    noteID: string;
}

interface ShareProjectState {
    open: boolean;
    projectID: string;
}

interface ShareTaskState {
    open: boolean;
    taskID: string;
}

interface ModalState {
    confirmDelete: ConfirmDeleteState;
    openConfirmDelete: (entityType: string, entityId: string, onConfirm: () => void) => void;
    closeConfirmDelete: () => void;

    shareNote: ShareNoteState;
    openShareNote: (noteID: string) => void;
    closeShareNote: () => void;

    shareProject: ShareProjectState;
    openShareProject: (projectID: string) => void;
    closeShareProject: () => void;

    shareTask: ShareTaskState;
    openShareTask: (taskID: string) => void;
    closeShareTask: () => void;

    areYouSure: boolean;
    setAreYouSure: (val: boolean) => void;

    openChangePassword: boolean;
    setOpenChangePassword: (val: boolean) => void;
}

export const useModalStore = create<ModalState>((set) => ({
    confirmDelete: { open: false, entityType: '', entityId: '', onConfirm: () => { } },
    openConfirmDelete: (entityType, entityId, onConfirm) =>
        set({ confirmDelete: { open: true, entityType, entityId, onConfirm } }),
    closeConfirmDelete: () =>
        set({ confirmDelete: { open: false, entityType: '', entityId: '', onConfirm: () => { } } }),

    shareNote: { open: false, noteID: '' },
    openShareNote: (noteID) => set({ shareNote: { open: true, noteID } }),
    closeShareNote: () => set({ shareNote: { open: false, noteID: '' } }),

    shareProject: { open: false, projectID: '' },
    openShareProject: (projectID) => set({ shareProject: { open: true, projectID } }),
    closeShareProject: () => set({ shareProject: { open: false, projectID: '' } }),

    shareTask: { open: false, taskID: '' },
    openShareTask: (taskID) => set({ shareTask: { open: true, taskID } }),
    closeShareTask: () => set({ shareTask: { open: false, taskID: '' } }),

    areYouSure: false,
    setAreYouSure: (val) => set({ areYouSure: val }),

    openChangePassword: false,
    setOpenChangePassword: (val) => set({ openChangePassword: val }),
}));
