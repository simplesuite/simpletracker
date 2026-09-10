import { describe, it, expect, beforeEach } from 'vitest';
import { useGlobalStore } from '../store/globalStore';
import { useModalStore } from '../store/modalStore';

describe('globalStore', () => {
    beforeEach(() => {
        useGlobalStore.setState({
            snackBarText: 'message',
            snackBarSeverity: 'success',
            snackBarOpen: false,
            mainLoading: false,
            areYouSureAccept: false,
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
});

describe('modalStore', () => {
    beforeEach(() => {
        useModalStore.setState({
            confirmDelete: { open: false, entityType: '', entityId: '', onConfirm: () => { } },
            shareNote: { open: false, noteID: '' },
            shareProject: { open: false, projectID: '' },
            shareTask: { open: false, taskID: '' },
            openChangePassword: false,
        });
    });

    it('opens and closes confirmDelete modal', () => {
        const onConfirm = () => { };
        useModalStore.getState().openConfirmDelete('note', 'note-123', onConfirm);
        const state = useModalStore.getState();
        expect(state.confirmDelete.open).toBe(true);
        expect(state.confirmDelete.entityType).toBe('note');
        expect(state.confirmDelete.entityId).toBe('note-123');
        expect(state.confirmDelete.onConfirm).toBe(onConfirm);

        useModalStore.getState().closeConfirmDelete();
        const closed = useModalStore.getState();
        expect(closed.confirmDelete.open).toBe(false);
        expect(closed.confirmDelete.entityType).toBe('');
        expect(closed.confirmDelete.entityId).toBe('');
    });

    it('opens and closes shareNote modal', () => {
        useModalStore.getState().openShareNote('note-456');
        const state = useModalStore.getState();
        expect(state.shareNote.open).toBe(true);
        expect(state.shareNote.noteID).toBe('note-456');

        useModalStore.getState().closeShareNote();
        const closed = useModalStore.getState();
        expect(closed.shareNote.open).toBe(false);
        expect(closed.shareNote.noteID).toBe('');
    });

    it('opens and closes shareProject modal', () => {
        useModalStore.getState().openShareProject('proj-789');
        const state = useModalStore.getState();
        expect(state.shareProject.open).toBe(true);
        expect(state.shareProject.projectID).toBe('proj-789');

        useModalStore.getState().closeShareProject();
        const closed = useModalStore.getState();
        expect(closed.shareProject.open).toBe(false);
        expect(closed.shareProject.projectID).toBe('');
    });

    it('opens and closes shareTask modal', () => {
        useModalStore.getState().openShareTask('task-101');
        const state = useModalStore.getState();
        expect(state.shareTask.open).toBe(true);
        expect(state.shareTask.taskID).toBe('task-101');

        useModalStore.getState().closeShareTask();
        const closed = useModalStore.getState();
        expect(closed.shareTask.open).toBe(false);
        expect(closed.shareTask.taskID).toBe('');
    });

    it('toggles openChangePassword', () => {
        useModalStore.getState().setOpenChangePassword(true);
        expect(useModalStore.getState().openChangePassword).toBe(true);
        useModalStore.getState().setOpenChangePassword(false);
        expect(useModalStore.getState().openChangePassword).toBe(false);
    });
});


