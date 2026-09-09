import { useState } from 'react';
import { FlatList, ScrollView, View, StyleSheet, TextInput, RefreshControl } from 'react-native';
import { List, FAB, Text, Checkbox, Chip, useTheme } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { refreshAllData, useTaskStore, useProjectStore } from '@simpletracker/core';
import type { TasksStackParamList } from '../navigation/types';
import dayjs from 'dayjs';

type Nav = NativeStackNavigationProp<TasksStackParamList, 'TasksList'>;

export function TasksListScreen() {
    const theme = useTheme();
    const navigation = useNavigation<Nav>();
    const tasks = useTaskStore((s) => s.tasks);
    const createBlankTask = useTaskStore((s) => s.createBlankTask);
    const completeTask = useTaskStore((s) => s.completeTask);
    const reopenTask = useTaskStore((s) => s.reopenTask);
    const deleteTask = useTaskStore((s) => s.deleteTask);

    const projects = useProjectStore((s) => s.projects);

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedProjectIDs, setSelectedProjectIDs] = useState<Set<string>>(new Set());
    const [refreshing, setRefreshing] = useState(false);

    const onRefresh = async () => {
        setRefreshing(true);
        try {
            await refreshAllData();
        } catch (error) {
            console.warn('Failed to refresh tasks:', error);
        } finally {
            setRefreshing(false);
        }
    };

    const openTasks = tasks.filter((t) => t.status === 'open');

    const onAdd = async () => {
        const task = await createBlankTask();
        navigation.navigate('TaskDetail', { id: task.recordID });
    };

    // Filter tasks by search and project
    const filteredTasks = openTasks.filter((task) => {
        let matchesSearch = true;
        let matchesProject = true;

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            const titleMatch = task.title.toLowerCase().includes(q) ? true : false;
            const bodyMatch = task.body && typeof task.body === 'string' && task.body.toLowerCase().includes(q) ? true : false;
            matchesSearch = titleMatch || bodyMatch;
        }

        if (selectedProjectIDs.size > 0) {
            const pid = task.projectID;
            matchesProject = typeof pid === 'string' && selectedProjectIDs.has(pid);
        }

        return matchesSearch && matchesProject;
    });

    // Sort tasks by due date
    const sortedTasks = [...filteredTasks].sort((a, b) => {
        if (a.dueDate != null && b.dueDate != null) return a.dueDate - b.dueDate;
        if (a.dueDate != null) return -1;
        if (b.dueDate != null) return 1;
        return b.createdAt - a.createdAt;
    });

    // Group by due date
    const { overdueTasks, dueTodayTasks, dueTomorrowTasks, dueThisWeekTasks, upcomingTasks, noDueDateTasks } = (() => {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const todayEnd = todayStart + 24 * 60 * 60 * 1000 - 1;
        const tomorrowEnd = todayStart + 2 * 24 * 60 * 60 * 1000 - 1;
        const weekEnd = todayStart + 7 * 24 * 60 * 60 * 1000 - 1;

        const overdue: typeof sortedTasks = [];
        const dueToday: typeof sortedTasks = [];
        const dueTomorrow: typeof sortedTasks = [];
        const dueThisWeek: typeof sortedTasks = [];
        const upcoming: typeof sortedTasks = [];
        const noDueDate: typeof sortedTasks = [];

        for (const task of sortedTasks) {
            if (task.dueDate == null) {
                noDueDate.push(task);
            } else if (task.dueDate < todayStart) {
                overdue.push(task);
            } else if (task.dueDate <= todayEnd) {
                dueToday.push(task);
            } else if (task.dueDate <= tomorrowEnd) {
                dueTomorrow.push(task);
            } else if (task.dueDate <= weekEnd) {
                dueThisWeek.push(task);
            } else {
                upcoming.push(task);
            }
        }

        return { overdueTasks: overdue, dueTodayTasks: dueToday, dueTomorrowTasks: dueTomorrow, dueThisWeekTasks: dueThisWeek, upcomingTasks: upcoming, noDueDateTasks: noDueDate };
    })();

    // Sort projects by most tasks
    const sortedProjects = [...projects].sort((a, b) => {
        const aCount = tasks.filter((t) => t.projectID === a.recordID).length;
        const bCount = tasks.filter((t) => t.projectID === b.recordID).length;
        return bCount - aCount;
    });

    const toggleProjectFilter = (projectID: string) => {
        setSelectedProjectIDs((prev) => {
            const next = new Set(prev);
            if (next.has(projectID)) {
                next.delete(projectID);
            } else {
                next.add(projectID);
            }
            return next;
        });
    };

    const formatDueDate = (dueDate: number): string => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const date = new Date(dueDate);
        const diffDays = Math.round((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays < 0) return 'Overdue';
        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Tomorrow';
        if (diffDays <= 7) return date.toLocaleDateString(undefined, { weekday: 'short' });
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    };

    const getDueDateColor = (dueDate: number): 'error' | 'warning' | 'default' => {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        if (dueDate < todayStart) return 'error';
        if (dueDate <= todayStart + 24 * 60 * 60 * 1000 - 1) return 'warning';
        return 'default';
    };

    const TaskItem = ({ task }: { task: typeof tasks[0] }) => (
        <List.Item
            title={task.title || '(untitled)'}
            left={() => (
                <Checkbox
                    status={task.status === 'completed' ? 'checked' : 'unchecked'}
                    onPress={() =>
                        task.status === 'completed'
                            ? reopenTask(task.recordID)
                            : completeTask(task.recordID)
                    }
                />
            )}
            right={() => {
                if (!task.dueDate) return null;
                const dueDateColor = getDueDateColor(task.dueDate);
                const chipColor = dueDateColor === 'error'
                    ? theme.colors.error
                    : dueDateColor === 'warning'
                        ? theme.colors.tertiary
                        : theme.colors.primary;
                return (
                    <Chip
                        style={[styles.dueDateChip, { backgroundColor: `${chipColor}10` }]}
                        icon="calendar"
                        mode="outlined"
                    >
                        <Text style={{ color: chipColor }}>{formatDueDate(task.dueDate)}</Text>
                    </Chip>
                );
            }}
            onPress={() => navigation.navigate('TaskDetail', { id: task.recordID })}
        />
    );

    return (
        <View style={styles.container}>
            {/* Search bar */}
            <View style={styles.searchContainer}>
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search tasks..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    returnKeyType="search"
                />
            </View>

            {/* Project filter chips */}
            {sortedProjects.length > 0 && (
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.projectChips}
                >
                    {sortedProjects.map((project) => {
                        const count = tasks.filter((t) => t.projectID === project.recordID).length;
                        return (
                            <Chip
                                key={project.recordID}
                                selected={selectedProjectIDs.has(project.recordID) === true}
                                onPress={() => toggleProjectFilter(project.recordID)}
                                style={styles.projectChip}
                                textStyle={styles.projectChipText}
                            >
                                {project.name} ({count})
                            </Chip>
                        );
                    })}
                </ScrollView>
            )}

            <FlatList
                data={[
                    { title: 'Overdue', tasks: overdueTasks },
                    { title: 'Due Today', tasks: dueTodayTasks },
                    { title: 'Tomorrow', tasks: dueTomorrowTasks },
                    { title: 'This Week', tasks: dueThisWeekTasks },
                    { title: 'Upcoming', tasks: upcomingTasks },
                    { title: 'No Due Date', tasks: noDueDateTasks },
                ].filter((section) => section.tasks.length > 0)}
                keyExtractor={(item) => item.title}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <Text variant="bodyLarge">
                            {searchQuery.trim() ? 'No tasks match your search.' : 'No tasks yet.'}
                        </Text>
                    </View>
                }
                renderItem={({ item }) => {
                    if (item.tasks.length === 0) return null;
                    return (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>{item.title} ({item.tasks.length})</Text>
                            <FlatList
                                data={item.tasks}
                                keyExtractor={(t) => t.recordID}
                                renderItem={({ item: task }) => <TaskItem task={task} />}
                            />
                        </View>
                    );
                }}
            />
            <FAB icon="plus" style={styles.fab} onPress={onAdd} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    searchContainer: { paddingHorizontal: 16, paddingVertical: 8 },
    searchInput: {
        backgroundColor: 'transparent',
        fontSize: 16,
    },
    projectChips: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        minHeight: 48,
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    projectChip: {
        flexShrink: 0,
        minHeight: 40,
        justifyContent: 'center',
    },
    projectChipText: { lineHeight: 20 },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    section: { marginTop: 16 },
    sectionTitle: { paddingHorizontal: 16, marginBottom: 8 },
    dueDateChip: { marginLeft: 8 },
    fab: { position: 'absolute', right: 16, bottom: 16 },
});
