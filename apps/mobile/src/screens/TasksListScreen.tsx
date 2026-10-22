import { useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text as NativeText, TextInput, View } from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useColorScheme } from 'nativewind';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { refreshAllData, useProjectStore, useTaskStore } from '@simpletracker/core';
import type { Task } from '@simpletracker/core';
import type { TasksStackParamList } from '../navigation/types';
import { useThemeStore } from '../store/themeStore';
import { Button, Dialog, Pill, Snackbar, Surface, getUiTheme } from '@simpletracker/ui';
import dayjs from 'dayjs';

type Nav = NativeStackNavigationProp<TasksStackParamList, 'TasksList'>;

async function waitForStoreRecord(isPresent: () => boolean): Promise<boolean> {
    for (let attempt = 0; attempt < 10; attempt += 1) {
        if (isPresent()) return true;
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
    return isPresent();
}

type TaskSection = {
    key: string;
    title: string;
    data: Task[];
    tone?: 'error' | 'warning';
    action?: 'reschedule' | 'delete-completed';
};

export function TasksListScreen() {
    const tabBarHeight = useBottomTabBarHeight();
    const navigation = useNavigation<Nav>();
    const tasks = useTaskStore((s) => s.tasks);
    const createBlankTask = useTaskStore((s) => s.createBlankTask);
    const completeTask = useTaskStore((s) => s.completeTask);
    const reopenTask = useTaskStore((s) => s.reopenTask);
    const deleteTask = useTaskStore((s) => s.deleteTask);
    const updateTask = useTaskStore((s) => s.updateTask);
    const projects = useProjectStore((s) => s.projects);
    const { effectiveTheme } = useThemeStore();
    const theme = getUiTheme(effectiveTheme);
    const { setColorScheme } = useColorScheme();

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedProjectIDs, setSelectedProjectIDs] = useState<Set<string>>(new Set());
    const [refreshing, setRefreshing] = useState(false);
    const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);
    const [deleteCompletedDialogOpen, setDeleteCompletedDialogOpen] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);
    // Collapsed section keys. Completed starts collapsed to mirror the web app.
    const [collapsedSections, setCollapsedSections] = useState<Set<string>>(() => new Set(['completed']));

    const toggleSection = (key: string) => {
        setCollapsedSections((previous) => {
            const next = new Set(previous);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    useEffect(() => {
        setColorScheme(effectiveTheme);
    }, [effectiveTheme, setColorScheme]);

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
        const createError = useTaskStore.getState().error;
        if (createError) {
            setActionError(createError);
            return;
        }
        const visible = await waitForStoreRecord(() => useTaskStore.getState().tasks.some((item) => item.recordID === task.recordID));
        if (visible) navigation.navigate('TaskDetail', { id: task.recordID });
        else setActionError(useTaskStore.getState().error ?? 'Unable to create task. Check your connection and try again.');
    };

    const openTasks = tasks.filter((task) => task.status === 'open');
    const completedTasks = tasks.filter((task) => task.status === 'completed');
    const query = searchQuery.trim().toLowerCase();
    const matchesFilters = (task: Task) => {
        const matchesSearch = !query || task.title.toLowerCase().includes(query) || task.body.toLowerCase().includes(query);
        const matchesProject = selectedProjectIDs.size === 0 || (
            typeof task.projectID === 'string' && selectedProjectIDs.has(task.projectID)
        );
        return matchesSearch && matchesProject;
    };
    const filteredTasks = openTasks.filter(matchesFilters);
    const filteredCompletedTasks = completedTasks.filter(matchesFilters);

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
        ...(overdueTasks.length > 0 ? [{ key: 'overdue', title: 'Overdue', data: overdueTasks, tone: 'error' as const, action: 'reschedule' as const }] : []),
        ...(dueTodayTasks.length > 0 ? [{ key: 'today', title: 'Due Today', data: dueTodayTasks, tone: 'warning' as const }] : []),
        ...(dueTomorrowTasks.length > 0 ? [{ key: 'tomorrow', title: 'Tomorrow', data: dueTomorrowTasks }] : []),
        ...(dueThisWeekTasks.length > 0 ? [{ key: 'week', title: 'This Week', data: dueThisWeekTasks }] : []),
        ...(upcomingTasks.length > 0 ? [{ key: 'upcoming', title: 'Upcoming', data: upcomingTasks }] : []),
        ...(noDueDateTasks.length > 0 ? [{ key: 'nodue', title: 'No Due Date', data: noDueDateTasks }] : []),
        ...(filteredCompletedTasks.length > 0 ? [{ key: 'completed', title: 'Completed', data: filteredCompletedTasks, action: 'delete-completed' as const }] : []),
    ];

    const sortedProjects = [...projects].sort((a, b) => {
        const aCount = tasks.filter((task) => task.projectID === a.recordID).length;
        const bCount = tasks.filter((task) => task.projectID === b.recordID).length;
        return bCount - aCount;
    });

    const hasFilters = searchQuery.trim().length > 0 || selectedProjectIDs.size > 0;
    const placeholderColor = theme.onSurfaceVariant;

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
        const timeSuffix = date.hour() !== 0 || date.minute() !== 0
            ? ` ${date.toDate().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
            : '';
        // Show the actual date (with year when it differs), matching the web app.
        const dateLabel = date.year() !== today.year() ? date.format('MMM D, YYYY') : date.format('MMM D');
        if (diffDays < 0) return `${dateLabel}${timeSuffix}`;
        if (diffDays === 0) return `Today${timeSuffix}`;
        if (diffDays === 1) return `Tomorrow${timeSuffix}`;
        if (diffDays <= 7) return `${date.format('ddd')}${timeSuffix}`;
        return `${dateLabel}${timeSuffix}`;
    };

    const rescheduleOverdue = async () => {
        setRescheduleDialogOpen(false);
        const today = dayjs().startOf('day');
        const results = await Promise.all(overdueTasks.map((task) => {
            const original = dayjs(task.dueDate);
            const dueDate = today.hour(original.hour()).minute(original.minute()).second(0).millisecond(0).valueOf();
            return updateTask(task.recordID, { dueDate });
        }));
        const failed = results.filter((success) => !success).length;
        if (failed > 0) setActionError(`Unable to reschedule ${failed} ${failed === 1 ? 'task' : 'tasks'}.`);
    };

    const deleteCompleted = async () => {
        setDeleteCompletedDialogOpen(false);
        const results = await Promise.all(filteredCompletedTasks.map((task) => deleteTask(task.recordID)));
        const failed = results.filter((success) => !success).length;
        if (failed > 0) setActionError(`Unable to delete ${failed} completed ${failed === 1 ? 'task' : 'tasks'}.`);
    };

    const toggleTask = async (task: Task) => {
        const success = task.status === 'completed'
            ? await reopenTask(task.recordID)
            : await completeTask(task.recordID);
        if (!success) setActionError(useTaskStore.getState().error ?? 'Unable to update task.');
    };

    // Small outlined chip used for due-date / recurring / project metadata,
    // mirroring the web task list's secondary-row chips.
    const MetaChip = ({ label, tone = 'default', icon }: { label: string; tone?: 'default' | 'error' | 'warning' | 'secondary'; icon?: keyof typeof MaterialCommunityIcons.glyphMap }) => {
        // The design system has no dedicated "warning" token; the amber `primary`
        // is the closest analog to the web app's warning color.
        const toneClasses = {
            default: 'border-outline-variant dark:border-outline-variant-dark',
            error: 'border-error dark:border-error-dark',
            warning: 'border-primary dark:border-primary',
            secondary: 'border-secondary dark:border-secondary',
        }[tone];
        const toneText = {
            default: 'text-on-surface-variant dark:text-on-surface-variant-dark',
            error: 'text-error dark:text-error-dark',
            warning: 'text-primary dark:text-primary',
            secondary: 'text-secondary dark:text-secondary',
        }[tone];
        const iconColor = { default: theme.onSurfaceVariant, error: theme.error, warning: theme.primary, secondary: theme.secondary }[tone];
        return (
            <View className={`flex-row items-center self-start rounded-full border px-2 py-0.5 ${toneClasses}`}>
                {icon ? <MaterialCommunityIcons name={icon} size={12} color={iconColor} style={{ marginRight: 3 }} /> : null}
                <NativeText numberOfLines={1} className={`text-xs font-medium ${toneText}`}>{label}</NativeText>
            </View>
        );
    };

    const renderTask = (item: Task, showDivider: boolean) => {
        const isCompleted = item.status === 'completed';
        const projectName = item.projectID
            ? projects.find((project) => project.recordID === item.projectID)?.name
            : undefined;
        const isOverdue = !isCompleted && item.dueDate != null && item.dueDate < new Date().setHours(0, 0, 0, 0);
        const hasMeta = item.dueDate != null || item.isRecurring || !!projectName;

        return (
            <View key={item.recordID} className={`flex-row items-center px-3 py-2.5 ${showDivider ? 'border-t border-outline-variant dark:border-outline-variant-dark' : ''}`}>
                <Pressable
                    accessibilityLabel={`${isCompleted ? 'Reopen' : 'Complete'} ${item.title || 'task'}`}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isCompleted }}
                    onPress={() => toggleTask(item)}
                    className={`mr-3 h-7 w-7 items-center justify-center rounded-lg border-2 ${isCompleted ? 'border-primary bg-primary dark:border-primary dark:bg-primary' : 'border-outline bg-transparent dark:border-outline-dark'}`}
                >
                    {isCompleted ? <NativeText className="font-bold text-on-primary dark:text-on-primary-dark">✓</NativeText> : <MaterialCommunityIcons name="check" size={17} color="transparent" />}
                </Pressable>
                <Pressable
                    accessibilityRole="button"
                    onPress={() => navigation.navigate('TaskDetail', { id: item.recordID })}
                    className="min-w-0 flex-1 active:opacity-70"
                >
                    <NativeText numberOfLines={1} className={`text-base font-medium text-on-surface dark:text-on-surface-dark ${isCompleted ? 'line-through opacity-60' : ''}`}>
                        {item.title || '(untitled)'}
                    </NativeText>
                    {hasMeta && (
                        <View className="mt-1 flex-row items-center justify-between gap-2">
                            <View className="min-w-0 flex-shrink flex-row flex-wrap items-center gap-1.5">
                                {item.dueDate != null && (
                                    <MetaChip label={formatDueDate(item.dueDate)} tone={isOverdue ? 'error' : 'default'} icon="calendar-outline" />
                                )}
                                {item.isRecurring && <MetaChip label="Recurring" tone="secondary" icon="repeat" />}
                            </View>
                            {projectName && (
                                <View className="min-w-0 flex-shrink">
                                    <MetaChip label={projectName} />
                                </View>
                            )}
                        </View>
                    )}
                </Pressable>
            </View>
        );
    };

    const renderSection = (section: TaskSection) => {
        const collapsed = collapsedSections.has(section.key);
        const toneText = section.tone === 'error'
            ? 'text-error dark:text-error-dark'
            : section.tone === 'warning'
                ? 'text-primary dark:text-primary'
                : 'text-on-surface dark:text-on-surface-dark';
        const chevronColor = section.tone === 'error' ? theme.error : section.tone === 'warning' ? theme.primary : theme.onSurface;

        return (
            <View key={section.key} className="mb-4">
                <View className="flex-row items-center justify-between px-2">
                    <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ expanded: !collapsed }}
                        onPress={() => toggleSection(section.key)}
                        className="min-w-0 flex-1 flex-row items-center py-1 active:opacity-70"
                    >
                        <MaterialCommunityIcons name={collapsed ? 'chevron-right' : 'chevron-down'} size={20} color={chevronColor} />
                        <NativeText className={`ml-0.5 text-sm font-bold ${toneText}`}>
                            {section.title} ({section.data.length})
                        </NativeText>
                    </Pressable>
                    {section.action === 'reschedule' ? (
                        <Button variant="text" compact onPress={() => setRescheduleDialogOpen(true)}>Move to today</Button>
                    ) : section.action === 'delete-completed' ? (
                        <Button variant="danger" compact onPress={() => setDeleteCompletedDialogOpen(true)}>Delete all</Button>
                    ) : null}
                </View>
                {!collapsed && (
                    <Surface className="mt-1.5 overflow-hidden">
                        {section.data.map((task, index) => renderTask(task, index > 0))}
                    </Surface>
                )}
            </View>
        );
    };

    return (
        <View className="flex-1 bg-background dark:bg-background-dark">
            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingTop: 4, paddingBottom: tabBarHeight + 96, ...(sections.length === 0 ? { flexGrow: 1 } : {}) }}
                keyboardShouldPersistTaps="handled"
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                <View className="px-4 pb-4 pt-4">
                    <View className="relative">
                        <MaterialCommunityIcons name="magnify" size={21} color={placeholderColor} style={{ position: 'absolute', left: 16, top: 16, zIndex: 1 }} />
                        <TextInput
                            placeholder="Search your tasks"
                            placeholderTextColor={placeholderColor}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            autoCapitalize="none"
                            className="h-14 rounded-2xl border border-outline-variant bg-surface pl-12 pr-4 text-base text-on-surface dark:border-outline-variant-dark dark:bg-surface-dark dark:text-on-surface-dark"
                        />
                    </View>
                </View>
                {sortedProjects.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingBottom: 11 }}>
                        <Pill selected={selectedProjectIDs.size === 0} onPress={() => setSelectedProjectIDs(new Set())}>
                            All tasks
                        </Pill>
                        {sortedProjects.map((project) => (
                            <Pill
                                key={project.recordID}
                                selected={selectedProjectIDs.has(project.recordID)}
                                onPress={() => toggleProjectFilter(project.recordID)}
                            >
                                {project.name} ({tasks.filter((task) => task.projectID === project.recordID).length})
                            </Pill>
                        ))}
                    </ScrollView>
                )}

                {sections.length === 0 ? (
                    <View className="flex-1 items-center justify-center px-8 pt-16">
                        <View className="mb-4 h-16 w-16 items-center justify-center rounded-3xl bg-primary-container dark:bg-primary-container-dark">
                            <MaterialCommunityIcons name={hasFilters ? 'magnify' : 'checkbox-marked-circle-outline'} size={30} color={theme.primary} />
                        </View>
                        <NativeText className="text-center text-lg font-bold text-on-surface dark:text-on-surface-dark">
                            {hasFilters ? 'No tasks found' : 'No tasks yet'}
                        </NativeText>
                        <NativeText className="mt-2 text-center text-sm leading-5 text-on-surface-variant dark:text-on-surface-variant-dark">
                            {hasFilters ? 'Try a different search or clear your filters.' : 'Add a task to keep your next steps in view.'}
                        </NativeText>
                    </View>
                ) : (
                    <View className="px-4 pt-2">
                        {sections.map(renderSection)}
                    </View>
                )}
            </ScrollView>

            <Dialog
                visible={rescheduleDialogOpen}
                onDismiss={() => setRescheduleDialogOpen(false)}
                title="Move overdue tasks?"
                actions={(
                    <>
                        <Button variant="text" compact onPress={() => setRescheduleDialogOpen(false)}>Cancel</Button>
                        <Button compact onPress={rescheduleOverdue}>Move to today</Button>
                    </>
                )}
            >
                <NativeText className="text-base leading-6 text-on-surface-variant dark:text-on-surface-dark">
                    Move {overdueTasks.length} overdue {overdueTasks.length === 1 ? 'task' : 'tasks'} to today while keeping their existing times?
                </NativeText>
            </Dialog>
            <Dialog
                visible={deleteCompletedDialogOpen}
                onDismiss={() => setDeleteCompletedDialogOpen(false)}
                title="Delete completed tasks?"
                actions={(
                    <>
                        <Button variant="text" compact onPress={() => setDeleteCompletedDialogOpen(false)}>Cancel</Button>
                        <Button variant="danger" compact onPress={deleteCompleted}>Delete all</Button>
                    </>
                )}
            >
                <NativeText className="text-base leading-6 text-on-surface-variant dark:text-on-surface-dark">
                    This will permanently delete {filteredCompletedTasks.length} completed {filteredCompletedTasks.length === 1 ? 'task' : 'tasks'} and their subtasks.
                </NativeText>
            </Dialog>
            <Snackbar visible={!!actionError} onDismiss={() => setActionError(null)} onAction={() => setActionError(null)} bottomOffset={tabBarHeight + 24}>{actionError}</Snackbar>

            <Pressable
                accessibilityLabel="New task"
                accessibilityRole="button"
                onPress={onAdd}
                className="absolute right-4 items-center justify-center rounded-2xl bg-primary px-5 py-4 shadow-lg active:bg-primary-container dark:bg-primary dark:active:bg-primary-container-dark"
                style={{ bottom: tabBarHeight + 24 }}
            >
                <View className="flex-row items-center gap-2">
                    <MaterialCommunityIcons name="plus" size={20} color={theme.onPrimary} />
                    <NativeText className="font-bold text-on-primary dark:text-on-primary-dark">New task</NativeText>
                </View>
            </Pressable>
        </View>
    );
}
