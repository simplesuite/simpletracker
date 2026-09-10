import { useEffect, useState, useRef, useCallback } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { TextInput, Button, Text, Switch, Chip, Dialog, Portal, RadioButton, useTheme } from 'react-native-paper';
import type { RouteProp } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useNoteStore, useProjectStore } from '@simpletracker/core';
import type { NotesStackParamList } from '../navigation/types';
import { ShareNoteDialog } from '../components/ShareNoteDialog';
import { MarkdownPreview } from '../components/MarkdownPreview';

export function NoteDetailScreen() {
    const theme = useTheme();
    const tabBarHeight = useBottomTabBarHeight();
    const route = useRoute<RouteProp<NotesStackParamList, 'NoteDetail'>>();
    const navigation = useNavigation();
    const { id } = route.params;

    const note = useNoteStore((s) =>
        s.notes.find((n) => n.recordID === id) ??
        s.archivedNotes.find((n) => n.recordID === id) ??
        s.sharedNotes.find((n) => n.recordID === id)
    );
    const updateNote = useNoteStore((s) => s.updateNote);
    const togglePinNote = useNoteStore((s) => s.togglePinNote);
    const archiveNote = useNoteStore((s) => s.archiveNote);
    const unarchiveNote = useNoteStore((s) => s.unarchiveNote);
    const deleteNote = useNoteStore((s) => s.deleteNote);
    const listItems = useNoteStore((s) => s.listItems[id]) ?? [];
    const addListItem = useNoteStore((s) => s.addListItem);
    const toggleListItem = useNoteStore((s) => s.toggleListItem);
    const updateListItemTitle = useNoteStore((s) => s.updateListItemTitle);
    const deleteListItem = useNoteStore((s) => s.deleteListItem);
    const fetchListItems = useNoteStore((s) => s.fetchListItems);

    const projects = useProjectStore((s) => s.projects);

    const [title, setTitle] = useState(note?.title ?? '');
    const [body, setBody] = useState(note?.body ?? '');
    const [noteType, setNoteType] = useState<'text' | 'list'>(note?.noteType ?? 'text');
    const [pinned, setPinned] = useState(note?.pinned ?? false);
    const [archived, setArchived] = useState(note?.archived ?? false);
    const [projectID, setProjectID] = useState<string | ''>(note?.projectID ?? '');
    const [listItemInput, setListItemInput] = useState('');
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [shareDialogOpen, setShareDialogOpen] = useState(false);
    const [showPreview, setShowPreview] = useState(false);


    const titleRef = useRef(title);
    const bodyRef = useRef(body);
    const projectIDRef = useRef(projectID);

    titleRef.current = title;
    bodyRef.current = body;
    projectIDRef.current = projectID;

    // Auto-save with debounce
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (id && note) {
                await updateNote(id, {
                    title: titleRef.current,
                    body: bodyRef.current,
                    projectID: projectIDRef.current || null,
                });
            }
        }, 1000);
        return () => clearTimeout(timer);
    }, [title, body, projectID, id, note, updateNote]);

    // Load list items when note type is list
    useEffect(() => {
        if (id && noteType === 'list') {
            fetchListItems(id);
        }
    }, [id, noteType, fetchListItems]);

    const handleTogglePin = async () => {
        if (!id) return;
        await togglePinNote(id);
        setPinned(!pinned);
    };

    const handleArchive = async () => {
        if (!id) return;
        if (archived) {
            await unarchiveNote(id);
        } else {
            await archiveNote(id);
        }
        setArchived(!archived);
    };

    const handleToggleNoteType = async () => {
        if (!id) return;
        const newType: 'text' | 'list' = noteType === 'text' ? 'list' : 'text';

        if (newType === 'list') {
            // Text → List: split body by lines into list items
            const lines = body.split('\n').filter((line) => line.trim().length > 0);
            for (const line of lines) {
                const trimmed = line.trim().slice(0, 255);
                await addListItem(id, trimmed);
            }
            await updateNote(id, { noteType: newType, body: '' });
            setBody('');
            setNoteType(newType);
        } else {
            // List → Text: combine list items into body lines
            const items = listItems;
            const combinedBody = items.map((item) => item.title).join('\n');
            await updateNote(id, { noteType: newType, body: combinedBody });
            setNoteType(newType);
            setBody(combinedBody);
            for (const item of items) {
                await deleteListItem(item.recordID);
            }
        }
    };

    const handleAddListItem = async () => {
        if (!listItemInput.trim() || !id) return;
        const result = await addListItem(id, listItemInput.trim());
        if (result) {
            setListItemInput('');
        }
    };

    const handleToggleListItem = async (itemID: string) => {
        await toggleListItem(itemID);
    };

    const handleDeleteListItem = async (itemID: string) => {
        await deleteListItem(itemID);
    };

    const handleUpdateListItemTitle = async (itemID: string, newTitle: string) => {
        updateListItemTitle(itemID, newTitle);
    };

    const handleDeleteNote = async () => {
        setDeleteDialogOpen(false);
        if (!id) return;
        await deleteNote(id);
        navigation.goBack();
    };

    const isNoteBlank = () => {
        return title.trim().length === 0 && body.trim().length === 0 && listItems.length === 0;
    };

    return (
        <ScrollView
            style={[styles.scroll, { backgroundColor: theme.colors.background }]}
            contentContainerStyle={[styles.container, { paddingBottom: tabBarHeight + 24 }]}
            keyboardShouldPersistTaps="handled"
        >
            <View style={[styles.editorCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
                <TextInput
                    mode="flat"
                    placeholder="Title"
                    value={title}
                    onChangeText={setTitle}
                    style={styles.title}
                    contentStyle={styles.titleContent}
                />
                <View style={styles.metaRow}>
                    <Chip icon={noteType === 'list' ? 'format-list-checks' : 'note-text-outline'} compact>
                        {noteType === 'list' ? 'Checklist' : 'Text note'}
                    </Chip>
                    {archived && <Chip icon="archive" compact>Archived</Chip>}
                    {pinned && <Chip icon="pin" compact>Pinned</Chip>}
                </View>
            </View>

            <View style={[styles.sectionCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
                <View style={styles.sectionHeading}>
                    <View>
                        <Text variant="titleMedium">Note type</Text>
                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                            Choose how this note is organized
                        </Text>
                    </View>
                    <Chip icon="swap-horizontal" compact disabled={archived}>
                        {noteType === 'list' ? 'Checklist' : 'Text'}
                    </Chip>
                </View>
                <View style={styles.toggleRow}>
                    <Chip
                        icon="note-text-outline"
                        selected={noteType === 'text'}
                        onPress={handleToggleNoteType}
                        disabled={archived || noteType === 'text'}
                        style={styles.typeChip}
                    >
                        Text
                    </Chip>
                    <Chip
                        icon="format-list-checks"
                        selected={noteType === 'list'}
                        onPress={handleToggleNoteType}
                        disabled={archived || noteType === 'list'}
                        style={styles.typeChip}
                    >
                        Checklist
                    </Chip>
                </View>
            </View>

            {noteType === 'text' ? (
                <View style={[styles.sectionCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
                    <View style={styles.sectionHeading}>
                        <Text variant="titleMedium">Content</Text>
                        <Button compact mode="text" icon={showPreview ? 'pencil-outline' : 'eye-outline'} onPress={() => setShowPreview(!showPreview)}>
                            {showPreview ? 'Edit' : 'Preview'}
                        </Button>
                    </View>
                    {showPreview ? (
                        <MarkdownPreview content={body} style={styles.body} />
                    ) : (
                        <TextInput
                            mode="flat"
                            placeholder="Write something…"
                            value={body}
                            onChangeText={setBody}
                            multiline
                            style={styles.body}
                            contentStyle={styles.bodyContent}
                        />
                    )}
                </View>
            ) : (
                <View style={[styles.sectionCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
                    <View style={styles.sectionHeading}>
                        <View>
                            <Text variant="titleMedium">Checklist</Text>
                            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                {listItems.filter((item) => item.isCompleted).length} of {listItems.length} complete
                            </Text>
                        </View>
                    </View>
                    {listItems.length === 0 && (
                        <Text variant="bodyMedium" style={[styles.emptyHint, { color: theme.colors.onSurfaceVariant }]}>
                            Add your first item below.
                        </Text>
                    )}
                    {listItems.map((item) => (
                        <View key={item.recordID} style={[styles.listItem, { borderTopColor: theme.colors.outlineVariant }]}>
                            <RadioButton
                                value={item.isCompleted ? 'completed' : 'incomplete'}
                                status={item.isCompleted ? 'checked' : 'unchecked'}
                                onPress={() => handleToggleListItem(item.recordID)}
                            />
                            <TextInput
                                mode="flat"
                                value={item.title}
                                onChangeText={(text) => handleUpdateListItemTitle(item.recordID, text)}
                                style={styles.listItemText}
                                contentStyle={item.isCompleted ? [styles.completedText, { color: theme.colors.onSurfaceVariant }] : undefined}
                            />
                            <Button
                                mode="text"
                                icon="delete-outline"
                                compact
                                accessibilityLabel="Delete checklist item"
                                onPress={() => handleDeleteListItem(item.recordID)}
                            >
                                {''}
                            </Button>
                        </View>
                    ))}
                    <View style={styles.addListItemRow}>
                        <TextInput
                            mode="outlined"
                            placeholder="Add an item"
                            value={listItemInput}
                            onChangeText={setListItemInput}
                            style={styles.addListItemInput}
                        />
                        <Button
                            mode="contained"
                            compact
                            onPress={handleAddListItem}
                            disabled={!listItemInput.trim()}
                        >
                            Add
                        </Button>
                    </View>
                </View>
            )}

            {projectID && (
                <View style={styles.projectSection}>
                    <Text variant="labelLarge" style={styles.sectionLabel}>Project</Text>
                    <Chip icon="folder-outline" onClose={() => { /* TODO: Remove project */ }}>
                        {projects.find(p => p.recordID === projectID)?.name || 'Unknown Project'}
                    </Chip>
                </View>
            )}

            <View style={[styles.actionsCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
                <Button mode="text" icon={pinned ? 'pin' : 'pin-outline'} onPress={handleTogglePin} compact>
                    {pinned ? 'Pinned' : 'Pin'}
                </Button>
                <Button mode="text" icon={archived ? 'unarchive' : 'archive-outline'} onPress={handleArchive} compact>
                    {archived ? 'Unarchive' : 'Archive'}
                </Button>
                <Button mode="text" icon="share-variant-outline" onPress={() => setShareDialogOpen(true)} compact>
                    Share
                </Button>
                <Button mode="text" icon="delete-outline" onPress={() => setDeleteDialogOpen(true)} compact textColor={theme.colors.error}>
                    Delete
                </Button>
            </View>

            <Portal>
                <Dialog visible={deleteDialogOpen} onDismiss={() => setDeleteDialogOpen(false)}>
                    <Dialog.Title>Delete Note</Dialog.Title>
                    <Dialog.Content>
                        <Text>
                            {isNoteBlank()
                                ? 'This note is empty. Are you sure you want to delete it?'
                                : 'Are you sure you want to delete this note?'}
                        </Text>
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={() => setDeleteDialogOpen(false)}>Cancel</Button>
                        <Button onPress={handleDeleteNote}>Delete</Button>
                    </Dialog.Actions>
                </Dialog>
            </Portal>
            {id && (
                <ShareNoteDialog
                    visible={shareDialogOpen}
                    noteId={id}
                    onClose={() => setShareDialogOpen(false)}
                />
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    scroll: { flex: 1 },
    container: { padding: 16, gap: 12 },
    editorCard: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 20, padding: 8 },
    title: { fontSize: 25, backgroundColor: 'transparent' },
    titleContent: { paddingHorizontal: 8, paddingVertical: 8, fontWeight: '600' },
    metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 8, paddingBottom: 8 },
    sectionCard: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 20, padding: 16 },
    sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
    toggleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    typeChip: { flexGrow: 1 },
    body: { minHeight: 240, backgroundColor: 'transparent' },
    bodyContent: { paddingHorizontal: 0, paddingTop: 8 },
    emptyHint: { paddingVertical: 8 },
    listItem: { flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 4 },
    listItemText: { flex: 1, backgroundColor: 'transparent' },
    completedText: { textDecorationLine: 'line-through' },
    addListItemRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
    addListItemInput: { flex: 1 },
    projectSection: { paddingHorizontal: 4, gap: 6 },
    sectionLabel: { marginLeft: 4 },
    actionsCard: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', borderWidth: StyleSheet.hairlineWidth, borderRadius: 20, paddingVertical: 6, paddingHorizontal: 4 },
});
