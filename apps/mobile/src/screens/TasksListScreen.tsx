import { useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, SectionList, Text as NativeText, TextInput, View } from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useColorScheme } from 'nativewind';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { refreshAllData, useProjectStore, useTaskStore } from '@simpletracker/core';
import type { Task } from '@simpletracker/core';
import type { TasksStackParamList } from '../navigation/types';
import { useThemeStore } from '../store/themeStore';
import { Pill } from '../components/ui/Pill';
import { Surface } from '../components/ui/Surface';
import dayjs from 'dayjs';

type Nav = NativeStackNavigationProp<TasksStackParamList, 'TasksList'>;

type TaskSection = {
    title: string;
    data: Task[];
};

export function TasksListScreen() {
    const tabBarHeight = useBottomTabBarHeight();
    const navigation = useNavigation<Nav>();
    const tasks = useTaskStore((s) => s.tasks);
    const createBlankTask = useTaskStore((s) => s.createBlankTask);
    const completeTask = useTaskStore((s) => s.completeTask);
    const projects = useProjectStore((s) => s.projects);
    const { effectiveTheme } = useThemeStore();
    const { setColorScheme } = useColorScheme();

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedProjectIDs, setSelectedProjectIDs] = useState<Set<string>>(new Set());
    const [refreshing, setRefreshing] = useState(false);

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
    const placeholderColor = effectiveTheme === 'dark' ? '#94a3b8' : '#64748b';

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

        return (
            <Surface className="mx-4 mb-3 overflow-hidden">
                <View className="flex-row items-center px-4 py-3">
                    <Pressable
                        accessibilityLabel={`Complete ${item.title || 'task'}`}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: false }}
                        onPress={() => completeTask(item.recordID)}
                        className="mr-3 h-7 w-7 items-center justify-center rounded-lg border-2 border-slate-300 bg-transparent dark:border-slate-600"
                    >
                        <MaterialCommunityIcons name="check" size={17} color="transparent" />
                    </Pressable>
                    <Pressable
                        accessibilityRole="button"
                        onPress={() => navigation.navigate('TaskDetail', { id: item.recordID })}
                        className="min-w-0 flex-1 flex-row items-center active:opacity-70"
                    >
                        <View className="min-w-0 flex-1">
                            <NativeText numberOfLines={1} className="text-base font-semibold text-slate-900 dark:text-slate-50">
                                {item.title || '(untitled)'}
                            </NativeText>
                            <View className="mt-1 flex-row items-center gap-2">
                                {projectName && (
                                    <NativeText numberOfLines={1} className="max-w-[55%] text-xs font-medium text-indigo-600 dark:text-indigo-300">
                                        {projectName}
                                    </NativeText>
                                )}
                                {item.isRecurring && (
                                    <NativeText className="text-xs text-slate-500 dark:text-slate-400">Recurring</NativeText>
                                )}
                            </View>
                        </View>
                        {item.dueDate != null && (
                            <View className={`ml-3 flex-row items-center rounded-full px-3 py-2 ${isOverdue ? 'bg-red-100 dark:bg-red-950' : 'bg-indigo-100 dark:bg-indigo-950'}`}>
                                <MaterialCommunityIcons name="calendar-outline" size={14} color={isOverdue ? '#ef4444' : '#6366f1'} />
                                <NativeText className={`ml-1 text-xs font-semibold ${isOverdue ? 'text-red-700 dark:text-red-200' : 'text-indigo-700 dark:text-indigo-200'}`}>
                                    {formatDueDate(item.dueDate)}
                                </NativeText>
                            </View>
                        )}
                    </Pressable>
                </View>
            </Surface>
        );
    };

    return (
        <View className="flex-1 bg-slate-50 dark:bg-slate-950">
            <View className="px-4 pb-1 pt-4">
                <View className="relative">
                    <MaterialCommunityIcons name="magnify" size={21} color={placeholderColor} style={{ position: 'absolute', left: 16, top: 16, zIndex: 1 }} />
                    <TextInput
                        placeholder="Search your tasks"
                        placeholderTextColor={placeholderColor}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        autoCapitalize="none"
                        className="h-14 rounded-2xl border border-slate-200 bg-white pl-12 pr-4 text-base text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-50"
                    />
                </View>
                <View className="flex-row items-center justify-between py-4">
                    <View>
                        <NativeText className="text-lg font-bold text-slate-950 dark:text-slate-50">Your tasks</NativeText>
                        <NativeText className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            {filteredTasks.length} open · {dueSoonCount} due soon
                        </NativeText>
                    </View>
                    {hasFilters && (
                        <Pill
                            selected={false}
                            onPress={() => {
                                setSearchQuery('');
                                setSelectedProjectIDs(new Set());
                            }}
                            className="min-h-9 px-3"
                        >
                            Clear filters
                        </Pill>
                    )}
                </View>
            </View>

            {sortedProjects.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingVertical: 10 }}>
                    <Pill selected={selectedProjectIDs.size === 0} onPress={() => setSelectedProjectIDs(new Set())}>
                        All tasks
                    </Pill>
                    {sortedProjects.map((project) => (
                        <Pill
                            key={project.recordID}
                            selected={selectedProjectIDs.has(project.recordID)}
                            onPress={() => toggleProjectFilter(project.recordID)}
                        >
                            {project.name} · {tasks.filter((task) => task.projectID === project.recordID).length}
                        </Pill>
                    ))}
                </ScrollView>
            )}

            <SectionList
                sections={sections}
                keyExtractor={(item) => item.recordID}
                contentContainerStyle={{ paddingTop: 4, paddingBottom: tabBarHeight + 96, ...(sections.length === 0 ? { flexGrow: 1 } : {}) }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                ListEmptyComponent={
                    <View className="flex-1 items-center justify-center px-8 pt-16">
                        <View className="mb-4 h-16 w-16 items-center justify-center rounded-3xl bg-indigo-100 dark:bg-indigo-950">
                            <MaterialCommunityIcons name={hasFilters ? 'magnify' : 'checkbox-marked-circle-outline'} size={30} color={effectiveTheme === 'dark' ? '#a5b4fc' : '#4f46e5'} />
                        </View>
                        <NativeText className="text-center text-lg font-bold text-slate-950 dark:text-slate-50">
                            {hasFilters ? 'No tasks found' : 'No tasks yet'}
                        </NativeText>
                        <NativeText className="mt-2 text-center text-sm leading-5 text-slate-500 dark:text-slate-400">
                            {hasFilters ? 'Try a different search or clear your filters.' : 'Add a task to keep your next steps in view.'}
                        </NativeText>
                    </View>
                }
                renderSectionHeader={({ section }) => (
                    <View className="px-5 pb-2 pt-4">
                        <NativeText className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                            {section.title}
                        </NativeText>
                    </View>
                )}
                renderItem={renderTask}
            />

            <Pressable
                accessibilityLabel="New task"
                accessibilityRole="button"
                onPress={onAdd}
                className="absolute right-4 items-center justify-center rounded-2xl bg-indigo-600 px-5 py-4 shadow-lg active:bg-indigo-700 dark:bg-indigo-400 dark:active:bg-indigo-300"
                style={{ bottom: tabBarHeight + 24 }}
            >
                <View className="flex-row items-center gap-2">
                    <MaterialCommunityIcons name="plus" size={20} color={effectiveTheme === 'dark' ? '#0f172a' : '#ffffff'} />
                    <NativeText className="font-bold text-white dark:text-slate-950">New task</NativeText>
                </View>
            </Pressable>
        </View>
    );
}
