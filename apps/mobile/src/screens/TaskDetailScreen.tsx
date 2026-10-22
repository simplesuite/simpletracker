import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Pressable, Platform, ScrollView, View } from 'react-native';
import DateTimePicker from '@expo/ui/community/datetime-picker';
import type { RouteProp } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTaskStore, useProjectStore } from '@simpletracker/core';
import { Button, Checkbox, Dialog, Pill, Snackbar, Text, TextField, getUiTheme } from '@simpletracker/ui';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { TasksStackParamList } from '../navigation/types';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { useThemeStore } from '../store/themeStore';

// Required for dayjs to honor the explicit 'YYYY-MM-DD HH:mm' parse format below.
// Without it, dayjs ignores the format string and falls back to the native Date
// parser, which interprets 'YYYY-MM-DD HH:mm' inconsistently (invalid/offset dates
// on Hermes), causing mobile due dates to drift from the web app.
dayjs.extend(customParseFormat);

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
    // Only treat the stored timestamp as having a time if it isn't midnight;
    // a midnight due date means "no specific time" (mirrors the web task detail).
    const [dueTime, setDueTime] = useState<string | undefined>(() => deriveDueTime(task?.dueDate));
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
    const [menuOpen, setMenuOpen] = useState(false);

    const titleRef = useRef(title);
    const bodyRef = useRef(body);
    const dueDateRef = useRef(dueDate);
    const dueTimeRef = useRef(dueTime);
    const projectIDRef = useRef(projectID);
    const isRecurringRef = useRef(isRecurring);
    const recurrenceIntervalRef = useRef(recurrenceInterval);
    const recurrenceUnitRef = useRef(recurrenceUnit);
    const recurrenceAnchorRef = useRef(recurrenceAnchor);
    const handlingBackRef = useRef(false);
    titleRef.current = title;
    bodyRef.current = body;
    dueDateRef.current = dueDate;
    dueTimeRef.current = dueTime;
    projectIDRef.current = projectID;
    isRecurringRef.current = isRecurring;
    recurrenceIntervalRef.current = recurrenceInterval;
    recurrenceUnitRef.current = recurrenceUnit;
    recurrenceAnchorRef.current = recurrenceAnchor;

    const saveTask = useCallback(async (): Promise<boolean> => {
        if (!id) return false;
        let dueDateValue: number | null = null;
        if (dueDateRef.current && dueTimeRef.current) {
            dueDateValue = dayjs(`${dueDateRef.current} ${dueTimeRef.current}`, 'YYYY-MM-DD HH:mm').valueOf();
        } else if (dueDateRef.current) {
            dueDateValue = dayjs(dueDateRef.current).startOf('day').valueOf();
        }
        return updateTask(id, {
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
            if (task) void saveTask();
        }, 1000);
        return () => clearTimeout(timer);
    }, [title, body, dueDate, dueTime, projectID, isRecurring, recurrenceInterval, recurrenceUnit, recurrenceAnchor, task, saveTask]);

    useEffect(() => {
        if (id) fetchSubtasks(id);
    }, [id, fetchSubtasks]);

    useLayoutEffect(() => {
        navigation.setOptions({
            headerRight: () => (
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="More task options"
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

    const handleAddSubtask = async () => {
        if (!subtaskInput.trim() || !id) return;
        const result = await addSubtask(id, subtaskInput.trim());
        if (result) setSubtaskInput('');
    };
    const handleDeleteTask = async () => {
        setDeleteDialogOpen(false);
        if (!id) return;
        handlingBackRef.current = true;
        const success = await deleteTask(id);
        if (success) navigation.goBack();
        else {
            handlingBackRef.current = false;
            setActionError(useTaskStore.getState().error ?? 'Unable to delete task.');
        }
    };

    useEffect(() => {
        const unsubscribe = navigation.addListener('beforeRemove', (event) => {
            if (!task || handlingBackRef.current) return;

            event.preventDefault();
            handlingBackRef.current = true;
            void (async () => {
                const success = isTaskBlank()
                    ? await deleteTask(id)
                    : await saveTask();
                if (success) navigation.dispatch(event.data.action);
                else {
                    handlingBackRef.current = false;
                    setActionError(useTaskStore.getState().error ?? 'Unable to save task.');
                }
            })();
        });
        return unsubscribe;
    }, [navigation, task, id, title, body, deleteTask, saveTask]);
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
        if (success) {
            handlingBackRef.current = true;
            navigation.goBack();
        }
        else setActionError(useTaskStore.getState().error ?? 'Unable to update task.');
    };

    const isTaskBlank = () => title.trim().length === 0 && body.trim().length === 0;
    const isCompleted = task?.status === 'completed';
    const iconColor = theme.secondary;

    // Conditional due-date highlighting, mirroring the web task detail:
    // overdue -> error, today -> warning (amber primary), otherwise neutral.
    const dueDateStatus: 'error' | 'warning' | null = (() => {
        if (!dueDate) return null;
        const parsed = dayjs(dueDate, 'YYYY-MM-DD');
        if (!parsed.isValid()) return null;
        const diffDays = parsed.startOf('day').diff(dayjs().startOf('day'), 'day');
        if (diffDays < 0) return 'error';
        if (diffDays === 0) return 'warning';
        return null;
    })();
    const dueFieldBorderClass = dueDateStatus === 'error'
        ? 'border-error dark:border-error-dark'
        : dueDateStatus === 'warning'
            ? 'border-primary dark:border-primary'
            : 'border-outline dark:border-outline-dark';
    const dueFieldTextClass = dueDateStatus === 'error'
        ? 'text-error dark:text-error-dark'
        : dueDateStatus === 'warning'
            ? 'text-primary dark:text-primary'
            : 'text-on-surface dark:text-on-surface-dark';
    const dueFieldIconColor = dueDateStatus === 'error' ? theme.error : dueDateStatus === 'warning' ? theme.primary : theme.onSurfaceVariant;

    return (
        <View className="flex-1" style={{ backgroundColor: theme.background }}>
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: tabBarHeight + 24, gap: 16 }} keyboardShouldPersistTaps="handled">
                {/* Project assignment — top row, mirroring web header */}
                <Pressable onPress={() => setProjectDialogOpen(true)}>
                    <TextField
                        placeholder="Project"
                        value={projects.find((p) => p.recordID === projectID)?.name ?? ''}
                        editable={false}
                        trailing={<MaterialCommunityIcons name="chevron-down" size={20} color={theme.onSurfaceVariant} />}
                    />
                </Pressable>

                {/* Large borderless title */}
                <TextField
                    placeholder="Untitled"
                    value={title}
                    onChangeText={(text) => {
                        setTitle(text);
                        setTitleError(text.trim().length > 255 ? 'Title must not exceed 255 characters' : null);
                    }}
                    error={!!titleError}
                    helperText={titleError ?? undefined}
                    borderless
                    inputClassName="text-3xl font-bold"
                />

                {/* Description */}
                <TextField placeholder="Add a description…" value={body} onChangeText={setBody} multiline borderless inputClassName="min-h-0" />

                {/* Due date + time — compact single-row fields with inline icons */}
                <View className="gap-2">
                    <View className="flex-row items-center gap-1">
                        <StepButton direction="down" color={theme.onSurfaceVariant} accessibilityLabel="Decrease due date by one day" onPress={() => adjustDueDate(-1)} />
                        <Pressable onPress={openDatePicker} className="min-w-0 flex-1">
                            <TextField
                                placeholder="No due date"
                                value={dueDate ?? ''}
                                editable={false}
                                fieldClassName={dueFieldBorderClass}
                                inputClassName={dueFieldTextClass}
                                leading={<MaterialCommunityIcons name="calendar-outline" size={20} color={dueFieldIconColor} />}
                                trailing={dueDate ? <ClearButton color={theme.onSurfaceVariant} accessibilityLabel="Clear due date" onPress={clearDueDate} /> : undefined}
                            />
                        </Pressable>
                        <StepButton direction="up" color={theme.onSurfaceVariant} accessibilityLabel="Increase due date by one day" onPress={() => adjustDueDate(1)} />
                    </View>
                    {dueDate ? (
                        <View className="flex-row items-center gap-1">
                            <StepButton direction="down" color={theme.onSurfaceVariant} accessibilityLabel="Decrease due time by one hour" onPress={() => adjustDueTime(-1)} />
                            <Pressable onPress={openTimePicker} className="min-w-0 flex-1">
                                <TextField
                                    placeholder="Any time"
                                    value={dueTime ?? ''}
                                    editable={false}
                                    leading={<MaterialCommunityIcons name="clock-outline" size={20} color={theme.onSurfaceVariant} />}
                                    trailing={dueTime ? <ClearButton color={theme.onSurfaceVariant} accessibilityLabel="Clear due time" onPress={clearDueTime} /> : undefined}
                                />
                            </Pressable>
                            <StepButton direction="up" color={theme.onSurfaceVariant} accessibilityLabel="Increase due time by one hour" onPress={() => adjustDueTime(1)} />
                        </View>
                    ) : null}
                </View>

                {/* Recurrence settings — outlined block, mirroring web Paper */}
                {dueDate ? (
                    <View className="rounded-2xl border border-outline-variant p-4 dark:border-outline-variant-dark">
                        {/* Checkbox-style "Recurring" toggle button, like the web ToggleButton */}
                        <Pressable
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked: isRecurring }}
                            accessibilityLabel="Recurring task"
                            onPress={() => setIsRecurring(!isRecurring)}
                            className={`flex-row items-center gap-1.5 self-start rounded-xl border px-3 py-1.5 active:opacity-70 ${isRecurring ? 'border-primary bg-primary-container dark:border-primary dark:bg-primary-container-dark' : 'border-outline dark:border-outline-dark'}`}
                        >
                            <Checkbox status={isRecurring ? 'checked' : 'unchecked'} onPress={() => setIsRecurring(!isRecurring)} accessibilityLabel="Recurring task" className="h-6 w-6" />
                            <Text className={`font-semibold ${isRecurring ? 'text-on-primary-container dark:text-on-primary-container-dark' : ''}`}>Recurring</Text>
                        </Pressable>

                        {isRecurring ? (
                            <View className="mt-4 gap-4">
                                <View>
                                    <Text variant="bodySmall" className="mb-1">Interval</Text>
                                    <View className="flex-row items-center self-start rounded-xl border border-outline dark:border-outline-dark">
                                        <StepButton
                                            direction="down"
                                            color={recurrenceInterval <= 1 ? theme.outlineVariant : theme.onSurfaceVariant}
                                            accessibilityLabel="Decrease interval"
                                            onPress={() => { if (recurrenceInterval > 1) setRecurrenceInterval(recurrenceInterval - 1); }}
                                        />
                                        <Text variant="title" className="min-w-10 text-center">{recurrenceInterval}</Text>
                                        <StepButton
                                            direction="up"
                                            color={recurrenceInterval >= 365 ? theme.outlineVariant : theme.onSurfaceVariant}
                                            accessibilityLabel="Increase interval"
                                            onPress={() => { if (recurrenceInterval < 365) setRecurrenceInterval(recurrenceInterval + 1); }}
                                        />
                                    </View>
                                </View>
                                <View>
                                    <Text variant="bodySmall" className="mb-1">Unit</Text>
                                    <View className="flex-row flex-wrap gap-2">
                                        {(dueTime ? ['minutes', 'hours', 'days', 'weeks', 'months'] : ['days', 'weeks', 'months']).map((unit) => (
                                            <Pill key={unit} compact selected={recurrenceUnit === unit} onPress={() => setRecurrenceUnit(unit as RecurrenceUnit)}>{unitLabel(unit as RecurrenceUnit)}</Pill>
                                        ))}
                                    </View>
                                </View>
                                <View>
                                    <Text variant="bodySmall" className="mb-1">Repeated from</Text>
                                    <View className="flex-row gap-2">
                                        <Pill compact selected={recurrenceAnchor === 'due_date'} onPress={() => setRecurrenceAnchor('due_date')}>Due</Pill>
                                        <Pill compact selected={recurrenceAnchor === 'completed_date'} onPress={() => setRecurrenceAnchor('completed_date')}>Completed</Pill>
                                    </View>
                                </View>
                            </View>
                        ) : null}
                    </View>
                ) : null}

                {/* Subtasks */}
                <View>
                    <View className="mb-1 flex-row items-baseline gap-2">
                        <Text variant="title">Subtasks</Text>
                        <Text variant="bodySmall">({subtasks.filter((s) => s.isCompleted).length}/{subtasks.length})</Text>
                    </View>
                    {subtasks.map((subtask) => (
                        <View key={subtask.recordID} className="flex-row items-center">
                            <Checkbox status={subtask.isCompleted ? 'checked' : 'unchecked'} onPress={() => toggleSubtask(subtask.recordID)} accessibilityLabel={`Toggle ${subtask.title}`} />
                            <Text className={`min-w-0 flex-1 ${subtask.isCompleted ? 'text-on-surface-variant line-through dark:text-on-surface-variant-dark' : ''}`}>{subtask.title}</Text>
                            <Button variant="text" compact icon={<MaterialCommunityIcons name="delete-outline" size={19} color={theme.onSurfaceVariant} />} accessibilityLabel="Delete subtask" onPress={() => deleteSubtask(subtask.recordID)} />
                        </View>
                    ))}
                    <View className="mt-3 flex-row items-center gap-2">
                        <TextField placeholder="Add a subtask" value={subtaskInput} onChangeText={setSubtaskInput} className="min-w-0 flex-1" />
                        <Button compact onPress={handleAddSubtask} disabled={!subtaskInput.trim()}>Add</Button>
                    </View>
                </View>

                {/* Complete / Reopen — full-width, mirroring web */}
                <Button
                    className="mt-2"
                    icon={<MaterialCommunityIcons name={isCompleted ? 'backup-restore' : 'check-circle'} size={18} color={theme.onPrimary} />}
                    onPress={handleTaskCompletion}
                >
                    {isCompleted ? 'Reopen Task' : 'Complete'}
                </Button>
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
                visible={menuOpen}
                onDismiss={() => setMenuOpen(false)}
                title="More options"
                actions={<Button variant="text" compact onPress={() => setMenuOpen(false)}>Close</Button>}
            >
                <View className="gap-2">
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

// Derive the editable "HH:mm" due time from a stored timestamp. A midnight
// timestamp represents a date with no specific time, so return undefined.
function deriveDueTime(dueDate: number | null | undefined): string | undefined {
    if (dueDate == null) return undefined;
    const date = dayjs(dueDate);
    if (!date.isValid()) return undefined;
    if (date.hour() === 0 && date.minute() === 0) return undefined;
    return date.format('HH:mm');
}

// Abbreviated recurrence-unit labels, matching the web ("Mins"/"Hours").
function unitLabel(unit: RecurrenceUnit): string {
    switch (unit) {
        case 'minutes': return 'Mins';
        case 'hours': return 'Hours';
        case 'days': return 'Days';
        case 'weeks': return 'Weeks';
        case 'months': return 'Months';
    }
}
