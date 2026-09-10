import { useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text as NativeText, View } from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useColorScheme } from 'nativewind';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { refreshAllData, useNoteStore, useProjectStore, useTaskStore } from '@simpletracker/core';
import type { ProjectsStackParamList } from '../navigation/types';
import { useThemeStore } from '../store/themeStore';
import { Surface, getUiTheme } from '@simpletracker/ui';

type Nav = NativeStackNavigationProp<ProjectsStackParamList, 'ProjectsList'>;

export function ProjectsListScreen() {
    const tabBarHeight = useBottomTabBarHeight();
    const navigation = useNavigation<Nav>();
    const projects = useProjectStore((s) => s.projects);
    const createBlankProject = useProjectStore((s) => s.createBlankProject);
    const tasks = useTaskStore((s) => s.tasks);
    const notes = useNoteStore((s) => s.notes);
    const archivedNotes = useNoteStore((s) => s.archivedNotes);
    const sharedNotes = useNoteStore((s) => s.sharedNotes);
    const { effectiveTheme } = useThemeStore();
    const theme = getUiTheme(effectiveTheme);
    const { setColorScheme } = useColorScheme();

    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        setColorScheme(effectiveTheme);
    }, [effectiveTheme, setColorScheme]);

    const onRefresh = async () => {
        setRefreshing(true);
        try {
            await refreshAllData();
        } catch (error) {
            console.warn('Failed to refresh projects:', error);
        } finally {
            setRefreshing(false);
        }
    };

    const onAdd = async () => {
        const project = await createBlankProject();
        navigation.navigate('ProjectDetail', { id: project.recordID });
    };

    const allNotes = [...notes, ...sharedNotes, ...archivedNotes];
    const sortedProjects = [...projects].sort((a, b) => {
        const aUsage = allNotes.filter((note) => note.projectID === a.recordID).length +
            tasks.filter((task) => task.projectID === a.recordID).length;
        const bUsage = allNotes.filter((note) => note.projectID === b.recordID).length +
            tasks.filter((task) => task.projectID === b.recordID).length;
        return bUsage - aUsage;
    });

    const getProjectStats = (projectID: string) => {
        const projectNotes = allNotes.filter((note) => note.projectID === projectID);
        const projectTasks = tasks.filter((task) => task.projectID === projectID);
        const completedTasks = projectTasks.filter((task) => task.status === 'completed').length;
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const overdueTasks = projectTasks.filter((task) =>
            task.status === 'open' && task.dueDate != null && task.dueDate < todayStart.getTime(),
        ).length;

        return {
            noteCount: projectNotes.length,
            taskCount: projectTasks.length,
            completedTaskCount: completedTasks,
            overdueTaskCount: overdueTasks,
        };
    };

    return (
        <View className="flex-1 bg-background dark:bg-background-dark">
            <View className="px-4 pb-3 pt-5">
                <NativeText className="text-lg font-bold text-on-surface dark:text-on-surface-dark">Your projects</NativeText>
                <NativeText className="mt-1 text-sm text-on-surface-variant dark:text-on-surface-variant-dark">
                    {projects.length} {projects.length === 1 ? 'project' : 'projects'} · Organized by activity
                </NativeText>
            </View>

            <FlatList
                data={sortedProjects}
                keyExtractor={(project) => project.recordID}
                contentContainerStyle={{ paddingTop: 4, paddingBottom: tabBarHeight + 96, ...(sortedProjects.length === 0 ? { flexGrow: 1 } : {}) }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                ListEmptyComponent={
                    <View className="flex-1 items-center justify-center px-8 pt-16">
                        <View className="mb-4 h-16 w-16 items-center justify-center rounded-3xl bg-primary-container dark:bg-primary-container-dark">
                            <MaterialCommunityIcons name="folder-plus-outline" size={30} color={theme.primary} />
                        </View>
                        <NativeText className="text-center text-lg font-bold text-on-surface dark:text-on-surface-dark">No projects yet</NativeText>
                        <NativeText className="mt-2 text-center text-sm leading-5 text-on-surface-variant dark:text-on-surface-variant-dark">
                            Create a project to keep related notes and tasks together.
                        </NativeText>
                    </View>
                }
                renderItem={({ item }) => {
                    const stats = getProjectStats(item.recordID);
                    return (
                        <Surface className="mx-4 mb-3 overflow-hidden">
                            <Pressable onPress={() => navigation.navigate('ProjectDetail', { id: item.recordID })} className="active:opacity-70">
                                <View className="flex-row items-center px-4 py-3">
                                    <View className="h-11 w-11 items-center justify-center rounded-2xl bg-primary-container dark:bg-primary-container-dark">
                                        <MaterialCommunityIcons name="folder-outline" size={22} color={theme.primary} />
                                    </View>
                                    <View className="min-w-0 flex-1 pl-3">
                                        <NativeText numberOfLines={1} className="text-base font-semibold text-on-surface dark:text-on-surface-dark">
                                            {item.name || '(untitled)'}
                                        </NativeText>
                                        <NativeText numberOfLines={1} className="mt-1 text-sm text-on-surface-variant dark:text-on-surface-variant-dark">
                                            {item.description?.trim() || 'No description yet'}
                                        </NativeText>
                                        <NativeText className="mt-2 text-xs text-on-surface-variant dark:text-on-surface-variant-dark">
                                            {stats.noteCount} {stats.noteCount === 1 ? 'note' : 'notes'} · {stats.completedTaskCount}/{stats.taskCount} tasks complete
                                        </NativeText>
                                    </View>
                                    <View className="ml-3 min-w-[46px] items-end">
                                        <NativeText className="text-base font-bold text-primary dark:text-primary">{stats.taskCount}</NativeText>
                                        <NativeText className="text-xs text-on-surface-variant dark:text-on-surface-variant-dark">tasks</NativeText>
                                        {stats.overdueTaskCount > 0 && (
                                            <NativeText className="mt-1 text-right text-xs font-semibold text-error dark:text-error-dark">
                                                {stats.overdueTaskCount} overdue
                                            </NativeText>
                                        )}
                                    </View>
                                </View>
                            </Pressable>
                        </Surface>
                    );
                }}
            />

            <Pressable
                accessibilityLabel="New project"
                accessibilityRole="button"
                onPress={onAdd}
                className="absolute right-4 items-center justify-center rounded-2xl bg-primary px-5 py-4 shadow-lg active:bg-primary-container dark:bg-primary dark:active:bg-primary-container-dark"
                style={{ bottom: tabBarHeight + 24 }}
            >
                <View className="flex-row items-center gap-2">
                    <MaterialCommunityIcons name="plus" size={20} color={theme.onPrimary} />
                    <NativeText className="font-bold text-on-primary dark:text-on-primary-dark">New project</NativeText>
                </View>
            </Pressable>
        </View>
    );
}
