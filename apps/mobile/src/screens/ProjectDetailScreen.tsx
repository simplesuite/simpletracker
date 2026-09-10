import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import type { CompositeNavigationProp, RouteProp } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNoteStore, useProjectStore, useTaskStore } from '@simpletracker/core';
import type { Note, Task } from '@simpletracker/core';
import { Button, Card, Checkbox, Divider, Pill, Snackbar, Text, TextField, getUiTheme } from '@simpletracker/ui';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ProjectsStackParamList, RootTabParamList } from '../navigation/types';
import { ShareProjectDialog } from '../components/ShareProjectDialog';
import { useThemeStore } from '../store/themeStore';

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
    const tabBarHeight = useBottomTabBarHeight();
    const { effectiveTheme } = useThemeStore();
    const theme = getUiTheme(effectiveTheme);
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

    const projectNotes = useMemo(() => [...notes, ...sharedNotes].filter((note) => note.projectID === id).sort((a, b) => Number(b.pinned) - Number(a.pinned)), [notes, sharedNotes, id]);
    const projectArchivedNotes = useMemo(() => archivedNotes.filter((note) => note.projectID === id), [archivedNotes, id]);
    const projectTasks = useMemo(() => tasks.filter((task) => task.projectID === id), [tasks, id]);
    const openTasks = useMemo(() => projectTasks.filter((task) => task.status === 'open').sort(sortByDueDate), [projectTasks]);
    const completedTasks = useMemo(() => projectTasks.filter((task) => task.status === 'completed').sort(sortByDueDate), [projectTasks]);

    useEffect(() => {
        fetchArchivedNotes();
        for (const note of [...projectNotes, ...projectArchivedNotes]) {
            if (note.noteType === 'list' && !listItems[note.recordID]) fetchListItems(note.recordID);
        }
    }, [fetchArchivedNotes, fetchListItems, listItems, projectNotes, projectArchivedNotes]);

    const openNote = (noteId: string) => navigation.navigate('Notes', { screen: 'NoteDetail', params: { id: noteId } });
    const openTask = (taskId: string) => navigation.navigate('Tasks', { screen: 'TaskDetail', params: { id: taskId } });

    const addNote = async () => {
        const note = await createNote(id);
        if (!note) {
            setActionError(useNoteStore.getState().error ?? 'Unable to create note.');
            return;
        }
        const visible = await waitForStoreRecord(() => useNoteStore.getState().notes.some((item) => item.recordID === note.recordID) || useNoteStore.getState().sharedNotes.some((item) => item.recordID === note.recordID));
        if (visible) openNote(note.recordID);
        else setActionError('The new note is still syncing. Please try again in a moment.');
    };

    const addTask = async () => {
        const task = await createBlankTask(id);
        const visible = await waitForStoreRecord(() => useTaskStore.getState().tasks.some((item) => item.recordID === task.recordID));
        if (visible) openTask(task.recordID);
        else setActionError(useTaskStore.getState().error ?? 'Unable to create task. Check your connection and try again.');
    };

    const toggleTask = async (task: Task, completed: boolean) => {
        const success = completed ? await reopenTask(task.recordID) : await completeTask(task.recordID);
        if (!success) setActionError(useTaskStore.getState().error ?? 'Unable to update task.');
    };

    const renderNote = (note: Note, archived = false) => {
        const items = listItems[note.recordID] ?? [];
        return (
            <Card key={note.recordID} onPress={() => openNote(note.recordID)} className={`mb-2 p-4 ${archived ? 'opacity-60' : ''}`}>
                <View className="flex-row items-center justify-between">
                    <View className="min-w-0 flex-1 flex-row items-center">
                        <MaterialCommunityIcons name={note.noteType === 'list' ? 'format-list-checks' : 'note-text-outline'} size={22} color={theme.primary} />
                        <Text variant="title" numberOfLines={1} className="min-w-0 flex-1 pl-2">{note.title || '(untitled)'}</Text>
                    </View>
                    {note.pinned ? <Pill compact icon={<MaterialCommunityIcons name="pin" size={14} color={theme.primary} />}>Pinned</Pill> : null}
                </View>
                {note.noteType === 'list' ? items.slice(0, 2).map((item) => (
                    <Text key={item.recordID} variant="bodySmall" numberOfLines={1} className={item.isCompleted ? 'line-through' : ''}>{item.isCompleted ? '☑' : '☐'} {item.title || '(untitled)'}</Text>
                )) : <Text variant="bodySmall" numberOfLines={2} className="mt-1">{note.body || 'No note content'}</Text>}
                <Text variant="bodySmall" className="mt-1">Updated {new Date(note.updatedAt).toLocaleDateString()}</Text>
            </Card>
        );
    };

    const renderTask = (task: Task, completed = false) => (
        <Pressable key={task.recordID} onPress={() => openTask(task.recordID)} className="flex-row items-center border-b border-slate-200 py-2 active:opacity-70 dark:border-slate-800">
            <MaterialCommunityIcons name={completed ? 'check-circle-outline' : 'circle-outline'} size={22} color={completed ? theme.primary : theme.onSurfaceVariant} />
            <View className="min-w-0 flex-1 pl-3">
                <Text className={completed ? 'line-through text-slate-500 dark:text-slate-400' : ''} numberOfLines={1}>{task.title || '(untitled)'}</Text>
                {task.dueDate || task.isRecurring ? <Text variant="bodySmall">{task.dueDate ? formatDueDate(task.dueDate) : 'Recurring'}</Text> : null}
            </View>
            <Checkbox status={completed ? 'checked' : 'unchecked'} onPress={() => toggleTask(task, completed)} accessibilityLabel={`Mark ${task.title || 'task'} ${completed ? 'open' : 'complete'}`} />
        </Pressable>
    );

    if (!project) {
        return <View className="flex-1 items-center justify-center p-6" style={{ backgroundColor: theme.background }}><Text>Project not found.</Text></View>;
    }

    return (
        <View className="flex-1" style={{ backgroundColor: theme.background }}>
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: tabBarHeight + 24, gap: 12 }} keyboardShouldPersistTaps="handled">
                <Card className="rounded-3xl p-4">
                    <View className="mb-2 h-11 w-11 items-center justify-center rounded-2xl bg-indigo-100 dark:bg-indigo-950">
                        <MaterialCommunityIcons name="folder-outline" size={23} color={theme.primary} />
                    </View>
                    <TextField placeholder="Project name" value={name} onChangeText={setName} onBlur={() => updateProject(id, { name })} inputClassName="text-2xl font-semibold" className="border-0" />
                    <TextField placeholder="Add a short description" value={description} onChangeText={setDescription} onBlur={() => updateProject(id, { description })} multiline inputClassName="min-h-20" className="mt-2 border-0" />
                    <View className="mt-3 flex-row gap-6 border-t border-slate-200 pt-3 dark:border-slate-800">
                        <Stat value={projectNotes.length} label="Notes" />
                        <Stat value={openTasks.length} label="Open tasks" />
                        <Stat value={completedTasks.length} label="Completed" />
                    </View>
                </Card>

                <View className="flex-row flex-wrap items-center gap-2 rounded-3xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                    <Button variant="tonal" compact icon={<MaterialCommunityIcons name="note-plus-outline" size={17} color={theme.primary} />} onPress={addNote}>Add note</Button>
                    <Button variant="tonal" compact icon={<MaterialCommunityIcons name="checkbox-marked-circle-outline" size={17} color={theme.primary} />} onPress={addTask}>Add task</Button>
                    <Button variant="text" compact icon={<MaterialCommunityIcons name="share-variant-outline" size={17} color={theme.primary} />} onPress={() => setShareDialogOpen(true)}>Share</Button>
                </View>

                <Divider className="my-2" />
                <SectionHeader title="Notes" subtitle={`${projectNotes.length} active ${projectNotes.length === 1 ? 'note' : 'notes'}`} onAdd={addNote} />
                {projectNotes.length === 0 ? <EmptySection icon="note-plus-outline" text="No notes in this project yet." themeColor={theme.primary} /> : projectNotes.map((note) => renderNote(note))}

                {projectArchivedNotes.length > 0 ? (
                    <Card className="mb-1 p-2">
                        <DisclosureRow title={`Archived notes (${projectArchivedNotes.length})`} open={showArchived} onPress={() => setShowArchived((value) => !value)} />
                        {showArchived ? projectArchivedNotes.map((note) => renderNote(note, true)) : null}
                    </Card>
                ) : null}

                <SectionHeader title="Tasks" subtitle={`${openTasks.length} open · ${completedTasks.length} completed`} onAdd={addTask} />
                {projectTasks.length === 0 ? <EmptySection icon="checkbox-outline" text="No tasks in this project yet." themeColor={theme.primary} /> : (
                    <Card className="mb-2 p-4">
                        {openTasks.map((task) => renderTask(task))}
                        {completedTasks.length > 0 ? (
                            <View className="mt-1 border-t border-slate-200 pt-1 dark:border-slate-800">
                                <DisclosureRow title={`Completed (${completedTasks.length})`} open={showCompleted} onPress={() => setShowCompleted((value) => !value)} />
                                {showCompleted ? completedTasks.map((task) => renderTask(task, true)) : null}
                            </View>
                        ) : null}
                    </Card>
                )}
            </ScrollView>

            <ShareProjectDialog visible={shareDialogOpen} projectId={id} onClose={() => setShareDialogOpen(false)} />
            <Snackbar visible={!!actionError} onDismiss={() => setActionError(null)} onAction={() => setActionError(null)} bottomOffset={tabBarHeight + 24}>{actionError}</Snackbar>
        </View>
    );
}

