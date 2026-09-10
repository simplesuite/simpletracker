import { useState } from 'react';
import { RefreshControl, ScrollView, SectionList, StyleSheet, View } from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Card, Checkbox, Chip, FAB, List, Searchbar, Text, useTheme } from 'react-native-paper';
import { refreshAllData, useProjectStore, useTaskStore } from '@simpletracker/core';
import type { Task } from '@simpletracker/core';
import type { TasksStackParamList } from '../navigation/types';
import dayjs from 'dayjs';

type Nav = NativeStackNavigationProp<TasksStackParamList, 'TasksList'>;

type TaskSection = {
    title: string;
    data: Task[];
};

export function TasksListScreen() {
    const theme = useTheme();
    const tabBarHeight = useBottomTabBarHeight();
    const navigation = useNavigation<Nav>();
    const tasks = useTaskStore((s) => s.tasks);
    const createBlankTask = useTaskStore((s) => s.createBlankTask);
    const completeTask = useTaskStore((s) => s.completeTask);
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

    const onAdd = async () => {
        const task = await createBlankTask();
        navigation.navigate('TaskDetail', { id: task.recordID });
    };

    const openTasks = tasks.filter((task) => task.status === 'open');
    const query = searchQuery.trim().toLowerCase();
    const filteredTasks = openTasks.filter((task) => {
        const matchesSearch = !query || task.title.toLowerCase().includes(query) || task.body.toLowerCase().includes(query);
        const matchesProject = selectedProjectIDs.size === 0 || (
            typeof task.projectID === 'string' && selectedProjectIDs.has(task.projectID)
        );
        return matchesSearch && matchesProject;
    });

    const sortedTasks = [...filteredTasks].sort((a, b) => {
        if (a.dueDate != null && b.dueDate != null) return a.dueDate - b.dueDate;
        if (a.dueDate != null) return -1;
        if (b.dueDate != null) return 1;
        return b.createdAt - a.createdAt;
    });

    const { overdueTasks, dueTodayTasks, dueTomorrowTasks, dueThisWeekTasks, upcomingTasks, noDueDateTasks } = (() => {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const todayEnd = todayStart + 24 * 60 * 60 * 1000 - 1;
        const tomorrowEnd = todayStart + 2 * 24 * 60 * 60 * 1000 - 1;
        const weekEnd = todayStart + 7 * 24 * 60 * 60 * 1000 - 1;

        const overdue: Task[] = [];
        const dueToday: Task[] = [];
        const dueTomorrow: Task[] = [];
        const dueThisWeek: Task[] = [];
        const upcoming: Task[] = [];
        const noDueDate: Task[] = [];

        for (const task of sortedTasks) {
            if (task.dueDate == null) noDueDate.push(task);
            else if (task.dueDate < todayStart) overdue.push(task);
            else if (task.dueDate <= todayEnd) dueToday.push(task);
            else if (task.dueDate <= tomorrowEnd) dueTomorrow.push(task);
            else if (task.dueDate <= weekEnd) dueThisWeek.push(task);
            else upcoming.push(task);
        }

        return {
            overdueTasks: overdue,
            dueTodayTasks: dueToday,
            dueTomorrowTasks: dueTomorrow,
            dueThisWeekTasks: dueThisWeek,
            upcomingTasks: upcoming,
            noDueDateTasks: noDueDate,
        };
    })();

    const sections: TaskSection[] = [
        ...(overdueTasks.length > 0 ? [{ title: 'Overdue', data: overdueTasks }] : []),
        ...(dueTodayTasks.length > 0 ? [{ title: 'Today', data: dueTodayTasks }] : []),
        ...(dueTomorrowTasks.length > 0 ? [{ title: 'Tomorrow', data: dueTomorrowTasks }] : []),
        ...(dueThisWeekTasks.length > 0 ? [{ title: 'This week', data: dueThisWeekTasks }] : []),
        ...(upcomingTasks.length > 0 ? [{ title: 'Upcoming', data: upcomingTasks }] : []),
        ...(noDueDateTasks.length > 0 ? [{ title: 'No due date', data: noDueDateTasks }] : []),
    ];

    const sortedProjects = [...projects].sort((a, b) => {
        const aCount = tasks.filter((task) => task.projectID === a.recordID).length;
        const bCount = tasks.filter((task) => task.projectID === b.recordID).length;
        return bCount - aCount;
    });

    const hasFilters = searchQuery.trim().length > 0 || selectedProjectIDs.size > 0;
    const dueSoonCount = dueTodayTasks.length + dueTomorrowTasks.length;

    const toggleProjectFilter = (projectID: string) => {
        setSelectedProjectIDs((previous) => {
            const next = new Set(previous);
            if (next.has(projectID)) next.delete(projectID);
            else next.add(projectID);
            return next;
        });
    };

    const formatDueDate = (dueDate: number) => {
        const today = dayjs().startOf('day');
        const date = dayjs(dueDate);
        const diffDays = date.startOf('day').diff(today, 'day');
        if (diffDays < 0) return 'Overdue';
        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Tomorrow';
        if (diffDays <= 7) return date.format('ddd');
        return date.format('MMM D');
    };

    const renderTask = ({ item }: { item: Task }) => {
        const projectName = item.projectID
            ? projects.find((project) => project.recordID === item.projectID)?.name
            : undefined;
        const isOverdue = item.dueDate != null && item.dueDate < new Date().setHours(0, 0, 0, 0);
        const dueColor = isOverdue ? theme.colors.error : theme.colors.primary;
        const dueBackground = isOverdue ? theme.colors.errorContainer : theme.colors.primaryContainer;

        return (
            <Card
                mode="contained"
                onPress={() => navigation.navigate('TaskDetail', { id: item.recordID })}
                style={[styles.taskCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}
            >
                <Card.Content style={styles.taskCardContent}>
                    <Checkbox
                        status="unchecked"
                        onPress={() => completeTask(item.recordID)}
                    />
                    <View style={styles.taskDetails}>
                        <Text variant="titleMedium" numberOfLines={1}>
                            {item.title || '(untitled)'}
                        </Text>
                        <View style={styles.taskMeta}>
                            {projectName && (
                                <Text variant="labelSmall" numberOfLines={1} style={[styles.projectMeta, { color: theme.colors.primary }]}>
                                    {projectName}
                                </Text>
                            )}
                            {item.isRecurring && (
                                <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                    Recurring
                                </Text>
                            )}
                        </View>
                    </View>
                    {item.dueDate != null && (
                        <Chip
                            compact
                            icon="calendar"
                            mode="flat"
                            style={[styles.dueChip, { backgroundColor: dueBackground }]}
                            textStyle={{ color: dueColor }}
                        >
                            {formatDueDate(item.dueDate)}
                        </Chip>
                    )}
                </Card.Content>
            </Card>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <View style={styles.controls}>
                <Searchbar
                    placeholder="Search your tasks"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    style={[styles.searchbar, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}
                    inputStyle={styles.searchInput}
                    elevation={0}
                />
                <View style={styles.summaryRow}>
                    <View>
                        <Text variant="titleMedium">Your tasks</Text>
                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                            {filteredTasks.length} open · {dueSoonCount} due soon
                        </Text>
                    </View>
                    {hasFilters && (
                        <Chip
                            compact
                            icon="close"
                            onPress={() => {
                                setSearchQuery('');
                                setSelectedProjectIDs(new Set());
                            }}
                        >
                            Clear filters
                        </Chip>
                    )}
                </View>
            </View>

            {sortedProjects.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.projectChips}>
                    <Chip
                        compact
                        selected={selectedProjectIDs.size === 0}
                        onPress={() => setSelectedProjectIDs(new Set())}
                        style={styles.projectChip}
                    >
                        All tasks
                    </Chip>
                    {sortedProjects.map((project) => (
                        <Chip
                            key={project.recordID}
                            compact
                            selected={selectedProjectIDs.has(project.recordID)}
                            onPress={() => toggleProjectFilter(project.recordID)}
                            style={styles.projectChip}
                        >
                            {project.name} · {tasks.filter((task) => task.projectID === project.recordID).length}
                        </Chip>
                    ))}
                </ScrollView>
            )}

            <SectionList
                sections={sections}
                keyExtractor={(item) => item.recordID}
                contentContainerStyle={sections.length === 0
                    ? [styles.emptyListContent, { paddingBottom: tabBarHeight + 96 }]
                    : [styles.listContent, { paddingBottom: tabBarHeight + 96 }]}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <View style={[styles.emptyIcon, { backgroundColor: theme.colors.primaryContainer }]}>
                            <List.Icon icon={hasFilters ? 'magnify' : 'checkbox-marked-circle-outline'} color={theme.colors.primary} />
                        </View>
                        <Text variant="titleMedium" style={styles.emptyTitle}>
                            {hasFilters ? 'No tasks found' : 'No tasks yet'}
                        </Text>
                        <Text variant="bodyMedium" style={[styles.emptyDescription, { color: theme.colors.onSurfaceVariant }]}>
                            {hasFilters ? 'Try a different search or clear your filters.' : 'Add a task to keep your next steps in view.'}
                        </Text>
                    </View>
                }
                renderSectionHeader={({ section }) => (
                    <View style={styles.sectionHeader}>
                        <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant }}>
                            {section.title.toUpperCase()}
                        </Text>
                    </View>
                )}
                renderItem={renderTask}
            />

            <FAB
                icon="plus"
                size="small"
                accessibilityLabel="New task"
                style={[styles.fab, { bottom: tabBarHeight + 24 }]}
                onPress={onAdd}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    controls: { paddingHorizontal: 16, paddingTop: 12 },
    searchbar: { borderWidth: 1, borderRadius: 16 },
    searchInput: { fontSize: 16 },
    summaryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
    },
    projectChips: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    projectChip: { minHeight: 36 },
    listContent: { paddingTop: 4 },
    emptyListContent: { flexGrow: 1 },
    sectionHeader: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
    taskCard: { marginHorizontal: 16, marginBottom: 10, borderWidth: 1, borderRadius: 16 },
    taskCardContent: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingRight: 12 },
    taskDetails: { flex: 1, marginLeft: 4 },
    taskMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
    projectMeta: { flexShrink: 1 },
    dueChip: { marginLeft: 8 },
    empty: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingTop: 72 },
    emptyIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    emptyTitle: { textAlign: 'center', marginBottom: 6 },
    emptyDescription: { textAlign: 'center', lineHeight: 21 },
    fab: { position: 'absolute', right: 16 },
});
