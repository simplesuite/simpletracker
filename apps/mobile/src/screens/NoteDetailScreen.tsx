import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import type { RouteProp } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useNoteStore, useProjectStore } from '@simpletracker/core';
import { Button, Card, Checkbox, Dialog, Pill, Text, TextField, getUiTheme } from '@simpletracker/ui';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { NotesStackParamList } from '../navigation/types';
import { ShareNoteDialog } from '../components/ShareNoteDialog';
import { useAuthStore } from '../store/authStore';
import { MarkdownPreview } from '../components/MarkdownPreview';
import { useThemeStore } from '../store/themeStore';

export function NoteDetailScreen() {
    const tabBarHeight = useBottomTabBarHeight();
    const { effectiveTheme } = useThemeStore();
    const theme = getUiTheme(effectiveTheme);
    const route = useRoute<RouteProp<NotesStackParamList, 'NoteDetail'>>();
    const navigation = useNavigation();
    const { id } = route.params;
    const userId = useAuthStore((s) => s.userId);

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
    const [projectID] = useState<string | ''>(note?.projectID ?? '');
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

    useEffect(() => {
        const timer = setTimeout(async () => {
            if (id && note) {
                await updateNote(id, { title: titleRef.current, body: bodyRef.current, projectID: projectIDRef.current || null });
            }
        }, 1000);
        return () => clearTimeout(timer);
    }, [title, body, projectID, id, note, updateNote]);

    useEffect(() => {
        if (id && noteType === 'list') fetchListItems(id);
    }, [id, noteType, fetchListItems]);

    const handleTogglePin = async () => {
        if (!id) return;
        await togglePinNote(id);
        setPinned(!pinned);
    };

    const handleArchive = async () => {
        if (!id) return;
        if (archived) await unarchiveNote(id);
        else await archiveNote(id);
        setArchived(!archived);
    };

    const handleToggleNoteType = async () => {
        if (!id) return;
        const newType: 'text' | 'list' = noteType === 'text' ? 'list' : 'text';
        if (newType === 'list') {
            const lines = body.split('\n').filter((line) => line.trim().length > 0);
            for (const line of lines) await addListItem(id, line.trim().slice(0, 255));
            await updateNote(id, { noteType: newType, body: '' });
            setBody('');
            setNoteType(newType);
        } else {
            const combinedBody = listItems.map((item) => item.title).join('\n');
            await updateNote(id, { noteType: newType, body: combinedBody });
            setNoteType(newType);
            setBody(combinedBody);
            for (const item of listItems) await deleteListItem(item.recordID);
        }
    };

    const handleAddListItem = async () => {
        if (!listItemInput.trim() || !id) return;
        const result = await addListItem(id, listItemInput.trim());
        if (result) setListItemInput('');
    };

    const handleDeleteNote = async () => {
        setDeleteDialogOpen(false);
        if (!id) return;
        await deleteNote(id);
        navigation.goBack();
    };

    const isNoteBlank = () => title.trim().length === 0 && body.trim().length === 0 && listItems.length === 0;
    const isCreator = note?.creatorID === userId;
    const iconColor = effectiveTheme === 'dark' ? '#c4b5fd' : '#4f46e5';

    return (
        <View className="flex-1" style={{ backgroundColor: theme.background }}>
            <ScrollView
                className="flex-1"
                contentContainerStyle={{ padding: 16, paddingBottom: tabBarHeight + 24, gap: 12 }}
                keyboardShouldPersistTaps="handled"
            >
                <Card className="rounded-3xl p-2">
                    <TextField placeholder="Title" value={title} onChangeText={setTitle} inputClassName="text-2xl font-semibold" className="border-0" />
                    <View className="flex-row flex-wrap gap-2 px-2 pb-2 pt-2">
                        <Pill compact icon={<MaterialCommunityIcons name={noteType === 'list' ? 'format-list-checks' : 'note-text-outline'} size={15} color={iconColor} />}>
                            {noteType === 'list' ? 'Checklist' : 'Text note'}
                        </Pill>
                        {archived ? <Pill compact icon={<MaterialCommunityIcons name="archive" size={15} color={iconColor} />}>Archived</Pill> : null}
                        {pinned ? <Pill compact icon={<MaterialCommunityIcons name="pin" size={15} color={iconColor} />}>Pinned</Pill> : null}
                    </View>
                </Card>

                <Card className="p-4">
                    <View className="mb-3 flex-row items-center justify-between gap-3">
                        <View className="min-w-0 flex-1">
                            <Text variant="title">Note type</Text>
                            <Text variant="bodySmall">Choose how this note is organized</Text>
                        </View>
                        <Pill compact disabled={archived} icon={<MaterialCommunityIcons name="swap-horizontal" size={15} color={theme.onSurfaceVariant} />}>
                            {noteType === 'list' ? 'Checklist' : 'Text'}
                        </Pill>
                    </View>
                    <View className="flex-row flex-wrap gap-2">
                        <Pill icon={<MaterialCommunityIcons name="note-text-outline" size={17} color={noteType === 'text' ? '#fff' : iconColor} />} selected={noteType === 'text'} onPress={handleToggleNoteType} disabled={archived || noteType === 'text'} className="flex-1">
                            Text
                        </Pill>
                        <Pill icon={<MaterialCommunityIcons name="format-list-checks" size={17} color={noteType === 'list' ? '#fff' : iconColor} />} selected={noteType === 'list'} onPress={handleToggleNoteType} disabled={archived || noteType === 'list'} className="flex-1">
                            Checklist
                        </Pill>
                    </View>
                </Card>

                {noteType === 'text' ? (
                    <Card className="p-4">
                        <View className="mb-3 flex-row items-center justify-between gap-3">
                            <Text variant="title">Content</Text>
                            <Button variant="text" compact icon={<MaterialCommunityIcons name={showPreview ? 'pencil-outline' : 'eye-outline'} size={17} color={iconColor} />} onPress={() => setShowPreview(!showPreview)}>
                                {showPreview ? 'Edit' : 'Preview'}
                            </Button>
                        </View>
                        {showPreview ? <MarkdownPreview content={body} /> : <TextField placeholder="Write something…" value={body} onChangeText={setBody} multiline inputClassName="min-h-56" />}
                    </Card>
                ) : (
                    <Card className="p-4">
                        <View className="mb-3">
                            <Text variant="title">Checklist</Text>
                            <Text variant="bodySmall">{listItems.filter((item) => item.isCompleted).length} of {listItems.length} complete</Text>
                        </View>
                        {listItems.length === 0 ? <Text variant="bodySmall" className="py-2">Add your first item below.</Text> : null}
                        {listItems.map((item) => (
                            <View key={item.recordID} className="flex-row items-center border-t border-slate-200 py-1 dark:border-slate-800">
                                <Checkbox status={item.isCompleted ? 'checked' : 'unchecked'} onPress={() => toggleListItem(item.recordID)} accessibilityLabel={`Toggle ${item.title}`} />
                                <TextField value={item.title} onChangeText={(text) => updateListItemTitle(item.recordID, text)} inputClassName={item.isCompleted ? 'line-through text-slate-500' : ''} className="min-w-0 flex-1 border-0" />
                                <Button variant="text" compact icon={<MaterialCommunityIcons name="delete-outline" size={19} color={theme.onSurfaceVariant} />} accessibilityLabel="Delete checklist item" onPress={() => deleteListItem(item.recordID)} />
                            </View>
                        ))}
                        <View className="mt-3 flex-row items-center gap-2">
                            <TextField placeholder="Add an item" value={listItemInput} onChangeText={setListItemInput} className="min-w-0 flex-1" />
                            <Button compact onPress={handleAddListItem} disabled={!listItemInput.trim()}>Add</Button>
                        </View>
                    </Card>
                )}

                {projectID ? (
                    <View className="gap-2 px-1">
                        <Text variant="label">Project</Text>
                        <Pill icon={<MaterialCommunityIcons name="folder-outline" size={17} color={iconColor} />} onClose={() => { /* TODO: Remove project */ }}>
                            {projects.find((p) => p.recordID === projectID)?.name || 'Unknown Project'}
                        </Pill>
                    </View>
                ) : null}

                <Card className="flex-row flex-wrap items-center justify-between gap-1 p-2">
                    <Button variant="text" compact icon={<MaterialCommunityIcons name={pinned ? 'pin' : 'pin-outline'} size={17} color={iconColor} />} onPress={handleTogglePin}>{pinned ? 'Pinned' : 'Pin'}</Button>
                    <Button variant="text" compact icon={<MaterialCommunityIcons name={archived ? 'archive' : 'archive-outline'} size={17} color={iconColor} />} onPress={handleArchive}>{archived ? 'Unarchive' : 'Archive'}</Button>
                    {isCreator ? <Button variant="text" compact icon={<MaterialCommunityIcons name="share-variant-outline" size={17} color={iconColor} />} onPress={() => setShareDialogOpen(true)}>Share</Button> : null}
                    <Button variant="danger" compact icon={<MaterialCommunityIcons name="delete-outline" size={17} color={theme.error} />} onPress={() => setDeleteDialogOpen(true)}>Delete</Button>
                </Card>
            </ScrollView>

            <Dialog
                visible={deleteDialogOpen}
                onDismiss={() => setDeleteDialogOpen(false)}
                title="Delete Note"
                actions={(
                    <>
                        <Button variant="text" compact onPress={() => setDeleteDialogOpen(false)}>Cancel</Button>
                        <Button variant="danger" compact onPress={handleDeleteNote}>Delete</Button>
                    </>
                )}
            >
                <Text>{isNoteBlank() ? 'This note is empty. Are you sure you want to delete it?' : 'Are you sure you want to delete this note?'}</Text>
            </Dialog>
            {id && isCreator ? <ShareNoteDialog visible={shareDialogOpen} noteId={id} onClose={() => setShareDialogOpen(false)} /> : null}
        </View>
    );
}
