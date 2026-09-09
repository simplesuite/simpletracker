import { useEffect, useState, useRef, useCallback } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { TextInput, Button, Text, Switch, Chip, Dialog, Portal, RadioButton, useTheme } from 'react-native-paper';
import type { RouteProp } from '@react-navigation/native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useNoteStore, useProjectStore } from '@simpletracker/core';
import type { NotesStackParamList } from '../navigation/types';
import { ShareNoteDialog } from '../components/ShareNoteDialog';
import { MarkdownPreview } from '../components/MarkdownPreview';

export function NoteDetailScreen() {
    const theme = useTheme();
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
        <ScrollView contentContainerStyle={styles.container}>
            <TextInput
                mode="flat"
                placeholder="Title"
                value={title}
                onChangeText={setTitle}
                style={styles.title}
            />
            <View style={styles.toggleSection}>
                <Text style={styles.toggleLabel}>Note Type</Text>
                <View style={styles.toggleRow}>
                    <RadioButton
                        value="text"
                        status={noteType === 'text' ? 'checked' : 'unchecked'}
                        onPress={() => handleToggleNoteType()}
                        disabled={archived}
                    />
                    <Text style={styles.toggleOption}>Text</Text>
                    <RadioButton
                        value="list"
                        status={noteType === 'list' ? 'checked' : 'unchecked'}
                        onPress={() => handleToggleNoteType()}
                        disabled={archived}
                    />
                    <Text style={styles.toggleOption}>Checklist</Text>
                </View>
            </View>

            {noteType === 'text' ? (
                <>
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
                        />
                    )}
                    <Button
                        mode="text"
                        onPress={() => setShowPreview(!showPreview)}
                        style={styles.previewToggle}
                    >
                        {showPreview ? 'Edit' : 'Preview'}
                    </Button>
                </>
            ) : (
                <View style={styles.listSection}>
                    {listItems.map((item) => (
                        <View key={item.recordID} style={styles.listItem}>
                            <View style={styles.listItemContent}>
                                <RadioButton
                                    value={item.isCompleted ? 'completed' : 'incomplete'}
                                    status={item.isCompleted ? 'checked' : 'unchecked'}
                                    onPress={() => handleToggleListItem(item.recordID)}
                                />
                                <TextInput
                                    mode="flat"
                                    value={item.title}
                                    onChangeText={(text) => handleUpdateListItemTitle(item.recordID, text)}
                                    style={[
                                        styles.listItemText,
                                        item.isCompleted && { color: theme.colors.onSurfaceVariant, textDecorationLine: 'line-through' }
                                    ]}
                                />
                            </View>
                            <Button
                                mode="text"
                                icon="delete"
                                onPress={() => handleDeleteListItem(item.recordID)}
                                style={styles.deleteItemBtn}
                            >
                                Delete
                            </Button>
                        </View>
                    ))}
                    <View style={styles.addListItemRow}>
                        <TextInput
                            mode="outlined"
                            placeholder="Add an item..."
                            value={listItemInput}
                            onChangeText={setListItemInput}
                            style={styles.addListItemInput}
                        />
                        <Button
                            mode="contained"
                            onPress={handleAddListItem}
                            disabled={!listItemInput.trim()}
                            style={styles.addListItemBtn}
                        >
                            Add
                        </Button>
                    </View>
                </View>
            )}

            {/* Actions Toolbar */}
            <View style={styles.actions}>
                <Button
                    mode="text"
                    icon={pinned ? 'pin' : 'pin-outline'}
                    onPress={handleTogglePin}
                >
                    {pinned ? 'Pinned' : 'Pin'}
                </Button>
                <Button
                    mode="text"
                    icon={archived ? 'unarchive' : 'archive'}
                    onPress={handleArchive}
                >
                    {archived ? 'Unarchive' : 'Archive'}
                </Button>
                <Button
                    mode="text"
                    icon="delete"
                    onPress={() => setDeleteDialogOpen(true)}
                >
                    Delete
                </Button>
                <Button
                    mode="text"
                    icon="share-variant"
                    onPress={() => setShareDialogOpen(true)}
                >
                    Share
                </Button>
            </View>

            {/* Project chip (read-only for now) */}
            {projectID && (
                <View style={styles.projectSection}>
                    <Chip
                        icon="folder"
                        onClose={() => { /* TODO: Remove project */ }}
                    >
                        {projects.find(p => p.recordID === projectID)?.name || 'Unknown Project'}
                    </Chip>
                </View>
            )}

            {/* Delete Confirmation Dialog */}
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
            {/* Share Dialog */}
            {id && (
                <Portal>
                    <ShareNoteDialog
                        visible={shareDialogOpen}
                        noteId={id}
                        onClose={() => setShareDialogOpen(false)}
                    />
                </Portal>
            )}

            </Portal>

        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { padding: 16 },
    title: { fontSize: 20, marginBottom: 8, backgroundColor: 'transparent' },
    body: { minHeight: 240, backgroundColor: 'transparent' },
    toggleSection: { marginTop: 16, paddingVertical: 8 },
    toggleLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
    toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    toggleOption: { fontSize: 16 },
    listSection: { marginTop: 16 },
    listItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
    listItemContent: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
    listItemText: { flex: 1 },
    deleteItemBtn: { padding: 4 },
    addListItemRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
    addListItemInput: { flex: 1 },
    addListItemBtn: { marginLeft: 8 },
    actions: { flexDirection: 'row', gap: 16, marginTop: 24, justifyContent: 'flex-end' },
    projectSection: { marginTop: 16 },
    previewToggle: { marginTop: 8, alignSelf: 'flex-start' },
});
