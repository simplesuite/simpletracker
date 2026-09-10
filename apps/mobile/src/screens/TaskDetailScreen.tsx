import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Platform, ScrollView, View } from 'react-native';
import DateTimePicker from '@expo/ui/community/datetime-picker';
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
    const [datePickerValue, setDatePickerValue] = useState<Date>(new Date());
    const [timePickerValue, setTimePickerValue] = useState<Date>(new Date());
    const [nativePickerMode, setNativePickerMode] = useState<'date' | 'time' | null>(null);
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
    const adjustDueDate = (days: number) => {
        const parsedDate = dueDate ? dayjs(dueDate) : dayjs();
        const baseDate = parsedDate.isValid() ? parsedDate : dayjs();
        setDueDate(baseDate.add(days, 'day').format('YYYY-MM-DD'));
    };
    const adjustDueTime = (hours: number) => {
        let baseTime = dayjs().startOf('hour');
        if (dueTime) {
            const [currentHours, currentMinutes] = dueTime.split(':').map(Number);
            if (Number.isInteger(currentHours) && Number.isInteger(currentMinutes) && currentHours >= 0 && currentHours <= 23 && currentMinutes >= 0 && currentMinutes <= 59) {
                baseTime = baseTime.hour(currentHours).minute(currentMinutes);
            }
        }
        setDueTime(baseTime.add(hours, 'hour').format('HH:mm'));
    };
    const getPickerDate = () => {
        const parsedDate = dueDate ? dayjs(dueDate) : dayjs();
        const baseDate = parsedDate.isValid() ? parsedDate : dayjs();
        if (!dueTime) return baseDate.startOf('hour').toDate();
        const [hours, minutes] = dueTime.split(':').map(Number);
        if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
            return baseDate.startOf('hour').toDate();
        }
        const pickerDate = baseDate.hour(hours).minute(minutes).second(0).millisecond(0).toDate();
        return Number.isNaN(pickerDate.getTime()) ? new Date() : pickerDate;
    };
    const openDatePicker = () => {
        const value = getPickerDate();
        setDatePickerValue(value);
        if (Platform.OS === 'android') setNativePickerMode('date');
        else setDateDialogOpen(true);
    };
    const openTimePicker = () => {
        const value = getPickerDate();
        setTimePickerValue(value);
        if (Platform.OS === 'android') setNativePickerMode('time');
        else setTimeDialogOpen(true);
    };
    const handleNativePickerValueChange = (mode: 'date' | 'time', value: Date) => {
        if (Number.isNaN(value.getTime())) {
            setNativePickerMode(null);
            return;
        }
        if (mode === 'date') setDueDate(dayjs(value).format('YYYY-MM-DD'));
        else setDueTime(dayjs(value).format('HH:mm'));
        setNativePickerMode(null);
    };
    const handleDateSave = () => {
        setDueDate(dayjs(datePickerValue).format('YYYY-MM-DD'));
        setDateDialogOpen(false);
    };

    const handleTimeSave = () => {
        setDueTime(dayjs(timePickerValue).format('HH:mm'));
        setTimeDialogOpen(false);
    };

    const clearDueDate = () => {
        setDueDate(undefined);
        setDueTime(undefined);
        setIsRecurring(false);
        setRecurrenceUnit('days');
        setDateDialogOpen(false);
        setNativePickerMode(null);
    };

    const clearDueTime = () => {
        setDueTime(undefined);
        if (recurrenceUnit === 'minutes' || recurrenceUnit === 'hours') setRecurrenceUnit('days');
        setTimeDialogOpen(false);
        setNativePickerMode(null);
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
                    <View className="px-2 pb-2">
                        <Text variant="label" className="mb-1">Project</Text>
                        <Pressable onPress={() => setProjectDialogOpen(true)}>
                            <TextField placeholder="No project" value={projects.find((p) => p.recordID === projectID)?.name ?? ''} editable={false} trailing={<MaterialCommunityIcons name="folder-outline" size={20} color={theme.onSurfaceVariant} />} />
                        </Pressable>
                    </View>
                    <Text variant="label" className="mb-1">Title</Text>
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
                        <Pill compact icon={<MaterialCommunityIcons name={isCompleted ? 'check-circle-outline' : 'checkbox-marked-circle-outline'} size={15} color={iconColor} />}>{isCompleted ? 'Completed' : 'Open'}</Pill>
                    </View>
                </Card>

                <Card className="p-4">
                    <View className="mb-3">
                        <Text variant="title">Notes</Text>
                    </View>
                    <TextField placeholder="Add context or details…" value={body} onChangeText={setBody} multiline inputClassName="min-h-28" />
                </Card>

                <Card className="p-4">
                    <View className="mb-3 flex-row items-center justify-between gap-3">
                        <View>
                            <Text variant="title">Due</Text>
                        </View>
                        {isRecurring ? <Pill compact icon={<MaterialCommunityIcons name="repeat" size={15} color={iconColor} />}>Repeats</Pill> : null}
                    </View>
                    <View className="mb-3 mt-1">
                        <View className="flex-row items-center gap-1">
                            <StepButton direction="down" color={theme.onSurfaceVariant} accessibilityLabel="Decrease due date by one day" onPress={() => adjustDueDate(-1)} />
                            <Pressable onPress={openDatePicker} className="min-w-0 flex-1">
                                <TextField
                                    placeholder="No due date"
                                    value={dueDate ?? ''}
                                    editable={false}
                                    trailing={(
                                        <View className="flex-row items-center gap-1">
                                            {dueDate ? <ClearButton color={theme.onSurfaceVariant} accessibilityLabel="Clear due date" onPress={clearDueDate} /> : null}
                                            <MaterialCommunityIcons name="calendar-outline" size={20} color={theme.onSurfaceVariant} />
                                        </View>
                                    )}
                                />
                            </Pressable>
                            <StepButton direction="up" color={theme.onSurfaceVariant} accessibilityLabel="Increase due date by one day" onPress={() => adjustDueDate(1)} />
                        </View>
                    </View>
                    {dueDate ? (
                        <>
                        <View className="mb-3 mt-1">
                            <View className="flex-row items-center gap-1">
                                <StepButton direction="down" color={theme.onSurfaceVariant} accessibilityLabel="Decrease due time by one hour" onPress={() => adjustDueTime(-1)} />
                                <Pressable onPress={openTimePicker} className="min-w-0 flex-1">
                                    <TextField
                                        placeholder="Any time"
                                        value={dueTime ?? ''}
                                        editable={false}
                                        trailing={(
                                            <View className="flex-row items-center gap-1">
                                                {dueTime ? <ClearButton color={theme.onSurfaceVariant} accessibilityLabel="Clear due time" onPress={clearDueTime} /> : null}
                                                <MaterialCommunityIcons name="clock-outline" size={20} color={theme.onSurfaceVariant} />
                                            </View>
                                        )}
                                    />
                                </Pressable>
                                <StepButton direction="up" color={theme.onSurfaceVariant} accessibilityLabel="Increase due time by one hour" onPress={() => adjustDueTime(1)} />
                            </View>
                        </View>
                        <View className="flex-row items-center justify-between gap-3">
                            <View className="min-w-0 flex-1">
                                <Text variant="title">Recurring task</Text>
                            </View>
                            <Switch value={isRecurring} onValueChange={setIsRecurring} accessibilityLabel="Recurring task" />
                        </View>
                        {isRecurring ? (
                            <View className="mt-4 p-4 rounded-2xl bg-surface-variant dark:bg-surface-variant-dark">
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
                        </>
                    ) : null}
                </Card>

                <Card className="p-4">
                    <View className="mb-3">
                        <Text variant="title">Subtasks</Text>
                        <Text variant="bodySmall">{subtasks.filter((s) => s.isCompleted).length} of {subtasks.length} complete</Text>
                    </View>
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

            {Platform.OS === 'android' && nativePickerMode ? (
                <DateTimePicker
                    mode={nativePickerMode}
                    value={nativePickerMode === 'date' ? datePickerValue : timePickerValue}
                    presentation="dialog"
                    positiveButton={{ label: 'Save' }}
                    negativeButton={{ label: 'Cancel' }}
                    is24Hour={nativePickerMode === 'time'}
                    accentColor={theme.primary}
                    onValueChange={(_, value) => handleNativePickerValueChange(nativePickerMode, value)}
                    onDismiss={() => setNativePickerMode(null)}
                />
            ) : null}
            {Platform.OS !== 'android' ? (
            <Dialog
                visible={dateDialogOpen}
                onDismiss={() => setDateDialogOpen(false)}
                title="Set due date"
                actions={<Button compact onPress={handleDateSave}>Save</Button>}
            >
                <View className="items-center">
                    <DateTimePicker
                        mode="date"
                        display="default"
                        presentation="inline"
                        value={datePickerValue}
                        accentColor={theme.primary}
                        themeVariant={effectiveTheme}
                        onChange={(_, value) => { if (value) setDatePickerValue(value); }}
                    />
                </View>
            </Dialog>
            ) : null}
            {Platform.OS !== 'android' ? (
            <Dialog
                visible={timeDialogOpen}
                onDismiss={() => setTimeDialogOpen(false)}
                title="Set due time"
                actions={<Button compact onPress={handleTimeSave}>Save</Button>}
            >
                <View className="items-center">
                    <DateTimePicker
                        mode="time"
                        display="default"
                        presentation="inline"
                        value={timePickerValue}
                        is24Hour
                        accentColor={theme.primary}
                        themeVariant={effectiveTheme}
                        onChange={(_, value) => { if (value) setTimePickerValue(value); }}
                    />
                </View>
            </Dialog>
            ) : null}
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

function ClearButton({ color, accessibilityLabel, onPress }: { color: string; accessibilityLabel: string; onPress: () => void }) {
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
            onPress={(event) => {
                event.stopPropagation();
                onPress();
            }}
            className="h-8 w-8 items-center justify-center rounded-lg active:bg-surface-variant dark:active:bg-surface-variant-dark"
        >
            <MaterialCommunityIcons name="close" size={18} color={color} />
        </Pressable>
    );
}

function StepButton({ direction, color, accessibilityLabel, onPress }: { direction: 'up' | 'down'; color: string; accessibilityLabel: string; onPress: () => void }) {
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
            onPress={onPress}
            className="h-10 w-10 items-center justify-center rounded-xl active:bg-surface-variant dark:active:bg-surface-variant-dark"
        >
            <MaterialCommunityIcons name={direction === 'up' ? 'chevron-up' : 'chevron-down'} size={24} color={color} />
        </Pressable>
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
