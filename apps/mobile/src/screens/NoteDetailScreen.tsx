import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import type { GestureResponderEvent } from 'react-native';
import type { RouteProp } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useNoteStore, useProjectStore } from '@simpletracker/core';
import { Button, Card, Checkbox, Dialog, Pill, Snackbar, Text, TextField, getUiTheme } from '@simpletracker/ui';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { NotesStackParamList } from '../navigation/types';
import { ShareNoteDialog } from '../components/ShareNoteDialog';
import { useAuthStore } from '../store/authStore';
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
    const [menuOpen, setMenuOpen] = useState(false);
    const [deleteCompletedDialogOpen, setDeleteCompletedDialogOpen] = useState(false);
    const [deletingCompleted, setDeletingCompleted] = useState(false);
    const [completedCollapsed, setCompletedCollapsed] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');

    const titleRef = useRef(title);
    const bodyRef = useRef(body);
    const projectIDRef = useRef(projectID);
    const handlingBackRef = useRef(false);
    const rowLayouts = useRef<Record<string, { y: number; height: number }>>({});
    const dragStartYRef = useRef(0);
    const dragTranslationRef = useRef(0);
    const activeDragItemRef = useRef<string | null>(null);
    const [draggedItemID, setDraggedItemID] = useState<string | null>(null);
    const [dragTranslationY, setDragTranslationY] = useState(0);
    titleRef.current = title;
    bodyRef.current = body;
    projectIDRef.current = projectID;
    useLayoutEffect(() => {
        navigation.setOptions({
            headerRight: () => (
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="More note options"
                    hitSlop={10}
                    onPress={() => setMenuOpen(true)}
                    className="rounded-xl p-2 active:opacity-70"
                >
                    <MaterialCommunityIcons name="dots-vertical" size={24} color={theme.onSurface} />
                </Pressable>
            ),
        });

        return () => navigation.setOptions({ headerRight: undefined });
    }, [navigation, theme.onSurface]);

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
        const unsubscribe = navigation.addListener('beforeRemove', (event) => {
            if (!note || handlingBackRef.current) return;

            event.preventDefault();
            handlingBackRef.current = true;
            void (async () => {
                const blank = titleRef.current.trim().length === 0
                    && bodyRef.current.trim().length === 0
                    && (noteType !== 'list' || listItems.length === 0);
                const success = blank
                    ? await deleteNote(id)
                    : await updateNote(id, { title: titleRef.current, body: bodyRef.current, projectID: projectIDRef.current || null });
                if (success) navigation.dispatch(event.data.action);
                else {
                    handlingBackRef.current = false;
                    setStatusMessage(useNoteStore.getState().error ?? 'Unable to save note.');
                }
            })();
        });
        return unsubscribe;
    }, [navigation, note, id, noteType, listItems.length, deleteNote, updateNote]);

    useEffect(() => {
        if (id && noteType === 'list') void fetchListItems(id);
    }, [id, noteType, fetchListItems]);

    const sortedItems = useMemo(() => [...listItems].sort((a, b) => a.indexOrder - b.indexOrder), [listItems]);
    const activeItems = sortedItems.filter((item) => !item.isCompleted);
    const completedItems = sortedItems.filter((item) => item.isCompleted);
    const activeItemsRef = useRef(activeItems);
    const completedItemsRef = useRef(completedItems);
    const noteIDRef = useRef(id);
    const reorderListItemsRef = useRef(reorderListItems);
    activeItemsRef.current = activeItems;
    completedItemsRef.current = completedItems;
    noteIDRef.current = id;
    reorderListItemsRef.current = reorderListItems;
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

    const getDropIndex = (itemID: string, translationY: number) => {
        const currentActiveItems = activeItemsRef.current;
        const draggedLayout = rowLayouts.current[itemID];
        const currentIndex = currentActiveItems.findIndex((item) => item.recordID === itemID);
        if (!draggedLayout || currentIndex < 0) return currentIndex;

        const draggedCenter = draggedLayout.y + draggedLayout.height / 2 + translationY;
        const targetIndex = currentActiveItems.reduce((count, item) => {
            if (item.recordID === itemID) return count;
            const layout = rowLayouts.current[item.recordID];
            return layout && draggedCenter > layout.y + layout.height / 2 ? count + 1 : count;
        }, 0);
        return Math.max(0, Math.min(targetIndex, currentActiveItems.length - 1));
    };

    const reorderItem = async (itemID: string, targetIndex: number) => {
        const currentActiveItems = activeItemsRef.current;
        const currentIndex = currentActiveItems.findIndex((item) => item.recordID === itemID);
        if (currentIndex < 0 || targetIndex < 0 || targetIndex >= currentActiveItems.length || currentIndex === targetIndex) return;

        const reorderedActive = [...currentActiveItems];
        const [draggedItem] = reorderedActive.splice(currentIndex, 1);
        reorderedActive.splice(targetIndex, 0, draggedItem);
        const success = await reorderListItemsRef.current(noteIDRef.current, [...reorderedActive, ...completedItemsRef.current]);
        if (!success) setStatusMessage(useNoteStore.getState().error ?? 'Unable to reorder checklist.');
    };

    const handleDragPressIn = (event: GestureResponderEvent) => {
        dragStartYRef.current = event.nativeEvent.pageY;
        dragTranslationRef.current = 0;
        activeDragItemRef.current = null;
    };

    const handleDragLongPress = (itemID: string) => {
        if (!rowLayouts.current[itemID]) return;
        activeDragItemRef.current = itemID;
        setDraggedItemID(itemID);
        setDragTranslationY(0);
    };

    const handleDragPressMove = (itemID: string, event: GestureResponderEvent) => {
        if (activeDragItemRef.current !== itemID) return;
        const translationY = event.nativeEvent.pageY - dragStartYRef.current;
        dragTranslationRef.current = translationY;
        setDragTranslationY(translationY);
    };

    const handleDragPressOut = (itemID: string, event: GestureResponderEvent) => {
        if (activeDragItemRef.current !== itemID) return;
        const translationY = event.nativeEvent.pageY - dragStartYRef.current;
        const targetIndex = getDropIndex(itemID, translationY);
        activeDragItemRef.current = null;
        dragTranslationRef.current = 0;
        setDraggedItemID(null);
        setDragTranslationY(0);
        void reorderItem(itemID, targetIndex);
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
        handlingBackRef.current = true;
        const success = await deleteNote(id);
        if (success) navigation.goBack();
        else {
            handlingBackRef.current = false;
            setStatusMessage(useNoteStore.getState().error ?? 'Unable to delete note.');
        }
    };

    const isNoteBlank = () => title.trim().length === 0 && body.trim().length === 0 && listItems.length === 0;

    return (
        <View className="flex-1" style={{ backgroundColor: theme.background }}>
            <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: tabBarHeight + 24, gap: 12 }} keyboardShouldPersistTaps="handled">
                <View className="gap-1"><Text variant="label">Project</Text><Pressable onPress={() => setProjectDialogOpen(true)}><TextField placeholder="No project" value={projects.find((project) => project.recordID === projectID)?.name ?? ''} editable={false} trailing={<MaterialCommunityIcons name="folder-outline" size={20} color={theme.onSurfaceVariant} />} /></Pressable><Text variant="label" className="mt-2">Title</Text><TextField placeholder="Title" value={title} onChangeText={setTitle} inputClassName="text-2xl font-semibold" className="border-0" /></View>

                {noteType === 'text'
                    ?
                    <View className="-mx-4">
                        <TextField placeholder="Write something…" value={body} onChangeText={setBody} multiline borderless inputClassName="min-h-56 mx-3" />
                    </View>
                    :
                    <View className="-mx-4">
                        <View className="mb-3 flex-row items-center justify-between px-4">
                            <View>
                                <Text variant="title">Checklist</Text>
                                <Text variant="bodySmall">{completedItems.length} of {sortedItems.length} complete</Text>
                            </View>{completedItems.length > 0
                                ?
                                <Button variant="text" compact onPress={() => setCompletedCollapsed((value) => !value)}>
                                    {completedCollapsed ? 'Show completed' : 'Hide completed'}</Button> : null}
                        </View>
                        {activeItems.length === 0 && completedItems.length === 0 ? <Text variant="bodySmall" className="px-4 py-2">Add your first item below.</Text> : null}{activeItems.map((item) => <View key={item.recordID} onLayout={(event) => { rowLayouts.current[item.recordID] = event.nativeEvent.layout; }} className="flex-row items-center border-t border-outline-variant py-1 dark:border-outline-variant-dark" style={draggedItemID === item.recordID ? { opacity: 0.85, transform: [{ translateY: dragTranslationY }] } : undefined}><Checkbox status="unchecked" onPress={() => toggleListItem(item.recordID)} accessibilityLabel={`Toggle ${item.title}`} /><TextField value={item.title} onChangeText={(text) => updateListItemTitle(item.recordID, text)} borderless className="min-w-0 flex-1" /><Pressable onPressIn={(event) => handleDragPressIn(event)} onLongPress={() => handleDragLongPress(item.recordID)} onPressMove={(event) => handleDragPressMove(item.recordID, event)} onPressOut={(event) => handleDragPressOut(item.recordID, event)} delayLongPress={350} cancelable={false} pressRetentionOffset={{ top: 1000, right: 1000, bottom: 1000, left: 1000 }} accessibilityRole="button" accessibilityLabel={`Hold to drag ${item.title}`} accessibilityHint="Hold and drag to reorder" className="h-10 w-10 items-center justify-center rounded-xl active:bg-surface-variant dark:active:bg-surface-variant-dark"><MaterialCommunityIcons name="drag-horizontal" size={21} color={theme.onSurfaceVariant} /></Pressable><Button variant="text" compact icon={<MaterialCommunityIcons name="delete-outline" size={19} color={theme.onSurfaceVariant} />} accessibilityLabel="Delete checklist item" onPress={() => deleteListItem(item.recordID)} /></View>)}{!completedCollapsed && completedItems.length > 0 ? <View className="mt-2 border-t border-outline-variant pt-1 dark:border-outline-variant-dark">{completedItems.map((item) => <View key={item.recordID} className="flex-row items-center"><Checkbox status="checked" onPress={() => toggleListItem(item.recordID)} accessibilityLabel={`Toggle ${item.title}`} /><TextField value={item.title} onChangeText={(text) => updateListItemTitle(item.recordID, text)} borderless inputClassName="line-through text-on-surface-variant" className="min-w-0 flex-1" /><Button variant="text" compact icon={<MaterialCommunityIcons name="delete-outline" size={19} color={theme.onSurfaceVariant} />} accessibilityLabel="Delete completed checklist item" onPress={() => deleteListItem(item.recordID)} /></View>)}<Button variant="danger" compact className="mt-2 self-start" onPress={() => setDeleteCompletedDialogOpen(true)}>Delete all completed</Button></View> : null}<View className="mt-3 flex-row items-center gap-2 px-4"><TextField placeholder="Add an item" value={listItemInput} onChangeText={setListItemInput} className="min-w-0 flex-1" /><Button compact onPress={handleAddListItem} disabled={!listItemInput.trim()}>Add</Button></View>
                    </View>}

            </ScrollView>

            <Dialog visible={menuOpen} onDismiss={() => setMenuOpen(false)} title="More options" actions={<Button variant="text" compact onPress={() => setMenuOpen(false)}>Close</Button>}><View className="gap-2"><Text variant="label">Note type</Text><Button variant={noteType === 'text' ? 'tonal' : 'outlined'} compact className="justify-start" disabled={archived || noteType === 'text'} icon={<MaterialCommunityIcons name="note-text-outline" size={18} color={theme.onSurfaceVariant} />} onPress={() => { setMenuOpen(false); void handleToggleNoteType(); }}>Text note</Button><Button variant={noteType === 'list' ? 'tonal' : 'outlined'} compact className="justify-start" disabled={archived || noteType === 'list'} icon={<MaterialCommunityIcons name="format-list-checks" size={18} color={theme.onSurfaceVariant} />} onPress={() => { setMenuOpen(false); void handleToggleNoteType(); }}>Checklist</Button><Text variant="label" className="mt-2">Actions</Text><Button variant="outlined" compact className="justify-start" icon={<MaterialCommunityIcons name={pinned ? 'pin' : 'pin-outline'} size={18} color={iconColor} />} onPress={() => { setMenuOpen(false); void handleTogglePin(); }}>{pinned ? 'Unpin' : 'Pin'}</Button><Button variant="outlined" compact className="justify-start" icon={<MaterialCommunityIcons name={archived ? 'archive' : 'archive-outline'} size={18} color={iconColor} />} onPress={() => { setMenuOpen(false); void handleArchive(); }}>{archived ? 'Unarchive' : 'Archive'}</Button>{isCreator ? <Button variant="outlined" compact className="justify-start" icon={<MaterialCommunityIcons name="share-variant-outline" size={18} color={iconColor} />} onPress={() => { setMenuOpen(false); setShareDialogOpen(true); }}>Share</Button> : null}<Button variant="danger" compact className="justify-start" icon={<MaterialCommunityIcons name="delete-outline" size={18} color={theme.error} />} onPress={() => { setMenuOpen(false); setDeleteDialogOpen(true); }}>Delete</Button></View></Dialog>
            <Dialog visible={projectDialogOpen} onDismiss={() => setProjectDialogOpen(false)} title="Assign project" actions={<Button variant="text" compact onPress={() => setProjectDialogOpen(false)}>Done</Button>}><ScrollView className="max-h-80"><Button variant={projectID === '' ? 'tonal' : 'outlined'} compact className="mb-2 justify-start" onPress={() => handleProjectChange(null)}>No project</Button>{projects.map((project) => <Button key={project.recordID} variant={project.recordID === projectID ? 'tonal' : 'outlined'} compact className="mb-2 justify-start" onPress={() => handleProjectChange(project.recordID)}>{project.name || '(untitled project)'}</Button>)}</ScrollView></Dialog>
            <Dialog visible={deleteDialogOpen} onDismiss={() => setDeleteDialogOpen(false)} title="Delete note" actions={<><Button variant="text" compact onPress={() => setDeleteDialogOpen(false)}>Cancel</Button><Button variant="danger" compact onPress={handleDeleteNote}>Delete</Button></>}><Text>{isNoteBlank() ? 'This note is empty. Are you sure you want to delete it?' : 'Are you sure you want to delete this note?'}</Text></Dialog>
            <Dialog visible={deleteCompletedDialogOpen} onDismiss={() => setDeleteCompletedDialogOpen(false)} title="Delete completed items" actions={<><Button variant="text" compact onPress={() => setDeleteCompletedDialogOpen(false)}>Cancel</Button><Button variant="danger" compact loading={deletingCompleted} onPress={handleDeleteAllCompleted}>Delete all</Button></>}><Text>Delete {completedItems.length} completed checklist item{completedItems.length === 1 ? '' : 's'}? This cannot be undone.</Text></Dialog>
            {id && isCreator ? <ShareNoteDialog visible={shareDialogOpen} noteId={id} onClose={() => setShareDialogOpen(false)} /> : null}
            <Snackbar visible={!!statusMessage} onDismiss={() => setStatusMessage('')} onAction={() => setStatusMessage('')} bottomOffset={tabBarHeight + 24}>{statusMessage}</Snackbar>
        </View>
    );
}
