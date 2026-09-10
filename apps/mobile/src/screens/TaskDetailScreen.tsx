import { useEffect, useState, useRef, useCallback } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { TextInput, Button, Text, Chip, Switch, Dialog, Portal, Paragraph, RadioButton, useTheme } from 'react-native-paper';
import type { RouteProp } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useTaskStore, useProjectStore } from '@simpletracker/core';
import type { TasksStackParamList } from '../navigation/types';
import dayjs from 'dayjs';

type RecurrenceUnit = 'minutes' | 'hours' | 'days' | 'weeks' | 'months';

export function TaskDetailScreen() {
    const theme = useTheme();
    const tabBarHeight = useBottomTabBarHeight();
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
            const combined = dayjs(`${dueDateRef.current} ${dueTimeRef.current}`, 'YYYY-MM-DD HH:mm');
            dueDateValue = combined.valueOf();
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
            if (task) {
                saveTask();
            }
        }, 1000);
        return () => clearTimeout(timer);
    }, [title, body, dueDate, dueTime, projectID, isRecurring, recurrenceInterval, recurrenceUnit, recurrenceAnchor, task, saveTask]);

    useEffect(() => {
        if (id) {
            fetchSubtasks(id);
        }
    }, [id, fetchSubtasks]);

    const handleAddSubtask = async () => {
        if (!subtaskInput.trim() || !id) return;
        const result = await addSubtask(id, subtaskInput.trim());
        if (result) {
            setSubtaskInput('');
        }
    };

    const handleDeleteSubtask = async (subtaskID: string) => {
        await deleteSubtask(subtaskID);
    };

    const handleToggleSubtask = async (subtaskID: string) => {
        await toggleSubtask(subtaskID);
    };

    const handleDeleteTask = async () => {
        setDeleteDialogOpen(false);
        if (!id) return;
        await deleteTask(id);
        navigation.goBack();
    };

    const handleBack = async () => {
        await saveTask();
        if (!title.trim() && !body.trim()) {
            setDeleteDialogOpen(true);
        } else {
            navigation.goBack();
        }
    };

    const isTaskBlank = () => {
        return title.trim().length === 0 && body.trim().length === 0;
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
                    placeholder="Task title"
                    value={title}
                    onChangeText={(text) => {
                        setTitle(text);
                        if (text.trim().length > 255) {
                            setTitleError('Title must not exceed 255 characters');
                        } else {
                            setTitleError(null);
                        }
                    }}
                    error={!!titleError}
                    style={styles.title}
                    contentStyle={styles.titleContent}
                />
                {titleError && <Text variant="bodySmall" style={[styles.errorText, { color: theme.colors.error }]}>{titleError}</Text>}
                <View style={styles.taskStatusRow}>
                    <Chip icon="checkbox-marked-circle-outline" compact>Open task</Chip>
                    {isRecurring && <Chip icon="repeat" compact>Recurring</Chip>}
                </View>
            </View>

            <View style={[styles.sectionCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
                <View style={styles.sectionHeading}>
                    <Text variant="titleMedium">Notes</Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>Optional details</Text>
                </View>
                <TextInput
                    mode="flat"
                    placeholder="Add context or details…"
                    value={body}
                    onChangeText={setBody}
                    multiline
                    style={styles.body}
                    contentStyle={styles.bodyContent}
                />
            </View>

            <View style={[styles.sectionCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
                <View style={styles.sectionHeading}>
                    <View>
                        <Text variant="titleMedium">Details</Text>
                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>Schedule and organization</Text>
                    </View>
                    {isRecurring && <Chip compact icon="repeat">Repeats</Chip>}
                </View>
                <View style={styles.detailField}>
                    <Text variant="labelLarge" style={styles.fieldLabel}>Due date</Text>
                    <TextInput
                        mode="outlined"
                        placeholder="No due date"
                        value={dueDate ?? ''}
                        style={styles.dateInput}
                        editable={false}
                        right={<TextInput.Icon icon="calendar-outline" />}
                    />
                </View>
                {dueDate && (
                    <View style={styles.detailField}>
                        <Text variant="labelLarge" style={styles.fieldLabel}>Time</Text>
                        <TextInput
                            mode="outlined"
                            placeholder="Any time"
                            value={dueTime ?? ''}
                            style={styles.timeInput}
                            editable={false}
                            right={<TextInput.Icon icon="clock-outline" />}
                        />
                    </View>
                )}
                <View style={styles.detailField}>
                    <Text variant="labelLarge" style={styles.fieldLabel}>Project</Text>
                    <TextInput
                        mode="outlined"
                        placeholder="No project"
                        value={projects.find(p => p.recordID === projectID)?.name ?? ''}
                        style={styles.projectInput}
                        editable={false}
                        right={<TextInput.Icon icon="folder-outline" />}
                    />
                </View>
            </View>

            {dueDate && (
                <View style={[styles.sectionCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
                    <View style={styles.recurrenceRow}>
                        <View>
                            <Text variant="titleMedium">Recurring task</Text>
                            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                Create the next occurrence when completed
                            </Text>
                        </View>
                        <Switch value={isRecurring} onValueChange={setIsRecurring} />
                    </View>
                    {isRecurring && (
                        <View style={[styles.recurrenceSettings, { backgroundColor: theme.colors.surfaceVariant }]}>
                            <View style={styles.recurrenceInputRow}>
                                <Text>Every</Text>
                                <TextInput
                                    mode="outlined"
                                    value={String(recurrenceInterval)}
                                    onChangeText={(text) => {
                                        const value = parseInt(text, 10);
                                        if (!isNaN(value) && value > 0 && value <= 365) {
                                            setRecurrenceInterval(value);
                                        }
                                    }}
                                    style={styles.recurrenceNumber}
                                    keyboardType="number-pad"
                                />
                                <Chip selected={recurrenceUnit === 'days'} onPress={() => setRecurrenceUnit('days')} compact>Day</Chip>
                                <Chip selected={recurrenceUnit === 'weeks'} onPress={() => setRecurrenceUnit('weeks')} compact>Week</Chip>
                                <Chip selected={recurrenceUnit === 'months'} onPress={() => setRecurrenceUnit('months')} compact>Month</Chip>
                            </View>
                            <View style={styles.recurrenceAnchorRow}>
                                <Text variant="labelLarge" style={styles.fieldLabel}>Repeat from</Text>
                                <RadioButton.Group
                                    onValueChange={(value) => setRecurrenceAnchor(value as 'due_date' | 'completed_date')}
                                    value={recurrenceAnchor}
                                >
                                    <View style={styles.radioButtonRow}>
                                        <RadioButton value="due_date" />
                                        <Text>Due date</Text>
                                    </View>
                                    <View style={styles.radioButtonRow}>
                                        <RadioButton value="completed_date" />
                                        <Text>Completion date</Text>
                                    </View>
                                </RadioButton.Group>
                            </View>
                        </View>
                    )}
                </View>
            )}

            <View style={[styles.sectionCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
                <View style={styles.sectionHeading}>
                    <View>
                        <Text variant="titleMedium">Subtasks</Text>
                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                            {subtasks.filter(s => s.isCompleted).length} of {subtasks.length} complete
                        </Text>
                    </View>
                </View>
                {subtasks.length === 0 && (
                    <Text variant="bodyMedium" style={[styles.emptyHint, { color: theme.colors.onSurfaceVariant }]}>
                        Break this task into smaller steps.
                    </Text>
                )}
                {subtasks.map((subtask) => (
                    <View key={subtask.recordID} style={[styles.subtaskItem, { borderTopColor: theme.colors.outlineVariant }]}>
                        <RadioButton
                            value="subtask"
                            status={subtask.isCompleted ? 'checked' : 'unchecked'}
                            onPress={() => handleToggleSubtask(subtask.recordID)}
                        />
                        <Text style={[
                            styles.subtaskText,
                            subtask.isCompleted && { color: theme.colors.onSurfaceVariant, textDecorationLine: 'line-through' }
                        ]}>
                            {subtask.title}
                        </Text>
                        <Button
                            mode="text"
                            icon="delete-outline"
                            compact
                            accessibilityLabel="Delete subtask"
                            onPress={() => handleDeleteSubtask(subtask.recordID)}
                        >
                            {''}
                        </Button>
                    </View>
                ))}
                <View style={styles.addSubtaskRow}>
                    <TextInput
                        mode="outlined"
                        placeholder="Add a subtask"
                        value={subtaskInput}
                        onChangeText={setSubtaskInput}
                        style={styles.addSubtaskInput}
                    />
                    <Button mode="contained" compact onPress={handleAddSubtask} disabled={!subtaskInput.trim()}>
                        Add
                    </Button>
                </View>
            </View>

            <View style={[styles.actionsCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
                <Button
                    mode="contained"
                    icon="check"
                    onPress={async () => {
                        await completeTask(id);
                        navigation.goBack();
                    }}
                >
                    Complete task
                </Button>
                <Button mode="text" icon="delete-outline" onPress={() => setDeleteDialogOpen(true)} textColor={theme.colors.error}>
                    Delete
                </Button>
            </View>

            <Portal>
                <Dialog visible={deleteDialogOpen} onDismiss={() => setDeleteDialogOpen(false)}>
                    <Dialog.Title>Delete Task</Dialog.Title>
                    <Dialog.Content>
                        <Paragraph>
                            {isTaskBlank()
                                ? 'This task is empty. Are you sure you want to delete it?'
                                : 'Are you sure you want to delete this task?'}
                        </Paragraph>
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={() => setDeleteDialogOpen(false)}>Cancel</Button>
                        <Button onPress={handleDeleteTask}>Delete</Button>
                    </Dialog.Actions>
                </Dialog>
            </Portal>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    scroll: { flex: 1 },
    container: { padding: 16, gap: 12 },
    editorCard: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 20, padding: 8 },
    title: { fontSize: 25, backgroundColor: 'transparent' },
    titleContent: { paddingHorizontal: 8, paddingVertical: 8, fontWeight: '600' },
    errorText: { paddingHorizontal: 8, marginBottom: 4 },
    taskStatusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 8, paddingBottom: 8 },
    sectionCard: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 20, padding: 16 },
    sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
    body: { minHeight: 120, backgroundColor: 'transparent' },
    bodyContent: { paddingHorizontal: 0, paddingTop: 8 },
    detailField: { marginTop: 4, marginBottom: 10 },
    fieldLabel: { marginBottom: 6 },
    dateInput: { marginBottom: 2 },
    timeInput: { marginBottom: 2 },
    projectInput: { marginBottom: 0 },
    recurrenceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    recurrenceSettings: { marginTop: 16, padding: 12, borderRadius: 14 },
    recurrenceInputRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
    recurrenceNumber: { width: 64 },
    recurrenceAnchorRow: { marginTop: 16 },
    radioButtonRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
    emptyHint: { paddingVertical: 8 },
    subtaskItem: { flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 4 },
    subtaskText: { flex: 1 },
    addSubtaskRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
    addSubtaskInput: { flex: 1 },
    actionsCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: StyleSheet.hairlineWidth, borderRadius: 20, padding: 8 },
});
