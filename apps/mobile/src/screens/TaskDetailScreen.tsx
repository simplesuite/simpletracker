import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import type { RouteProp } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTaskStore, useProjectStore } from '@simpletracker/core';
import { Button, Card, Checkbox, Dialog, Pill, Radio, Snackbar, Switch, Text, TextField, getUiTheme } from '@simpletracker/ui';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { TasksStackParamList } from '../navigation/types';
import dayjs from 'dayjs';
import { useThemeStore } from '../store/themeStore';

type RecurrenceUnit = 'minutes' | 'hours' | 'days' | 'weeks' | 'months';

export function TaskDetailScreen() {
    const tabBarHeight = useBottomTabBarHeight();
    const { effectiveTheme } = useThemeStore();
    const theme = getUiTheme(effectiveTheme);
    const route = useRoute<RouteProp<TasksStackParamList, 'TaskDetail'>>();
    const navigation = useNavigation();
    const { id } = route.params;

    const task = useTaskStore((s) => s.tasks.find((t) => t.recordID === id));
    const updateTask = useTaskStore((s) => s.updateTask);
    const completeTask = useTaskStore((s) => s.completeTask);
    const reopenTask = useTaskStore((s) => s.reopenTask);
    const deleteTask = useTaskStore((s) => s.deleteTask);
    const fetchSubtasks = useTaskStore((s) => s.fetchSubtasks);
    const subtasks = useTaskStore((s) => s.subtasks[id]) ?? [];
    const addSubtask = useTaskStore((s) => s.addSubtask);
    const toggleSubtask = useTaskStore((s) => s.toggleSubtask);
    const deleteSubtask = useTaskStore((s) => s.deleteSubtask);
    const updateSubtaskTitle = useTaskStore((s) => s.updateSubtaskTitle);
    const projects = useProjectStore((s) => s.projects);

    const [title, setTitle] = useState(task?.title ?? '');
    const [body, setBody] = useState(task?.body ?? '');
    const [dueDate, setDueDate] = useState<string | undefined>(task?.dueDate ? dayjs(task.dueDate).format('YYYY-MM-DD') : undefined);
    const [dueTime, setDueTime] = useState<string | undefined>(task?.dueDate ? dayjs(task.dueDate).format('HH:mm') : undefined);
    const [projectID, setProjectID] = useState<string | ''>(task?.projectID ?? '');
    const [isRecurring, setIsRecurring] = useState(task?.isRecurring ?? false);
    const [recurrenceInterval, setRecurrenceInterval] = useState(task?.recurrenceInterval ?? 1);
    const [recurrenceUnit, setRecurrenceUnit] = useState<RecurrenceUnit>(task?.recurrenceUnit ?? 'days');
    const [recurrenceAnchor, setRecurrenceAnchor] = useState<'due_date' | 'completed_date'>(task?.recurrenceAnchor ?? 'due_date');
    const [titleError, setTitleError] = useState<string | null>(null);
    const [subtaskInput, setSubtaskInput] = useState('');
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [dateDialogOpen, setDateDialogOpen] = useState(false);
    const [timeDialogOpen, setTimeDialogOpen] = useState(false);
    const [projectDialogOpen, setProjectDialogOpen] = useState(false);
    const [dateInput, setDateInput] = useState(dueDate ?? dayjs().format('YYYY-MM-DD'));
    const [timeInput, setTimeInput] = useState(dueTime ?? dayjs().startOf('hour').format('HH:mm'));
    const [scheduleError, setScheduleError] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);

    const titleRef = useRef(title);
    const bodyRef = useRef(body);
    const dueDateRef = useRef(dueDate);
    const dueTimeRef = useRef(dueTime);
    const projectIDRef = useRef(projectID);
    const isRecurringRef = useRef(isRecurring);
    const recurrenceIntervalRef = useRef(recurrenceInterval);
    const recurrenceUnitRef = useRef(recurrenceUnit);
    const recurrenceAnchorRef = useRef(recurrenceAnchor);
    titleRef.current = title;
    bodyRef.current = body;
    dueDateRef.current = dueDate;
    dueTimeRef.current = dueTime;
    projectIDRef.current = projectID;
    isRecurringRef.current = isRecurring;
    recurrenceIntervalRef.current = recurrenceInterval;
    recurrenceUnitRef.current = recurrenceUnit;
    recurrenceAnchorRef.current = recurrenceAnchor;

    const saveTask = useCallback(async () => {
        if (!id) return;
        let dueDateValue: number | null = null;
        if (dueDateRef.current && dueTimeRef.current) {
            dueDateValue = dayjs(`${dueDateRef.current} ${dueTimeRef.current}`, 'YYYY-MM-DD HH:mm').valueOf();
        } else if (dueDateRef.current) {
            dueDateValue = dayjs(dueDateRef.current).startOf('day').valueOf();
        }
        await updateTask(id, {
            title: titleRef.current,
            body: bodyRef.current,
            dueDate: dueDateValue,
            projectID: projectIDRef.current || null,
            isRecurring: isRecurringRef.current,
            recurrenceInterval: isRecurringRef.current ? recurrenceIntervalRef.current : null,
            recurrenceUnit: isRecurringRef.current ? recurrenceUnitRef.current : null,
            recurrenceAnchor: isRecurringRef.current ? recurrenceAnchorRef.current : 'due_date',
        });
    }, [id, updateTask]);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (task) saveTask();
        }, 1000);
        return () => clearTimeout(timer);
    }, [title, body, dueDate, dueTime, projectID, isRecurring, recurrenceInterval, recurrenceUnit, recurrenceAnchor, task, saveTask]);

    useEffect(() => {
        if (id) fetchSubtasks(id);
    }, [id, fetchSubtasks]);

    const handleAddSubtask = async () => {
        if (!subtaskInput.trim() || !id) return;
        const result = await addSubtask(id, subtaskInput.trim());
        if (result) setSubtaskInput('');
    };
    const handleDeleteTask = async () => {
        setDeleteDialogOpen(false);
        if (!id) return;
        await deleteTask(id);
        navigation.goBack();
    };
    const handleBack = async () => {
        await saveTask();
        if (!title.trim() && !body.trim()) setDeleteDialogOpen(true);
        else navigation.goBack();
    };
    const handleDateSave = () => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
            setScheduleError('Use the date format YYYY-MM-DD.');
            return;
        }
        const parsed = dayjs(dateInput);
        if (!parsed.isValid() || parsed.format('YYYY-MM-DD') !== dateInput) {
            setScheduleError('Enter a valid calendar date.');
            return;
        }
        setDueDate(dateInput);
        setScheduleError(null);
        setDateDialogOpen(false);
    };

    const handleTimeSave = () => {
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(timeInput)) {
            setScheduleError('Use the time format HH:mm, for example 09:30.');
            return;
        }
        setDueTime(timeInput);
        setScheduleError(null);
        setTimeDialogOpen(false);
    };

    const clearDueDate = () => {
        setDueDate(undefined);
        setDueTime(undefined);
        setIsRecurring(false);
        setRecurrenceUnit('days');
        setDateDialogOpen(false);
        setScheduleError(null);
    };

    const clearDueTime = () => {
        setDueTime(undefined);
        if (recurrenceUnit === 'minutes' || recurrenceUnit === 'hours') setRecurrenceUnit('days');
        setTimeDialogOpen(false);
        setScheduleError(null);
    };

    const selectProject = (nextProjectID: string) => {
        setProjectID(nextProjectID);
        setProjectDialogOpen(false);
    };

    const handleTaskCompletion = async () => {
        const success = isCompleted ? await reopenTask(id) : await completeTask(id);
        if (success) navigation.goBack();
        else setActionError(useTaskStore.getState().error ?? 'Unable to update task.');
    };

    const isTaskBlank = () => title.trim().length === 0 && body.trim().length === 0;
    const isCompleted = task?.status === 'completed';
    const iconColor = theme.secondary;

    return (
        <View className="flex-1" style={{ backgroundColor: theme.background }}>
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: tabBarHeight + 24, gap: 12 }} keyboardShouldPersistTaps="handled">
                <Card className="rounded-3xl p-2">
                    <TextField
                        placeholder="Task title"
                        value={title}
                        onChangeText={(text) => {
                            setTitle(text);
                            setTitleError(text.trim().length > 255 ? 'Title must not exceed 255 characters' : null);
                        }}
                        error={!!titleError}
                        helperText={titleError ?? undefined}
                        inputClassName="text-2xl font-semibold"
                    />
                    <View className="flex-row flex-wrap gap-2 px-2 pb-2 pt-2">
                        <Pill compact icon={<MaterialCommunityIcons name={isCompleted ? 'check-circle-outline' : 'checkbox-marked-circle-outline'} size={15} color={iconColor} />}>{isCompleted ? 'Completed task' : 'Open task'}</Pill>
                        {isRecurring ? <Pill compact icon={<MaterialCommunityIcons name="repeat" size={15} color={iconColor} />}>Recurring</Pill> : null}
                    </View>
                </Card>

                <Card className="p-4">
                    <View className="mb-3">
                        <Text variant="title">Notes</Text>
                        <Text variant="bodySmall">Optional details</Text>
                    </View>
                    <TextField placeholder="Add context or details…" value={body} onChangeText={setBody} multiline inputClassName="min-h-28" />
                </Card>

                <Card className="p-4">
                    <View className="mb-3 flex-row items-center justify-between gap-3">
                        <View>
                            <Text variant="title">Details</Text>
                            <Text variant="bodySmall">Schedule and organization</Text>
                        </View>
                        {isRecurring ? <Pill compact icon={<MaterialCommunityIcons name="repeat" size={15} color={iconColor} />}>Repeats</Pill> : null}
                    </View>
                    <View className="mb-3 mt-1">
                        <Text variant="label" className="mb-1">Due date</Text>
                        <Pressable onPress={() => { setDateInput(dueDate ?? dayjs().format('YYYY-MM-DD')); setDateDialogOpen(true); }}>
                            <TextField placeholder="No due date" value={dueDate ?? ''} editable={false} trailing={<MaterialCommunityIcons name="calendar-outline" size={20} color={theme.onSurfaceVariant} />} />
                        </Pressable>
                    </View>
                    {dueDate ? (
                        <View className="mb-3 mt-1">
                            <Text variant="label" className="mb-1">Time</Text>
                            <Pressable onPress={() => { setTimeInput(dueTime ?? dayjs().startOf('hour').format('HH:mm')); setTimeDialogOpen(true); }}>
                                <TextField placeholder="Any time" value={dueTime ?? ''} editable={false} trailing={<MaterialCommunityIcons name="clock-outline" size={20} color={theme.onSurfaceVariant} />} />
                            </Pressable>
                        </View>
                    ) : null}
                    <View className="mb-0 mt-1">
                        <Text variant="label" className="mb-1">Project</Text>
                        <Pressable onPress={() => setProjectDialogOpen(true)}>
                            <TextField placeholder="No project" value={projects.find((p) => p.recordID === projectID)?.name ?? ''} editable={false} trailing={<MaterialCommunityIcons name="folder-outline" size={20} color={theme.onSurfaceVariant} />} />
                        </Pressable>
                    </View>
                </Card>

                {dueDate ? (
                    <Card className="p-4">
                        <View className="flex-row items-center justify-between gap-3">
                            <View className="min-w-0 flex-1">
                                <Text variant="title">Recurring task</Text>
                                <Text variant="bodySmall">Create the next occurrence when completed</Text>
                            </View>
                            <Switch value={isRecurring} onValueChange={setIsRecurring} accessibilityLabel="Recurring task" />
                        </View>
                        {isRecurring ? (
                            <View className="mt-4 rounded-2xl bg-surface-variant dark:bg-surface-variant-dark">
                                <View className="flex-row flex-wrap items-center gap-2">
                                    <Text>Every</Text>
                                    <TextField value={String(recurrenceInterval)} onChangeText={(text) => {
                                        const value = parseInt(text, 10);
                                        if (!isNaN(value) && value > 0 && value <= 365) setRecurrenceInterval(value);
                                    }} keyboardType="number-pad" className="w-16" />
                                    {(dueTime ? ['minutes', 'hours', 'days', 'weeks', 'months'] : ['days', 'weeks', 'months']).map((unit) => (
                                        <Pill key={unit} compact selected={recurrenceUnit === unit} onPress={() => setRecurrenceUnit(unit as RecurrenceUnit)}>{unit.slice(0, -1).replace(/^./, (value) => value.toUpperCase())}</Pill>
                                    ))}
                                </View>
                                <View className="mt-4">
                                    <Text variant="label">Repeat from</Text>
                                    <View className="mt-1">
                                        <PressableRow label="Due date" checked={recurrenceAnchor === 'due_date'} onPress={() => setRecurrenceAnchor('due_date')} />
                                        <PressableRow label="Completion date" checked={recurrenceAnchor === 'completed_date'} onPress={() => setRecurrenceAnchor('completed_date')} />
                                    </View>
                                </View>
                            </View>
                        ) : null}
                    </Card>
                ) : null}

                <Card className="p-4">
                    <View className="mb-3">
                        <Text variant="title">Subtasks</Text>
                        <Text variant="bodySmall">{subtasks.filter((s) => s.isCompleted).length} of {subtasks.length} complete</Text>
                    </View>
                    {subtasks.length === 0 ? <Text variant="bodySmall" className="py-2">Break this task into smaller steps.</Text> : null}
                    {subtasks.map((subtask) => (
                        <View key={subtask.recordID} className="flex-row items-center border-t border-outline-variant dark:border-outline-variant-dark">
                            <Checkbox status={subtask.isCompleted ? 'checked' : 'unchecked'} onPress={() => toggleSubtask(subtask.recordID)} accessibilityLabel={`Toggle ${subtask.title}`} />
                            <Text className={`min-w-0 flex-1 ${subtask.isCompleted ? 'text-on-surface-variant line-through dark:text-on-surface-variant-dark' : ''}`}>{subtask.title}</Text>
                            <Button variant="text" compact icon={<MaterialCommunityIcons name="delete-outline" size={19} color={theme.onSurfaceVariant} />} accessibilityLabel="Delete subtask" onPress={() => deleteSubtask(subtask.recordID)} />
                        </View>
                    ))}
                    <View className="mt-3 flex-row items-center gap-2">
                        <TextField placeholder="Add a subtask" value={subtaskInput} onChangeText={setSubtaskInput} className="min-w-0 flex-1" />
                        <Button compact onPress={handleAddSubtask} disabled={!subtaskInput.trim()}>Add</Button>
                    </View>
                </Card>

                <Card className="flex-row items-center justify-between gap-2 p-2">
                    <Button icon={<MaterialCommunityIcons name={isCompleted ? 'backup-restore' : 'check'} size={18} color={theme.onPrimary} />} onPress={handleTaskCompletion}>{isCompleted ? 'Reopen task' : 'Complete task'}</Button>
                    <Button variant="danger" icon={<MaterialCommunityIcons name="delete-outline" size={18} color={theme.error} />} onPress={() => setDeleteDialogOpen(true)}>Delete</Button>
                </Card>
            </ScrollView>

            <Dialog
                visible={dateDialogOpen}
                onDismiss={() => setDateDialogOpen(false)}
                title="Set due date"
                actions={(
                    <>
                        <Button variant="text" compact onPress={clearDueDate}>Clear</Button>
                        <Button variant="text" compact onPress={() => { setDateInput(dayjs().format('YYYY-MM-DD')); setScheduleError(null); }}>Today</Button>
                        <Button compact onPress={handleDateSave}>Save</Button>
                    </>
                )}
            >
                <TextField
                    label="Date"
                    value={dateInput}
                    onChangeText={(value) => { setDateInput(value); setScheduleError(null); }}
                    placeholder="YYYY-MM-DD"
                    autoCapitalize="none"
                    keyboardType="numbers-and-punctuation"
                    error={!!scheduleError}
                    helperText={scheduleError ?? 'Example: 2026-09-10'}
                />
            </Dialog>
            <Dialog
                visible={timeDialogOpen}
                onDismiss={() => setTimeDialogOpen(false)}
                title="Set due time"
                actions={(
                    <>
                        <Button variant="text" compact onPress={clearDueTime}>Clear</Button>
                        <Button variant="text" compact onPress={() => { setTimeInput(dayjs().startOf('hour').format('HH:mm')); setScheduleError(null); }}>Now</Button>
                        <Button compact onPress={handleTimeSave}>Save</Button>
                    </>
                )}
            >
                <TextField
                    label="Time"
                    value={timeInput}
                    onChangeText={(value) => { setTimeInput(value); setScheduleError(null); }}
                    placeholder="HH:mm"
                    autoCapitalize="none"
                    keyboardType="numbers-and-punctuation"
                    error={!!scheduleError}
                    helperText={scheduleError ?? 'Use 24-hour time, for example 09:30'}
                />
            </Dialog>
            <Dialog
                visible={projectDialogOpen}
                onDismiss={() => setProjectDialogOpen(false)}
                title="Assign project"
                actions={<Button variant="text" compact onPress={() => setProjectDialogOpen(false)}>Cancel</Button>}
            >
                <ScrollView className="max-h-80">
                    <Button variant={!projectID ? 'tonal' : 'outlined'} compact className="mb-2" onPress={() => selectProject('')}>No project</Button>
                    {projects.map((project) => (
                        <Button
                            key={project.recordID}
                            variant={projectID === project.recordID ? 'tonal' : 'outlined'}
                            compact
                            className="mb-2"
                            onPress={() => selectProject(project.recordID)}
                        >
                            {project.name}
                        </Button>
                    ))}
                    {projects.length === 0 ? <Text variant="bodySmall">Create a project first to assign this task.</Text> : null}
                </ScrollView>
            </Dialog>
            <Dialog
                visible={deleteDialogOpen}
                onDismiss={() => setDeleteDialogOpen(false)}
                title="Delete Task"
                actions={(
                    <>
                        <Button variant="text" compact onPress={() => setDeleteDialogOpen(false)}>Cancel</Button>
                        <Button variant="danger" compact onPress={handleDeleteTask}>Delete</Button>
                    </>
                )}
            >
                <Text>{isTaskBlank() ? 'This task is empty. Are you sure you want to delete it?' : 'Are you sure you want to delete this task?'}</Text>
            </Dialog>
            <Snackbar visible={!!actionError} onDismiss={() => setActionError(null)} onAction={() => setActionError(null)} bottomOffset={tabBarHeight + 24}>{actionError}</Snackbar>
        </View>
    );
}

function PressableRow({ label, checked, onPress }: { label: string; checked: boolean; onPress: () => void }) {
    return (
        <View className="flex-row items-center">
            <Radio checked={checked} onPress={onPress} accessibilityLabel={label} />
            <Text>{label}</Text>
        </View>
    );
}
