import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import type { RouteProp } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useNoteStore, useProjectStore } from '@simpletracker/core';
import { Button, Card, Checkbox, Dialog, Pill, Snackbar, Text, TextField, getUiTheme } from '@simpletracker/ui';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { NotesStackParamList } from '../navigation/types';
import { ShareNoteDialog } from '../components/ShareNoteDialog';
import { useAuthStore } from '../store/authStore';
import { MarkdownPreview } from '../components/MarkdownPreview';
import { useThemeStore } from '../store/themeStore';

const collapseKey = (noteId: string) => `simpletracker.note.${noteId}.completedCollapsed`;

export function NoteDetailScreen() {
    const tabBarHeight = useBottomTabBarHeight();
    const { effectiveTheme } = useThemeStore();
    const theme = getUiTheme(effectiveTheme);
    const route = useRoute<RouteProp<NotesStackParamList, 'NoteDetail'>>();
    const navigation = useNavigation();
    const { id } = route.params;
    const userId = useAuthStore((state) => state.userId);
    const note = useNoteStore((state) => state.notes.find((item) => item.recordID === id) ?? state.archivedNotes.find((item) => item.recordID === id) ?? state.sharedNotes.find((item) => item.recordID === id));
    const updateNote = useNoteStore((state) => state.updateNote);
    const togglePinNote = useNoteStore((state) => state.togglePinNote);
    const archiveNote = useNoteStore((state) => state.archiveNote);
    const unarchiveNote = useNoteStore((state) => state.unarchiveNote);
    const deleteNote = useNoteStore((state) => state.deleteNote);
    const listItems = useNoteStore((state) => state.listItems[id]) ?? [];
    const addListItem = useNoteStore((state) => state.addListItem);
    const toggleListItem = useNoteStore((state) => state.toggleListItem);
    const updateListItemTitle = useNoteStore((state) => state.updateListItemTitle);
    const deleteListItem = useNoteStore((state) => state.deleteListItem);
    const reorderListItems = useNoteStore((state) => state.reorderListItems);
    const fetchListItems = useNoteStore((state) => state.fetchListItems);
    const projects = useProjectStore((state) => state.projects);

    const [title, setTitle] = useState(note?.title ?? '');
    const [body, setBody] = useState(note?.body ?? '');
    const [noteType, setNoteType] = useState<'text' | 'list'>(note?.noteType ?? 'text');
    const [pinned, setPinned] = useState(note?.pinned ?? false);
    const [archived, setArchived] = useState(note?.archived ?? false);
    const [projectID, setProjectID] = useState<string | ''>(note?.projectID ?? '');
    const [listItemInput, setListItemInput] = useState('');
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [shareDialogOpen, setShareDialogOpen] = useState(false);
    const [projectDialogOpen, setProjectDialogOpen] = useState(false);
    const [deleteCompletedDialogOpen, setDeleteCompletedDialogOpen] = useState(false);
    const [deletingCompleted, setDeletingCompleted] = useState(false);
    const [completedCollapsed, setCompletedCollapsed] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');

    const titleRef = useRef(title);
    const bodyRef = useRef(body);
    const projectIDRef = useRef(projectID);
    titleRef.current = title;
    bodyRef.current = body;
    projectIDRef.current = projectID;

    useEffect(() => {
        if (!note) return;
        setTitle(note.title);
        setBody(note.body);
        setNoteType(note.noteType);
        setPinned(note.pinned);
        setArchived(note.archived);
        setProjectID(note.projectID ?? '');
    }, [note?.recordID]);

    useEffect(() => {
        let mounted = true;
        AsyncStorage.getItem(collapseKey(id)).then((value) => {
            if (mounted) setCompletedCollapsed(value === 'true');
        });
        return () => { mounted = false; };
    }, [id]);

    useEffect(() => {
        void AsyncStorage.setItem(collapseKey(id), String(completedCollapsed));
    }, [id, completedCollapsed]);

    useEffect(() => {
        const timer = setTimeout(async () => {
            if (id && note) await updateNote(id, { title: titleRef.current, body: bodyRef.current, projectID: projectIDRef.current || null });
        }, 1000);
        return () => clearTimeout(timer);
    }, [title, body, projectID, id, note, updateNote]);

    useEffect(() => {
        if (id && noteType === 'list') void fetchListItems(id);
    }, [id, noteType, fetchListItems]);

    const sortedItems = useMemo(() => [...listItems].sort((a, b) => a.indexOrder - b.indexOrder), [listItems]);
    const activeItems = sortedItems.filter((item) => !item.isCompleted);
    const completedItems = sortedItems.filter((item) => item.isCompleted);
    const isCreator = note?.creatorID === userId;
    const iconColor = theme.secondary;

    const handleTogglePin = async () => {
        if (!id) return;
        const success = await togglePinNote(id);
        if (success) setPinned((value) => !value);
        else setStatusMessage(useNoteStore.getState().error ?? 'Unable to update pin status.');
    };

    const handleArchive = async () => {
        if (!id) return;
        const success = archived ? await unarchiveNote(id) : await archiveNote(id);
        if (success) setArchived((value) => !value);
        else setStatusMessage(useNoteStore.getState().error ?? 'Unable to update archive status.');
    };

    const handleToggleNoteType = async () => {
        if (!id) return;
        const newType: 'text' | 'list' = noteType === 'text' ? 'list' : 'text';
        if (newType === 'list') {
            for (const line of body.split('\n').filter((line) => line.trim().length > 0)) await addListItem(id, line.trim().slice(0, 255));
            const success = await updateNote(id, { noteType: newType, body: '' });
            if (!success) return setStatusMessage(useNoteStore.getState().error ?? 'Unable to change note type.');
            setBody('');
            setNoteType(newType);
        } else {
            const combinedBody = sortedItems.map((item) => item.title).join('\n');
            const success = await updateNote(id, { noteType: newType, body: combinedBody });
            if (!success) return setStatusMessage(useNoteStore.getState().error ?? 'Unable to change note type.');
            setNoteType(newType);
            setBody(combinedBody);
            for (const item of sortedItems) await deleteListItem(item.recordID);
        }
    };

    const handleAddListItem = async () => {
        if (!listItemInput.trim() || !id) return;
        const result = await addListItem(id, listItemInput.trim());
        if (result) setListItemInput('');
        else setStatusMessage(useNoteStore.getState().error ?? 'Unable to add checklist item.');
    };

    const moveItem = async (itemID: string, direction: -1 | 1) => {
        const index = activeItems.findIndex((item) => item.recordID === itemID);
        const target = index + direction;
        if (index < 0 || target < 0 || target >= activeItems.length) return;
        const reorderedActive = [...activeItems];
        [reorderedActive[index], reorderedActive[target]] = [reorderedActive[target], reorderedActive[index]];
        const success = await reorderListItems(id, [...reorderedActive, ...completedItems]);
        if (!success) setStatusMessage(useNoteStore.getState().error ?? 'Unable to reorder checklist.');
    };

    const handleDeleteAllCompleted = async () => {
        setDeleteCompletedDialogOpen(false);
        setDeletingCompleted(true);
        let failed = 0;
        for (const item of completedItems) if (!(await deleteListItem(item.recordID))) failed += 1;
        setDeletingCompleted(false);
        if (failed > 0) setStatusMessage(`Unable to delete ${failed} completed item${failed === 1 ? '' : 's'}.`);
    };

    const handleProjectChange = async (value: string | null) => {
        const next = value ?? '';
        setProjectID(next);
        setProjectDialogOpen(false);
        const success = await updateNote(id, { projectID: next || null });
        if (!success) {
            setProjectID(note?.projectID ?? '');
            setStatusMessage(useNoteStore.getState().error ?? 'Unable to update project.');
        }
    };

    const handleDeleteNote = async () => {
        setDeleteDialogOpen(false);
        if (!id) return;
        const success = await deleteNote(id);
        if (success) navigation.goBack();
        else setStatusMessage(useNoteStore.getState().error ?? 'Unable to delete note.');
    };

    const isNoteBlank = () => title.trim().length === 0 && body.trim().length === 0 && listItems.length === 0;

    return (
        <View className="flex-1" style={{ backgroundColor: theme.background }}>
            <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: tabBarHeight + 24, gap: 12 }} keyboardShouldPersistTaps="handled">
                <Card className="rounded-3xl p-2"><TextField placeholder="Title" value={title} onChangeText={setTitle} inputClassName="text-2xl font-semibold" className="border-0" /><View className="flex-row flex-wrap gap-2 px-2 pb-2 pt-2"><Pill compact icon={<MaterialCommunityIcons name={noteType === 'list' ? 'format-list-checks' : 'note-text-outline'} size={15} color={iconColor} />}>{noteType === 'list' ? 'Checklist' : 'Text note'}</Pill>{archived ? <Pill compact icon={<MaterialCommunityIcons name="archive" size={15} color={iconColor} />}>Archived</Pill> : null}{pinned ? <Pill compact icon={<MaterialCommunityIcons name="pin" size={15} color={iconColor} />}>Pinned</Pill> : null}</View></Card>

                <Card className="p-4"><View className="mb-3 flex-row items-center justify-between gap-3"><View className="min-w-0 flex-1"><Text variant="title">Note type</Text><Text variant="bodySmall">Choose how this note is organized</Text></View><Pill compact disabled={archived} icon={<MaterialCommunityIcons name="swap-horizontal" size={15} color={theme.onSurfaceVariant} />}>{noteType === 'list' ? 'Checklist' : 'Text'}</Pill></View><View className="flex-row flex-wrap gap-2"><Pill icon={<MaterialCommunityIcons name="note-text-outline" size={17} color={noteType === 'text' ? theme.onPrimary : iconColor} />} selected={noteType === 'text'} onPress={handleToggleNoteType} disabled={archived || noteType === 'text'} className="flex-1">Text</Pill><Pill icon={<MaterialCommunityIcons name="format-list-checks" size={17} color={noteType === 'list' ? theme.onPrimary : iconColor} />} selected={noteType === 'list'} onPress={handleToggleNoteType} disabled={archived || noteType === 'list'} className="flex-1">Checklist</Pill></View></Card>

                {noteType === 'text' ? <Card className="p-4"><View className="mb-3 flex-row items-center justify-between gap-3"><Text variant="title">Content</Text><Button variant="text" compact icon={<MaterialCommunityIcons name={showPreview ? 'pencil-outline' : 'eye-outline'} size={17} color={iconColor} />} onPress={() => setShowPreview((value) => !value)}>{showPreview ? 'Edit' : 'Preview'}</Button></View>{showPreview ? <MarkdownPreview content={body} /> : <TextField placeholder="Write something…" value={body} onChangeText={setBody} multiline inputClassName="min-h-56" />}</Card> : <Card className="p-4"><View className="mb-3 flex-row items-center justify-between"><View><Text variant="title">Checklist</Text><Text variant="bodySmall">{completedItems.length} of {sortedItems.length} complete</Text></View>{completedItems.length > 0 ? <Button variant="text" compact onPress={() => setCompletedCollapsed((value) => !value)}>{completedCollapsed ? 'Show completed' : 'Hide completed'}</Button> : null}</View>{activeItems.length === 0 && completedItems.length === 0 ? <Text variant="bodySmall" className="py-2">Add your first item below.</Text> : null}{activeItems.map((item, index) => <View key={item.recordID} className="flex-row items-center border-t border-outline-variant py-1 dark:border-outline-variant-dark"><Checkbox status="unchecked" onPress={() => toggleListItem(item.recordID)} accessibilityLabel={`Toggle ${item.title}`} /><TextField value={item.title} onChangeText={(text) => updateListItemTitle(item.recordID, text)} className="min-w-0 flex-1 border-0" /><Button variant="text" compact accessibilityLabel="Move checklist item up" onPress={() => moveItem(item.recordID, -1)} disabled={index === 0}><MaterialCommunityIcons name="chevron-up" size={20} color={theme.onSurfaceVariant} /></Button><Button variant="text" compact accessibilityLabel="Move checklist item down" onPress={() => moveItem(item.recordID, 1)} disabled={index === activeItems.length - 1}><MaterialCommunityIcons name="chevron-down" size={20} color={theme.onSurfaceVariant} /></Button><Button variant="text" compact icon={<MaterialCommunityIcons name="delete-outline" size={19} color={theme.onSurfaceVariant} />} accessibilityLabel="Delete checklist item" onPress={() => deleteListItem(item.recordID)} /></View>)}{!completedCollapsed && completedItems.length > 0 ? <View className="mt-2 border-t border-outline-variant pt-1 dark:border-outline-variant-dark">{completedItems.map((item) => <View key={item.recordID} className="flex-row items-center"><Checkbox status="checked" onPress={() => toggleListItem(item.recordID)} accessibilityLabel={`Toggle ${item.title}`} /><TextField value={item.title} onChangeText={(text) => updateListItemTitle(item.recordID, text)} inputClassName="line-through text-on-surface-variant" className="min-w-0 flex-1 border-0" /><Button variant="text" compact icon={<MaterialCommunityIcons name="delete-outline" size={19} color={theme.onSurfaceVariant} />} accessibilityLabel="Delete completed checklist item" onPress={() => deleteListItem(item.recordID)} /></View>)}<Button variant="danger" compact className="mt-2 self-start" onPress={() => setDeleteCompletedDialogOpen(true)}>Delete all completed</Button></View> : null}<View className="mt-3 flex-row items-center gap-2"><TextField placeholder="Add an item" value={listItemInput} onChangeText={setListItemInput} className="min-w-0 flex-1" /><Button compact onPress={handleAddListItem} disabled={!listItemInput.trim()}>Add</Button></View></Card>}

                <View className="gap-2 px-1"><View className="flex-row items-center justify-between"><Text variant="label">Project</Text><Button variant="text" compact onPress={() => setProjectDialogOpen(true)}>{projectID ? 'Change' : 'Assign'}</Button></View>{projectID ? <Pill icon={<MaterialCommunityIcons name="folder-outline" size={17} color={iconColor} />} onClose={() => handleProjectChange(null)}>{projects.find((project) => project.recordID === projectID)?.name || 'Unknown Project'}</Pill> : <Text variant="bodySmall">No project assigned</Text>}</View>

                <Card className="flex-row flex-wrap items-center justify-between gap-1 p-2"><Button variant="text" compact icon={<MaterialCommunityIcons name={pinned ? 'pin' : 'pin-outline'} size={17} color={iconColor} />} onPress={handleTogglePin}>{pinned ? 'Pinned' : 'Pin'}</Button><Button variant="text" compact icon={<MaterialCommunityIcons name={archived ? 'archive' : 'archive-outline'} size={17} color={iconColor} />} onPress={handleArchive}>{archived ? 'Unarchive' : 'Archive'}</Button>{isCreator ? <Button variant="text" compact icon={<MaterialCommunityIcons name="share-variant-outline" size={17} color={iconColor} />} onPress={() => setShareDialogOpen(true)}>Share</Button> : null}<Button variant="danger" compact icon={<MaterialCommunityIcons name="delete-outline" size={17} color={theme.error} />} onPress={() => setDeleteDialogOpen(true)}>Delete</Button></Card>
            </ScrollView>

            <Dialog visible={projectDialogOpen} onDismiss={() => setProjectDialogOpen(false)} title="Assign project" actions={<Button variant="text" compact onPress={() => setProjectDialogOpen(false)}>Done</Button>}><ScrollView className="max-h-80"><Button variant={projectID === '' ? 'tonal' : 'outlined'} compact className="mb-2 justify-start" onPress={() => handleProjectChange(null)}>No project</Button>{projects.map((project) => <Button key={project.recordID} variant={project.recordID === projectID ? 'tonal' : 'outlined'} compact className="mb-2 justify-start" onPress={() => handleProjectChange(project.recordID)}>{project.name || '(untitled project)'}</Button>)}</ScrollView></Dialog>
            <Dialog visible={deleteDialogOpen} onDismiss={() => setDeleteDialogOpen(false)} title="Delete note" actions={<><Button variant="text" compact onPress={() => setDeleteDialogOpen(false)}>Cancel</Button><Button variant="danger" compact onPress={handleDeleteNote}>Delete</Button></>}><Text>{isNoteBlank() ? 'This note is empty. Are you sure you want to delete it?' : 'Are you sure you want to delete this note?'}</Text></Dialog>
            <Dialog visible={deleteCompletedDialogOpen} onDismiss={() => setDeleteCompletedDialogOpen(false)} title="Delete completed items" actions={<><Button variant="text" compact onPress={() => setDeleteCompletedDialogOpen(false)}>Cancel</Button><Button variant="danger" compact loading={deletingCompleted} onPress={handleDeleteAllCompleted}>Delete all</Button></>}><Text>Delete {completedItems.length} completed checklist item{completedItems.length === 1 ? '' : 's'}? This cannot be undone.</Text></Dialog>
            {id && isCreator ? <ShareNoteDialog visible={shareDialogOpen} noteId={id} onClose={() => setShareDialogOpen(false)} /> : null}
            <Snackbar visible={!!statusMessage} onDismiss={() => setStatusMessage('')} onAction={() => setStatusMessage('')} bottomOffset={tabBarHeight + 24}>{statusMessage}</Snackbar>
        </View>
    );
}
