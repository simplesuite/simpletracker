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
        <ScrollView contentContainerStyle={[styles.container, { paddingBottom: tabBarHeight + 24 }]}>
            <TextInput
                mode="flat"
                placeholder="Title"
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
                underlineColorAndroid="transparent"
            />
            <TextInput
                mode="flat"
                placeholder="Notes"
                value={body}
                onChangeText={setBody}
                multiline
                style={styles.body}
            />
            
            {/* Due Date */}
            <View style={styles.dateSection}>
                <Text style={styles.sectionTitle}>Due Date</Text>
                <TextInput
                    mode="outlined"
                    placeholder="Date"
                    value={dueDate ?? ''}
                    style={styles.dateInput}
                    editable={false}
                    right={<TextInput.Icon icon="calendar" />}
                />
                {dueDate && (
                    <View style={styles.timeRow}>
                        <TextInput
                            mode="outlined"
                            placeholder="Time"
                            value={dueTime ?? ''}
                            style={styles.timeInput}
                            editable={false}
                            right={<TextInput.Icon icon="clock" />}
                        />
                    </View>
                )}
            </View>

            {/* Project */}
            <View style={styles.projectSection}>
                <Text style={styles.sectionTitle}>Project</Text>
                <TextInput
                    mode="outlined"
                    placeholder="No project"
                    value={projects.find(p => p.recordID === projectID)?.name ?? ''}
                    style={styles.projectInput}
                    editable={false}
                />
            </View>

            {/* Recurrence */}
            {dueDate && (
                <View style={styles.recurrenceSection}>
                    <Text style={styles.sectionTitle}>Recurring</Text>
                    <View style={styles.recurrenceRow}>
                        <Text>Recurring</Text>
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
                                <Chip
                                    selected={recurrenceUnit === 'days'}
                                    onPress={() => setRecurrenceUnit('days')}
                                    style={styles.recurrenceChip}
                                >
                                    Day
                                </Chip>
                                <Chip
                                    selected={recurrenceUnit === 'weeks'}
                                    onPress={() => setRecurrenceUnit('weeks')}
                                    style={styles.recurrenceChip}
                                >
                                    Week
                                </Chip>
                                <Chip
                                    selected={recurrenceUnit === 'months'}
                                    onPress={() => setRecurrenceUnit('months')}
                                    style={styles.recurrenceChip}
                                >
                                    Month
                                </Chip>
                            </View>
                            <View style={styles.recurrenceAnchorRow}>
                                <RadioButton.Group
                                    onValueChange={(value) => setRecurrenceAnchor(value as 'due_date' | 'completed_date')}
                                    value={recurrenceAnchor}
                                >
                                    <View style={styles.radioButtonRow}>
                                        <RadioButton value="due_date" />
                                        <Text>Due</Text>
                                    </View>
                                    <View style={styles.radioButtonRow}>
                                        <RadioButton value="completed_date" />
                                        <Text>Completed</Text>
                                    </View>
                                </RadioButton.Group>
                            </View>
                        </View>
                    )}
                </View>
            )}

            {/* Subtasks */}
            <View style={styles.subtasksSection}>
                <View style={styles.subtasksHeader}>
                    <Text style={styles.sectionTitle}>Subtasks</Text>
                    <Text style={{ color: theme.colors.onSurfaceVariant }}>
                        ({subtasks.filter(s => s.isCompleted).length}/{subtasks.length})
                    </Text>
                </View>
                
                {subtasks.length > 0 && (
                    <View style={styles.subtaskList}>
                        {subtasks.map((subtask) => (
                            <View key={subtask.recordID} style={styles.subtaskItem}>
                                <View style={styles.subtaskContent}>
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
                                </View>
                                <Button
                                    mode="text"
                                    icon="delete"
                                    onPress={() => handleDeleteSubtask(subtask.recordID)}
                                    style={styles.deleteSubtaskBtn}
                                >
                                    Delete
                                </Button>
                            </View>
                        ))}
                    </View>
                )}

                <View style={styles.addSubtaskRow}>
                    <TextInput
                        mode="outlined"
                        placeholder="Add a subtask..."
                        value={subtaskInput}
                        onChangeText={setSubtaskInput}
                        style={styles.addSubtaskInput}
                    />
                    <Button
                        mode="contained"
                        onPress={handleAddSubtask}
                        disabled={!subtaskInput.trim()}
                        style={styles.addSubtaskBtn}
                    >
                        Add
                    </Button>
                </View>
            </View>

            {/* Actions */}
            <View style={styles.actions}>
                <Button
                    mode="contained"
                    icon="check"
                    onPress={async () => {
                        await completeTask(id);
                        navigation.goBack();
                    }}
                >
                    Complete
                </Button>
                <Button
                    mode="text"
                    icon="delete"
                    onPress={() => setDeleteDialogOpen(true)}
                    style={styles.deleteBtn}
                >
                    Delete
                </Button>
            </View>

            {/* Delete Confirmation Dialog */}
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
    container: { padding: 16 },
    title: { fontSize: 20, marginBottom: 8, backgroundColor: 'transparent' },
    body: { minHeight: 120, backgroundColor: 'transparent' },
    dateSection: { marginTop: 16 },
    dateInput: { marginBottom: 8 },
    timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
    timeInput: { flex: 1 },
    projectSection: { marginTop: 16 },
    projectInput: { marginBottom: 8 },
    recurrenceSection: { marginTop: 16 },
    recurrenceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    recurrenceSettings: { marginTop: 16, padding: 12, borderRadius: 8 },
    recurrenceInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
    recurrenceNumber: { width: 60 },
    recurrenceChip: { marginLeft: 8 },
    recurrenceAnchorRow: { marginTop: 12 },
    radioButtonRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
    subtasksSection: { marginTop: 16 },
    subtasksHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    subtaskList: { marginTop: 8 },
    subtaskItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
    subtaskContent: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
    subtaskText: { flex: 1 },
    deleteSubtaskBtn: { padding: 4 },
    addSubtaskRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
    addSubtaskInput: { flex: 1 },
    addSubtaskBtn: { marginLeft: 8 },
    actions: { marginTop: 24, flexDirection: 'row', justifyContent: 'space-between' },
    deleteBtn: { marginTop: 8 },
    sectionTitle: { fontSize: 14, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase' },
});
