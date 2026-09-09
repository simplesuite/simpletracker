import { useState } from 'react';
import { FlatList, View, StyleSheet } from 'react-native';
import { List, FAB, Text, Chip } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useProjectStore, useTaskStore, useNoteStore } from '@simpletracker/core';
import type { ProjectsStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<ProjectsStackParamList, 'ProjectsList'>;

export function ProjectsListScreen() {
    const navigation = useNavigation<Nav>();
    const projects = useProjectStore((s) => s.projects);
    const createBlankProject = useProjectStore((s) => s.createBlankProject);
    const tasks = useTaskStore((s) => s.tasks);
    const notes = useNoteStore((s) => s.notes);
    const archivedNotes = useNoteStore((s) => s.archivedNotes);
    const sharedNotes = useNoteStore((s) => s.sharedNotes);

    const [sortByUsage, setSortByUsage] = useState(true);

    const onAdd = async () => {
        const project = await createBlankProject();
        navigation.navigate('ProjectDetail', { id: project.recordID });
    };

    // Combine all notes
    const allNotes = [...notes, ...sharedNotes, ...archivedNotes];

    // Sort projects by usage (notes + tasks count)
    const sortedProjects = sortByUsage
        ? [...projects].sort((a, b) => {
              const aCount = allNotes.filter((n) => n.projectID === a.recordID).length +
                            tasks.filter((t) => t.projectID === a.recordID).length;
              const bCount = allNotes.filter((n) => n.projectID === b.recordID).length +
                            tasks.filter((t) => t.projectID === b.recordID).length;
              return bCount - aCount;
          })
        : projects;

    // Calculate project stats
    const getProjectStats = (projectID: string) => {
        const projectNotes = allNotes.filter((n) => n.projectID === projectID);
        const projectTasks = tasks.filter((t) => t.projectID === projectID);
        const completedTasks = projectTasks.filter((t) => t.status === 'completed').length;
        const overdueTasks = projectTasks.filter((t) => {
            if (t.status !== 'open' || t.dueDate == null) return false;
            const now = new Date();
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
            return t.dueDate < todayStart;
        }).length;

        return {
            noteCount: projectNotes.length,
            taskCount: projectTasks.length,
            completedTaskCount: completedTasks,
            overdueTaskCount: overdueTasks,
        };
    };

    return (
        <View style={styles.container}>
            {sortedProjects.length === 0 ? (
                <View style={styles.empty}>
                    <Text variant="bodyLarge">No projects yet.</Text>
                </View>
            ) : (
                <FlatList
                    data={sortedProjects}
                    keyExtractor={(p) => p.recordID}
                    renderItem={({ item }) => {
                        const stats = getProjectStats(item.recordID);
                        return (
                            <List.Item
                                title={item.name || '(untitled)'}
                                description={item.description || undefined}
                                left={(props) => (
                                    <View style={styles.projectIcon}>
                                        <List.Icon {...props} icon="folder-outline" />
                                    </View>
                                )}
                                right={() => (
                                    <View style={styles.projectStats}>
                                        <View style={styles.statRow}>
                                            <Chip
                                                icon="note-text-outline"
                                                style={styles.chip}
                                                compact
                                            >
                                                {stats.noteCount}
                                            </Chip>
                                            <Chip
                                                icon={stats.overdueTaskCount > 0 ? 'alert' : 'check-circle-outline'}
                                                style={[styles.chip, stats.overdueTaskCount > 0 && styles.chipOverdue]}
                                                compact
                                            >
                                                {stats.completedTaskCount}/{stats.taskCount}
                                            </Chip>
                                        </View>
                                        {stats.overdueTaskCount > 0 && (
                                            <View style={styles.overdueBadge}>
                                                <Text variant="bodySmall">{stats.overdueTaskCount} overdue</Text>
                                            </View>
                                        )}
                                    </View>
                                )}
                                onPress={() => navigation.navigate('ProjectDetail', { id: item.recordID })}
                            />
                        );
                    }}
                />
            )}
            <FAB icon="plus" style={styles.fab} onPress={onAdd} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    projectIcon: { marginRight: 8 },
    projectStats: { alignItems: 'flex-end' },
    statRow: { flexDirection: 'row', gap: 4 },
    chip: { height: 28 },
    chipOverdue: { backgroundColor: '#ffebee' },
    overdueBadge: { marginTop: 4, backgroundColor: '#e53935' },
    fab: { position: 'absolute', right: 16, bottom: 16 },
});