function Stat({ value, label }: { value: number; label: string }) {
    return <View className="gap-0.5"><Text variant="title">{value}</Text><Text variant="bodySmall">{label}</Text></View>;
}

function SectionHeader({ title, subtitle, onAdd }: { title: string; subtitle: string; onAdd: () => void }) {
    return <View className="mt-2 flex-row items-center justify-between"><View><Text variant="titleLarge">{title}</Text><Text variant="bodySmall">{subtitle}</Text></View><Button variant="text" compact onPress={onAdd}>Add</Button></View>;
}

function DisclosureRow({ title, open, onPress }: { title: string; open: boolean; onPress: () => void }) {
    return <Pressable onPress={onPress} className="flex-row items-center py-2 active:opacity-70"><MaterialCommunityIcons name={open ? 'chevron-up' : 'chevron-down'} size={20} color="#64748b" /><Text className="font-semibold">{title}</Text></Pressable>;
}

function EmptySection({ icon, text, themeColor }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; text: string; themeColor: string }) {
    return <View className="min-h-18 flex-row items-center gap-2 rounded-2xl bg-slate-100 px-3 dark:bg-slate-800"><MaterialCommunityIcons name={icon} size={22} color={themeColor} /><Text variant="bodySmall">{text}</Text></View>;
}
