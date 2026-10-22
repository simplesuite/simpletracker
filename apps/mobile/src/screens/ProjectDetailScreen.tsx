import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import type { CompositeNavigationProp, RouteProp } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNoteStore, useProjectStore, useTaskStore } from '@simpletracker/core';
import type { Note, Task } from '@simpletracker/core';
import { Button, Card, Checkbox, Dialog, Divider, Snackbar, Text, TextField, getUiTheme } from '@simpletracker/ui';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ProjectsStackParamList, RootTabParamList } from '../navigation/types';
import { ShareProjectDialog } from '../components/ShareProjectDialog';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import { redirectToCheckout, useEntitlement } from '../lib/entitlement';

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
    const hasTime = date.getHours() !== 0 || date.getMinutes() !== 0;
    const timeSuffix = hasTime ? ` ${date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}` : '';
    const dateLabel = date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
    if (diffDays < 0) return `${dateLabel}${timeSuffix}`;
    if (diffDays === 0) return `Today${timeSuffix}`;
    if (diffDays === 1) return `Tomorrow${timeSuffix}`;
    if (diffDays <= 7) return `${date.toLocaleDateString(undefined, { weekday: 'short' })}${timeSuffix}`;
    return `${dateLabel}${timeSuffix}`;
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
    const userId = useAuthStore((s) => s.userId);
    const project = useProjectStore((s) => s.projects.find((p) => p.recordID === id));
    const updateProject = useProjectStore((s) => s.updateProject);
    const deleteProject = useProjectStore((s) => s.deleteProject);
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
    const deleteTask = useTaskStore((s) => s.deleteTask);
    const [name, setName] = useState(project?.name ?? '');
    const [description, setDescription] = useState(project?.description ?? '');
    const [showArchived, setShowArchived] = useState(false);
    const [showCompleted, setShowCompleted] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [shareDialogOpen, setShareDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deleteCompletedDialogOpen, setDeleteCompletedDialogOpen] = useState(false);
    const [deletingCompleted, setDeletingCompleted] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [actionError, setActionError] = useState<string | null>(null);
    const handlingBackRef = useRef(false);
    const nameRef = useRef(name);
    const descriptionRef = useRef(description);
    nameRef.current = name;
    descriptionRef.current = description;
    const { subscriptionState, loading: entitlementLoading } = useEntitlement();

    const isBlankProject = () => {
        const hasContent = notes.some((note) => note.projectID === id)
            || sharedNotes.some((note) => note.projectID === id)
            || archivedNotes.some((note) => note.projectID === id)
            || tasks.some((task) => task.projectID === id);
        return (nameRef.current.trim().length === 0 || nameRef.current.trim() === 'Untitled project')
            && descriptionRef.current.trim().length === 0
            && !hasContent;
    };

    useEffect(() => {
        const unsubscribe = navigation.addListener('beforeRemove', (event) => {
            if (!project || handlingBackRef.current) return;

            event.preventDefault();
            handlingBackRef.current = true;
            void (async () => {
                const success = isBlankProject()
                    ? await deleteProject(id)
                    : await updateProject(id, { name: nameRef.current, description: descriptionRef.current });
                if (success) navigation.dispatch(event.data.action);
                else {
                    handlingBackRef.current = false;
                    setActionError(useProjectStore.getState().error ?? 'Unable to save project.');
                }
            })();
        });
        return unsubscribe;
    }, [navigation, project?.recordID, id, notes, sharedNotes, archivedNotes, tasks, deleteProject, updateProject]);

    useEffect(() => {
        if (project) {
            setName(project.name);
            setDescription(project.description);
        }
    }, [project?.recordID, project?.name, project?.description]);

    const isCreator = project?.creatorID === userId;

    useLayoutEffect(() => {
        navigation.setOptions({
            headerRight: isCreator ? () => (
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="More project options"
                    hitSlop={10}
                    onPress={() => setMenuOpen(true)}
                    className="rounded-xl p-2 active:opacity-70"
                >
                    <MaterialCommunityIcons name="dots-vertical" size={24} color={theme.onSurface} />
                </Pressable>
            ) : undefined,
        });

        return () => navigation.setOptions({ headerRight: undefined });
    }, [navigation, theme.onSurface, isCreator]);
    const query = searchQuery.trim().toLowerCase();
    const projectNotes = useMemo(() => {
        const uniqueNotes = Array.from(new Map([...notes, ...sharedNotes].map((note) => [note.recordID, note])).values())
            .filter((note) => note.projectID === id)
            .sort((a, b) => Number(b.pinned) - Number(a.pinned));
        if (!query) return uniqueNotes;
        return uniqueNotes.filter((note) => note.title.toLowerCase().includes(query) || note.body.toLowerCase().includes(query));
    }, [notes, sharedNotes, id, query]);
    const projectArchivedNotes = useMemo(() => {
        const filtered = archivedNotes.filter((note) => note.projectID === id);
        if (!query) return filtered;
        return filtered.filter((note) => note.title.toLowerCase().includes(query) || note.body.toLowerCase().includes(query));
    }, [archivedNotes, id, query]);
    const projectTasks = useMemo(() => {
        const filtered = tasks.filter((task) => task.projectID === id);
        if (!query) return filtered;
        return filtered.filter((task) => task.title.toLowerCase().includes(query) || task.body.toLowerCase().includes(query));
    }, [tasks, id, query]);
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

    const handleShareProject = async () => {
        if (entitlementLoading) {
            setActionError('Checking your plan…');
            return;
        }
        if (subscriptionState === 'free') {
            try {
                await redirectToCheckout();
            } catch (error) {
                setActionError(error instanceof Error ? error.message : 'Unable to start Pro checkout.');
            }
            return;
        }
        setShareDialogOpen(true);
    };

    const handleDeleteProject = async () => {
        setDeleteDialogOpen(false);
        handlingBackRef.current = true;
        const success = await deleteProject(id);
        if (success) navigation.goBack();
        else {
            handlingBackRef.current = false;
            setActionError(useProjectStore.getState().error ?? 'Unable to delete project.');
        }
    };

    const handleDeleteCompleted = async () => {
        setDeleteCompletedDialogOpen(false);
        setDeletingCompleted(true);
        let failed = 0;
        for (const task of completedTasks) {
            if (!(await deleteTask(task.recordID))) failed += 1;
        }
        setDeletingCompleted(false);
        if (failed > 0) setActionError(`Unable to delete ${failed} ${failed === 1 ? 'task' : 'tasks'}.`);
    };

    // Compact note card for the 2-column grid, mirroring the web project page.
    const renderNote = (note: Note, archived = false) => {
        const items = listItems[note.recordID] ?? [];
        return (
            <Card key={note.recordID} onPress={() => openNote(note.recordID)} className={`w-[48%] p-3 ${archived ? 'opacity-60' : ''}`}>
                <View className="flex-row items-center gap-1">
                    {note.pinned ? <MaterialCommunityIcons name="pin" size={13} color={theme.primary} /> : null}
                    <MaterialCommunityIcons name={note.noteType === 'list' ? 'format-list-checks' : 'note-text-outline'} size={13} color={theme.onSurfaceVariant} />
                    <Text variant="bodySmall" numberOfLines={1} className="min-w-0 flex-1 font-semibold text-on-surface dark:text-on-surface-dark">{note.title || 'Untitled'}</Text>
                </View>
                {note.noteType === 'list' ? (
                    <View className="mt-1">
                        {items.slice(0, 2).map((item) => (
                            <Text key={item.recordID} variant="bodySmall" numberOfLines={1} className={`text-xs ${item.isCompleted ? 'line-through opacity-60' : ''}`}>{item.isCompleted ? '☑' : '☐'} {item.title || 'Untitled'}</Text>
                        ))}
                    </View>
                ) : note.body ? (
                    <Text variant="bodySmall" numberOfLines={2} className="mt-1 text-xs">{note.body}</Text>
                ) : null}
                <Text variant="bodySmall" className="mt-1 text-xs">{new Date(note.updatedAt).toLocaleDateString()}</Text>
            </Card>
        );
    };

    const MetaChip = ({ label, tone = 'default', icon }: { label: string; tone?: 'default' | 'error' | 'secondary'; icon?: keyof typeof MaterialCommunityIcons.glyphMap }) => {
        const toneClasses = {
            default: 'border-outline-variant dark:border-outline-variant-dark',
            error: 'border-error dark:border-error-dark',
            secondary: 'border-secondary dark:border-secondary',
        }[tone];
        const toneText = {
            default: 'text-on-surface-variant dark:text-on-surface-variant-dark',
            error: 'text-error dark:text-error-dark',
            secondary: 'text-secondary dark:text-secondary',
        }[tone];
        const iconColor = { default: theme.onSurfaceVariant, error: theme.error, secondary: theme.secondary }[tone];
        return (
            <View className={`flex-row items-center self-start rounded-full border px-2 py-0.5 ${toneClasses}`}>
                {icon ? <MaterialCommunityIcons name={icon} size={12} color={iconColor} style={{ marginRight: 3 }} /> : null}
                <Text numberOfLines={1} className={`text-xs font-medium ${toneText}`}>{label}</Text>
            </View>
        );
    };

    const renderTask = (task: Task, completed = false) => {
        const isOverdue = !completed && task.dueDate != null && task.dueDate < new Date().setHours(0, 0, 0, 0);
        return (
            <View key={task.recordID} className="flex-row items-center border-b border-outline-variant py-2 dark:border-outline-variant-dark">
                <Checkbox status={completed ? 'checked' : 'unchecked'} onPress={() => toggleTask(task, completed)} accessibilityLabel={`Mark ${task.title || 'task'} ${completed ? 'open' : 'complete'}`} />
                <Pressable onPress={() => openTask(task.recordID)} className="min-w-0 flex-1 pl-3 active:opacity-70">
                    <Text className={completed ? 'line-through text-on-surface-variant dark:text-on-surface-variant-dark' : ''} numberOfLines={1}>{task.title || '(untitled)'}</Text>
                    {task.dueDate != null || task.isRecurring ? (
                        <View className="mt-1 flex-row flex-wrap items-center gap-1.5">
                            {task.dueDate != null && <MetaChip label={formatDueDate(task.dueDate)} tone={isOverdue ? 'error' : 'default'} icon="calendar-outline" />}
                            {task.isRecurring && <MetaChip label="Recurring" tone="secondary" icon="repeat" />}
                        </View>
                    ) : null}
                </Pressable>
            </View>
        );
    };

    if (!project) {
        return <View className="flex-1 items-center justify-center p-6" style={{ backgroundColor: theme.background }}><Text>Project not found.</Text></View>;
    }

    return (
        <View className="flex-1" style={{ backgroundColor: theme.background }}>
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: tabBarHeight + 24, gap: 12 }} keyboardShouldPersistTaps="handled">
                <TextField
                    placeholder="Search notes and tasks"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    autoCapitalize="none"
                    leading={<MaterialCommunityIcons name="magnify" size={19} color={theme.onSurfaceVariant} />}
                    trailing={searchQuery ? <Pressable accessibilityLabel="Clear project search" onPress={() => setSearchQuery('')}><MaterialCommunityIcons name="close" size={18} color={theme.onSurfaceVariant} /></Pressable> : null}
                />
                <View className="gap-1">
                    <TextField placeholder="Untitled" value={name} onChangeText={setName} onBlur={() => updateProject(id, { name })} borderless inputClassName="text-3xl font-bold" />
                    <TextField placeholder="Add a short description" value={description} onChangeText={setDescription} onBlur={() => updateProject(id, { description })} multiline borderless inputClassName="min-h-0" />
                </View>

                <Divider className="my-2" />
                <SectionHeader title="Notes" subtitle={`${projectNotes.length} active ${projectNotes.length === 1 ? 'note' : 'notes'}`} onAdd={addNote} />
                {projectNotes.length === 0 ? <EmptySection icon={query ? 'magnify' : 'note-plus-outline'} text={query ? 'No matching notes.' : 'No notes in this project yet.'} themeColor={theme.primary} /> : (
                    <View className="flex-row flex-wrap gap-2">{projectNotes.map((note) => renderNote(note))}</View>
                )}

                {projectArchivedNotes.length > 0 ? (
                    <View>
                        <DisclosureRow title={`Archived notes (${projectArchivedNotes.length})`} open={showArchived} onPress={() => setShowArchived((value) => !value)} iconColor={theme.onSurfaceVariant} />
                        {showArchived ? <View className="flex-row flex-wrap gap-2">{projectArchivedNotes.map((note) => renderNote(note, true))}</View> : null}
                    </View>
                ) : null}

                <SectionHeader title="Tasks" subtitle={`${openTasks.length} open · ${completedTasks.length} completed`} onAdd={addTask} />
                {projectTasks.length === 0 ? <EmptySection icon={query ? 'magnify' : 'checkbox-outline'} text={query ? 'No matching tasks.' : 'No tasks in this project yet.'} themeColor={theme.primary} /> : (
                    <View>
                        {openTasks.map((task) => renderTask(task))}
                        {completedTasks.length > 0 ? (
                            <View className="mt-1">
                                <View className="flex-row items-center justify-between">
                                    <DisclosureRow title={`Completed (${completedTasks.length})`} open={showCompleted} onPress={() => setShowCompleted((value) => !value)} iconColor={theme.onSurfaceVariant} />
                                    <Button variant="danger" compact onPress={() => setDeleteCompletedDialogOpen(true)}>Delete all</Button>
                                </View>
                                {showCompleted ? completedTasks.map((task) => renderTask(task, true)) : null}
                            </View>
                        ) : null}
                    </View>
                )}
            </ScrollView>

            <Dialog
                visible={menuOpen}
                onDismiss={() => setMenuOpen(false)}
                title="More options"
                actions={<Button variant="text" compact onPress={() => setMenuOpen(false)}>Close</Button>}
            >
                <View className="gap-2">
                    <Text variant="label">Actions</Text>
                    <Button
                        variant="outlined"
                        compact
                        className="justify-start"
                        icon={<MaterialCommunityIcons name="share-variant-outline" size={18} color={theme.primary} />}
                        onPress={() => { setMenuOpen(false); void handleShareProject(); }}
                    >
                        {entitlementLoading ? 'Checking plan…' : subscriptionState === 'free' ? 'Share (Pro)' : 'Share'}
                    </Button>
                    <Button
                        variant="danger"
                        compact
                        className="justify-start"
                        icon={<MaterialCommunityIcons name="delete-outline" size={18} color={theme.error} />}
                        onPress={() => { setMenuOpen(false); setDeleteDialogOpen(true); }}
                    >
                        Delete
                    </Button>
                </View>
            </Dialog>
            <Dialog
                visible={deleteDialogOpen}
                onDismiss={() => setDeleteDialogOpen(false)}
                title="Delete project?"
                actions={(
                    <>
                        <Button variant="text" compact onPress={() => setDeleteDialogOpen(false)}>Cancel</Button>
                        <Button variant="danger" compact onPress={handleDeleteProject}>Delete</Button>
                    </>
                )}
            >
                <Text>Delete “{project.name}”? The project will be removed, but its notes and tasks will remain without a project.</Text>
            </Dialog>
            <Dialog
                visible={deleteCompletedDialogOpen}
                onDismiss={() => setDeleteCompletedDialogOpen(false)}
                title="Delete completed tasks?"
                actions={(
                    <>
                        <Button variant="text" compact onPress={() => setDeleteCompletedDialogOpen(false)}>Cancel</Button>
                        <Button variant="danger" compact loading={deletingCompleted} onPress={handleDeleteCompleted}>Delete all</Button>
                    </>
                )}
            >
                <Text>Delete {completedTasks.length} completed {completedTasks.length === 1 ? 'task' : 'tasks'} in this project? This cannot be undone.</Text>
            </Dialog>

            {isCreator ? <ShareProjectDialog visible={shareDialogOpen} projectId={id} onClose={() => setShareDialogOpen(false)} /> : null}
            <Snackbar visible={!!actionError} onDismiss={() => setActionError(null)} onAction={() => setActionError(null)} bottomOffset={tabBarHeight + 24}>{actionError}</Snackbar>
        </View>
    );
}

function SectionHeader({ title, subtitle, onAdd }: { title: string; subtitle: string; onAdd: () => void }) {
    return <View className="mt-2 flex-row items-center justify-between"><View><Text variant="titleLarge">{title}</Text><Text variant="bodySmall">{subtitle}</Text></View><Button variant="text" compact onPress={onAdd}>Add</Button></View>;
}

function DisclosureRow({ title, open, onPress, iconColor }: { title: string; open: boolean; onPress: () => void; iconColor: string }) {
    return <Pressable onPress={onPress} className="flex-row items-center py-2 active:opacity-70"><MaterialCommunityIcons name={open ? 'chevron-up' : 'chevron-down'} size={20} color={iconColor} /><Text className="font-semibold">{title}</Text></Pressable>;
}

function EmptySection({ icon, text, themeColor }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; text: string; themeColor: string }) {
    return <View className="min-h-18 flex-row items-center gap-2 rounded-2xl bg-surface-variant px-3 dark:bg-surface-variant-dark"><MaterialCommunityIcons name={icon} size={22} color={themeColor} /><Text variant="bodySmall">{text}</Text></View>;
}
