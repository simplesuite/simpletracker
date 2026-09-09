import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Checkbox, Chip, Divider, List, Snackbar, Text, TextInput } from 'react-native-paper';
import type { CompositeNavigationProp, RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNoteStore, useProjectStore, useTaskStore } from '@simpletracker/core';
import type { Note, Task } from '@simpletracker/core';
import type { ProjectsStackParamList, RootTabParamList } from '../navigation/types';
import { ShareProjectDialog } from '../components/ShareProjectDialog';

// The project screen lives inside the Projects tab, but linked content belongs
// to the Notes and Tasks stacks. This type lets us switch tabs and open detail.
type ProjectNavigation = CompositeNavigationProp<
    NativeStackNavigationProp<ProjectsStackParamList, 'ProjectDetail'>,
    BottomTabNavigationProp<RootTabParamList>
>;

function sortByDueDate(a: Task, b: Task) {
    if (a.dueDate != null && b.dueDate != null) return a.dueDate - b.dueDate;
    if (a.dueDate != null) return -1;
    if (b.dueDate != null) return 1;
    return b.createdAt - a.createdAt;
}

function formatDueDate(dueDate: number) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const date = new Date(dueDate);
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffDays = Math.round((dateOnly.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return `Overdue · ${date.toLocaleDateString()}`;
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

async function waitForStoreRecord(isPresent: () => boolean): Promise<boolean> {
    for (let attempt = 0; attempt < 10; attempt += 1) {
        if (isPresent()) return true;
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
    return isPresent();
}

export function ProjectDetailScreen() {
    const route = useRoute<RouteProp<ProjectsStackParamList, 'ProjectDetail'>>();
    const navigation = useNavigation<ProjectNavigation>();
    const { id } = route.params;

    const project = useProjectStore((s) => s.projects.find((p) => p.recordID === id));
    const updateProject = useProjectStore((s) => s.updateProject);

    const notes = useNoteStore((s) => s.notes);
    const sharedNotes = useNoteStore((s) => s.sharedNotes);
    const archivedNotes = useNoteStore((s) => s.archivedNotes);
    const listItems = useNoteStore((s) => s.listItems);
    const fetchArchivedNotes = useNoteStore((s) => s.fetchArchivedNotes);
    const fetchListItems = useNoteStore((s) => s.fetchListItems);
    const createNote = useNoteStore((s) => s.createNote);

    const tasks = useTaskStore((s) => s.tasks);
    const createBlankTask = useTaskStore((s) => s.createBlankTask);
    const completeTask = useTaskStore((s) => s.completeTask);
    const reopenTask = useTaskStore((s) => s.reopenTask);

    const [name, setName] = useState(project?.name ?? '');
    const [description, setDescription] = useState(project?.description ?? '');
    const [showArchived, setShowArchived] = useState(false);
    const [showCompleted, setShowCompleted] = useState(false);
    const [shareDialogOpen, setShareDialogOpen] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);

    useEffect(() => {
        if (project) {
            setName(project.name);
            setDescription(project.description);
        }
    }, [project?.recordID, project?.name, project?.description]);

    const projectNotes = useMemo(
        () => [...notes, ...sharedNotes]
            .filter((note) => note.projectID === id)
            .sort((a, b) => Number(b.pinned) - Number(a.pinned)),
        [notes, sharedNotes, id],
    );
    const projectArchivedNotes = useMemo(
        () => archivedNotes.filter((note) => note.projectID === id),
        [archivedNotes, id],
    );
    const projectTasks = useMemo(
        () => tasks.filter((task) => task.projectID === id),
        [tasks, id],
    );
    const openTasks = useMemo(
        () => projectTasks.filter((task) => task.status === 'open').sort(sortByDueDate),
        [projectTasks],
    );
    const completedTasks = useMemo(
        () => projectTasks.filter((task) => task.status === 'completed').sort(sortByDueDate),
        [projectTasks],
    );

    useEffect(() => {
        fetchArchivedNotes();
        for (const note of [...projectNotes, ...projectArchivedNotes]) {
            if (note.noteType === 'list' && !listItems[note.recordID]) {
                fetchListItems(note.recordID);
            }
        }
    }, [fetchArchivedNotes, fetchListItems, listItems, projectNotes, projectArchivedNotes]);

    const openNote = (noteId: string) => {
        navigation.navigate('Notes', {
            screen: 'NoteDetail',
            params: { id: noteId },
        });
    };

    const openTask = (taskId: string) => {
        navigation.navigate('Tasks', {
            screen: 'TaskDetail',
            params: { id: taskId },
        });
    };

    const addNote = async () => {
        const note = await createNote(id);
        if (!note) {
            setActionError(useNoteStore.getState().error ?? 'Unable to create note.');
            return;
        }
        const visible = await waitForStoreRecord(() =>
            useNoteStore.getState().notes.some((item) => item.recordID === note.recordID) ||
            useNoteStore.getState().sharedNotes.some((item) => item.recordID === note.recordID),
        );
        if (visible) {
            openNote(note.recordID);
        } else {
            setActionError('The new note is still syncing. Please try again in a moment.');
        }
    };

    const addTask = async () => {
        const task = await createBlankTask(id);
        const visible = await waitForStoreRecord(() =>
            useTaskStore.getState().tasks.some((item) => item.recordID === task.recordID),
        );
        if (visible) {
            openTask(task.recordID);
        } else {
            setActionError(useTaskStore.getState().error ?? 'Unable to create task. Check your connection and try again.');
        }
    };

    const toggleTask = async (task: Task, completed: boolean) => {
        const success = completed
            ? await reopenTask(task.recordID)
            : await completeTask(task.recordID);
        if (!success) {
            setActionError(useTaskStore.getState().error ?? 'Unable to update task.');
        }
    };

    const renderNote = (note: Note, archived = false) => {
        const items = listItems[note.recordID] ?? [];
        return (
            <Card key={note.recordID} style={[styles.itemCard, archived && styles.archivedCard]} onPress={() => openNote(note.recordID)}>
                <Card.Content>
                    <View style={styles.itemHeader}>
                        <View style={styles.itemTitle}>
                            <List.Icon icon={note.noteType === 'list' ? 'format-list-checks' : 'note-text-outline'} />
                            <Text variant="titleMedium" numberOfLines={1}>{note.title || '(untitled)'}</Text>
                        </View>
                        {note.pinned && <Chip icon="pin" compact> Pinned </Chip>}
                    </View>
                    {note.noteType === 'list' ? (
                        items.slice(0, 2).map((item) => (
                            <Text key={item.recordID} variant="bodySmall" style={item.isCompleted && styles.completedText} numberOfLines={1}>
                                {item.isCompleted ? '☑' : '☐'} {item.title || '(untitled)'}
                            </Text>
                        ))
                    ) : (
                        <Text variant="bodySmall" numberOfLines={2} style={styles.secondaryText}>
                            {note.body || 'No note content'}
                        </Text>
                    )}
                    <Text variant="labelSmall" style={styles.secondaryText}>
                        Updated {new Date(note.updatedAt).toLocaleDateString()}
                    </Text>
                </Card.Content>
            </Card>
        );
    };

    const renderTask = (task: Task, completed = false) => (
        <List.Item
            key={task.recordID}
            title={task.title || '(untitled)'}
            titleStyle={completed ? styles.completedText : undefined}
            description={task.dueDate ? formatDueDate(task.dueDate) : task.isRecurring ? 'Recurring' : undefined}
            left={(props) => (
                <List.Icon
                    {...props}
                    icon={completed ? 'check-circle-outline' : 'circle-outline'}
                    color={completed ? '#43a047' : undefined}
                />
            )}
            onPress={() => openTask(task.recordID)}
            right={() => (
                <Checkbox
                    status={completed ? 'checked' : 'unchecked'}
                    onPress={() => toggleTask(task, completed)}
                />
            )}
        />
    );

    if (!project) {
        return (
            <View style={styles.empty}>
                <Text>Project not found.</Text>
            </View>
        );
    }

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <TextInput
                mode="flat"
                placeholder="Project name"
                value={name}
                onChangeText={setName}
                onBlur={() => updateProject(id, { name })}
                style={styles.title}
            />
            <TextInput
                mode="flat"
                placeholder="Description"
                value={description}
                onChangeText={setDescription}
                onBlur={() => updateProject(id, { description })}
                multiline
                style={styles.body}
            />

            <View style={styles.projectActions}>
                <Button mode="outlined" icon="plus" onPress={addNote}>Add note</Button>
                <Button mode="outlined" icon="plus" onPress={addTask}>Add task</Button>
                <Button mode="text" icon="share-variant" onPress={() => setShareDialogOpen(true)}>Share</Button>
            </View>

            <Divider style={styles.divider} />
            <View style={styles.sectionHeader}>
                <Text variant="titleLarge">Notes ({projectNotes.length})</Text>
                <Button compact onPress={addNote}>Add</Button>
            </View>
            {projectNotes.length === 0 ? (
                <Text style={styles.emptySection}>No notes in this project.</Text>
            ) : projectNotes.map((note) => renderNote(note))}

            {projectArchivedNotes.length > 0 && (
                <>
                    <List.Item
                        title={`Archived notes (${projectArchivedNotes.length})`}
                        left={(props) => <List.Icon {...props} icon={showArchived ? 'chevron-up' : 'chevron-down'} />}
                        onPress={() => setShowArchived((value) => !value)}
                    />
                    {showArchived && projectArchivedNotes.map((note) => renderNote(note, true))}
                </>
            )}

            <View style={styles.sectionHeader}>
                <Text variant="titleLarge">Tasks ({projectTasks.length})</Text>
                <Button compact onPress={addTask}>Add</Button>
            </View>
            {projectTasks.length === 0 ? (
                <Text style={styles.emptySection}>No tasks in this project.</Text>
            ) : (
                <Card style={styles.taskCard}>
                    <Card.Content>
                        {openTasks.length > 0 && <List.Section>{openTasks.map((task) => renderTask(task))}</List.Section>}
                        {completedTasks.length > 0 && (
                            <>
                                <List.Item
                                    title={`Completed (${completedTasks.length})`}
                                    left={(props) => <List.Icon {...props} icon={showCompleted ? 'chevron-up' : 'chevron-down'} />}
                                    onPress={() => setShowCompleted((value) => !value)}
                                />
                                {showCompleted && <List.Section>{completedTasks.map((task) => renderTask(task, true))}</List.Section>}
                            </>
                        )}
                    </Card.Content>
                </Card>
            )}

            <ShareProjectDialog
                visible={shareDialogOpen}
                projectId={id}
                onClose={() => setShareDialogOpen(false)}
            />
            <Snackbar
                visible={!!actionError}
                onDismiss={() => setActionError(null)}
                action={{ label: 'Dismiss', onPress: () => setActionError(null) }}
            >
                {actionError}
            </Snackbar>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { padding: 16, paddingBottom: 40 },
    title: { fontSize: 20, marginBottom: 8, backgroundColor: 'transparent' },
    body: { minHeight: 100, backgroundColor: 'transparent' },
    projectActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
    divider: { marginVertical: 20 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 8 },
    itemCard: { marginBottom: 8 },
    archivedCard: { opacity: 0.7 },
    itemHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    itemTitle: { flex: 1, flexDirection: 'row', alignItems: 'center' },
    secondaryText: { color: '#777', marginTop: 4 },
    completedText: { textDecorationLine: 'line-through', color: '#777' },
    taskCard: { marginBottom: 16 },
    emptySection: { color: '#777', marginBottom: 16 },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
});
