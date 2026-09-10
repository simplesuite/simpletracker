import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Card, FAB, List, Text, useTheme } from 'react-native-paper';
import { refreshAllData, useNoteStore, useProjectStore, useTaskStore } from '@simpletracker/core';
import type { ProjectsStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<ProjectsStackParamList, 'ProjectsList'>;

export function ProjectsListScreen() {
    const theme = useTheme();
    const tabBarHeight = useBottomTabBarHeight();
    const navigation = useNavigation<Nav>();
    const projects = useProjectStore((s) => s.projects);
    const createBlankProject = useProjectStore((s) => s.createBlankProject);
    const tasks = useTaskStore((s) => s.tasks);
    const notes = useNoteStore((s) => s.notes);
    const archivedNotes = useNoteStore((s) => s.archivedNotes);
    const sharedNotes = useNoteStore((s) => s.sharedNotes);

    const [refreshing, setRefreshing] = useState(false);

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
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <View style={styles.header}>
                <Text variant="titleMedium">Your projects</Text>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    {projects.length} {projects.length === 1 ? 'project' : 'projects'} · Organised by activity
                </Text>
            </View>

            <FlatList
                data={sortedProjects}
                keyExtractor={(project) => project.recordID}
                contentContainerStyle={[
                    styles.listContent,
                    sortedProjects.length === 0 && styles.emptyListContent,
                    { paddingBottom: tabBarHeight + 96 },
                ]}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <View style={[styles.emptyIcon, { backgroundColor: theme.colors.primaryContainer }]}>
                            <List.Icon icon="folder-plus-outline" color={theme.colors.primary} />
                        </View>
                        <Text variant="titleMedium" style={styles.emptyTitle}>No projects yet</Text>
                        <Text variant="bodyMedium" style={[styles.emptyDescription, { color: theme.colors.onSurfaceVariant }]}>
                            Create a project to keep related notes and tasks together.
                        </Text>
                    </View>
                }
                renderItem={({ item }) => {
                    const stats = getProjectStats(item.recordID);
                    return (
                        <Card
                            mode="contained"
                            onPress={() => navigation.navigate('ProjectDetail', { id: item.recordID })}
                            style={[styles.projectCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}
                        >
                            <Card.Content style={styles.projectCardContent}>
                                <View style={[styles.projectIcon, { backgroundColor: theme.colors.primaryContainer }]}>
                                    <List.Icon icon="folder-outline" color={theme.colors.onPrimaryContainer} />
                                </View>
                                <View style={styles.projectDetails}>
                                    <Text variant="titleMedium" numberOfLines={1}>
                                        {item.name || '(untitled)'}
                                    </Text>
                                    <Text
                                        variant="bodyMedium"
                                        numberOfLines={1}
                                        style={{ color: theme.colors.onSurfaceVariant, marginTop: 3 }}
                                    >
                                        {item.description?.trim() || 'No description yet'}
                                    </Text>
                                    <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 6 }}>
                                        {stats.noteCount} {stats.noteCount === 1 ? 'note' : 'notes'} · {stats.completedTaskCount}/{stats.taskCount} tasks complete
                                    </Text>
                                </View>
                                <View style={styles.projectStats}>
                                    <Text variant="labelLarge" style={{ color: theme.colors.primary }}>
                                        {stats.taskCount}
                                    </Text>
                                    <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                        tasks
                                    </Text>
                                    {stats.overdueTaskCount > 0 && (
                                        <Text variant="labelSmall" style={[styles.overdueText, { color: theme.colors.error }]}>
                                            {stats.overdueTaskCount} overdue
                                        </Text>
                                    )}
                                </View>
                            </Card.Content>
                        </Card>
                    );
                }}
            />

            <FAB
                icon="plus"
                size="small"
                accessibilityLabel="New project"
                style={[styles.fab, { bottom: tabBarHeight + 24 }]}
                onPress={onAdd}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 12 },
    listContent: { paddingTop: 4 },
    emptyListContent: { flexGrow: 1 },
    projectCard: { marginHorizontal: 16, marginBottom: 10, borderWidth: 1, borderRadius: 16 },
    projectCardContent: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
    projectIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    projectDetails: { flex: 1, marginLeft: 12 },
    projectStats: { alignItems: 'flex-end', marginLeft: 8, minWidth: 46 },
    overdueText: { marginTop: 5, textAlign: 'right' },
    empty: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingTop: 72 },
    emptyIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    emptyTitle: { textAlign: 'center', marginBottom: 6 },
    emptyDescription: { textAlign: 'center', lineHeight: 21 },
    fab: { position: 'absolute', right: 16 },
});
