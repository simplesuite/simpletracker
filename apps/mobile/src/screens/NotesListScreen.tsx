import { useState } from 'react';
import { RefreshControl, ScrollView, SectionList, StyleSheet, View } from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Card, Chip, FAB, List, Searchbar, Text, useTheme } from 'react-native-paper';
import { refreshAllData, useNoteStore, useProjectStore } from '@simpletracker/core';
import type { NotesStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<NotesStackParamList, 'NotesList'>;

type NoteSection = {
    title: string;
    data: ReturnType<typeof useNoteStore.getState>['notes'];
};

function formatUpdatedAt(updatedAt: number) {
    return new Date(updatedAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
    });
}

export function NotesListScreen() {
    const theme = useTheme();
    const tabBarHeight = useBottomTabBarHeight();
    const navigation = useNavigation<Nav>();
    const notes = useNoteStore((s) => s.notes);
    const archivedNotes = useNoteStore((s) => s.archivedNotes);
    const createNote = useNoteStore((s) => s.createNote);
    const projects = useProjectStore((s) => s.projects);

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedProjectIDs, setSelectedProjectIDs] = useState<Set<string>>(new Set());
    const [refreshing, setRefreshing] = useState(false);

    const onRefresh = async () => {
        setRefreshing(true);
        try {
            await refreshAllData();
        } catch (error) {
            console.warn('Failed to refresh notes:', error);
        } finally {
            setRefreshing(false);
        }
    };

    const onAdd = async () => {
        const note = await createNote();
        if (note) navigation.navigate('NoteDetail', { id: note.recordID });
    };

    const matchesFilters = (note: (typeof notes)[number]) => {
        const query = searchQuery.trim().toLowerCase();
        const matchesSearch = !query || note.title.toLowerCase().includes(query) || note.body.toLowerCase().includes(query);
        const matchesProject = selectedProjectIDs.size === 0 || (
            typeof note.projectID === 'string' && selectedProjectIDs.has(note.projectID)
        );
        return matchesSearch && matchesProject;
    };

    const filteredNotes = notes.filter(matchesFilters);
    const filteredArchivedNotes = archivedNotes.filter(matchesFilters);

    const sortedProjects = [...projects].sort((a, b) => {
        const aCount = notes.filter((note) => note.projectID === a.recordID).length;
        const bCount = notes.filter((note) => note.projectID === b.recordID).length;
        return bCount - aCount;
    });

    const sections: NoteSection[] = [
        ...(filteredNotes.length > 0 ? [{ title: 'Recent', data: filteredNotes }] : []),
        ...(filteredArchivedNotes.length > 0
            ? [{ title: `Archived · ${filteredArchivedNotes.length}`, data: filteredArchivedNotes }]
            : []),
    ];

    const hasFilters = searchQuery.trim().length > 0 || selectedProjectIDs.size > 0;

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

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <View style={styles.controls}>
                <Searchbar
                    placeholder="Search your notes"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    style={[styles.searchbar, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}
                    inputStyle={styles.searchInput}
                    elevation={0}
                />

                <View style={styles.summaryRow}>
                    <View>
                        <Text variant="titleMedium">Your notes</Text>
                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                            {filteredNotes.length} active · {filteredArchivedNotes.length} archived
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
                            style={styles.clearChip}
                        >
                            Clear filters
                        </Chip>
                    )}
                </View>
            </View>

            {sortedProjects.length > 0 && (
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.projectChips}
                >
                    <Chip
                        compact
                        selected={selectedProjectIDs.size === 0}
                        onPress={() => setSelectedProjectIDs(new Set())}
                        style={styles.projectChip}
                    >
                        All notes
                    </Chip>
                    {sortedProjects.map((project) => {
                        const count = notes.filter((note) => note.projectID === project.recordID).length;
                        return (
                            <Chip
                                key={project.recordID}
                                compact
                                selected={selectedProjectIDs.has(project.recordID)}
                                onPress={() => toggleProjectFilter(project.recordID)}
                                style={styles.projectChip}
                            >
                                {project.name} · {count}
                            </Chip>
                        );
                    })}
                </ScrollView>
            )}

            <SectionList
                sections={sections}
                keyExtractor={(item) => item.recordID}
                contentContainerStyle={sections.length === 0
                    ? [styles.emptyListContent, { paddingBottom: tabBarHeight + 96 }]
                    : [styles.listContent, { paddingBottom: tabBarHeight + 96 }]}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={theme.colors.primary}
                    />
                }
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <View style={[styles.emptyIcon, { backgroundColor: theme.colors.primaryContainer }]}>
                            <List.Icon icon={hasFilters ? 'magnify' : 'note-plus-outline'} color={theme.colors.primary} />
                        </View>
                        <Text variant="titleMedium" style={styles.emptyTitle}>
                            {hasFilters ? 'No notes found' : 'No notes yet'}
                        </Text>
                        <Text variant="bodyMedium" style={[styles.emptyDescription, { color: theme.colors.onSurfaceVariant }]}>
                            {hasFilters
                                ? 'Try a different search or clear your filters.'
                                : 'Capture an idea, reminder, or checklist to get started.'}
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
                renderItem={({ item }) => {
                    const projectName = item.projectID
                        ? projects.find((project) => project.recordID === item.projectID)?.name
                        : undefined;
                    const isChecklist = item.noteType === 'list';
                    const iconColor = isChecklist ? theme.colors.onSecondaryContainer : theme.colors.onPrimaryContainer;
                    const iconBackground = isChecklist ? theme.colors.secondaryContainer : theme.colors.primaryContainer;
                    const description = isChecklist
                        ? 'Checklist'
                        : item.body.trim() || 'No content yet';

                    return (
                        <Card
                            mode="contained"
                            onPress={() => navigation.navigate('NoteDetail', { id: item.recordID })}
                            style={[
                                styles.noteCard,
                                item.archived && styles.archivedCard,
                                { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant },
                            ]}
                        >
                            <Card.Content style={styles.noteCardContent}>
                                <View style={[styles.noteIcon, { backgroundColor: iconBackground }]}>
                                    <List.Icon
                                        icon={isChecklist ? 'format-list-checks' : 'note-text-outline'}
                                        color={iconColor}
                                    />
                                </View>
                                <View style={styles.noteDetails}>
                                    <View style={styles.noteTitleRow}>
                                        <Text variant="titleMedium" numberOfLines={1} style={styles.noteTitle}>
                                            {item.title || '(untitled)'}
                                        </Text>
                                        {item.pinned && (
                                            <Chip compact icon="pin" style={styles.pinChip} textStyle={styles.pinChipText}>
                                                Pinned
                                            </Chip>
                                        )}
                                    </View>
                                    <Text
                                        variant="bodyMedium"
                                        numberOfLines={1}
                                        style={{ color: theme.colors.onSurfaceVariant }}
                                    >
                                        {description}
                                    </Text>
                                    <View style={styles.noteMeta}>
                                        <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                            Updated {formatUpdatedAt(item.updatedAt)}
                                        </Text>
                                        {projectName && (
                                            <Text variant="labelSmall" numberOfLines={1} style={[styles.projectMeta, { color: theme.colors.primary }]}>
                                                {projectName}
                                            </Text>
                                        )}
                                    </View>
                                </View>
                            </Card.Content>
                        </Card>
                    );
                }}
            />
            <FAB
                icon="plus"
                size="small"
                accessibilityLabel="New note"
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
    clearChip: { marginLeft: 12 },
    projectChips: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 16,
        paddingBottom: 12,
    },
    projectChip: { minHeight: 36 },
    listContent: { paddingTop: 4, paddingBottom: 104 },
    emptyListContent: { flexGrow: 1, paddingBottom: 104 },
    sectionHeader: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
    noteCard: { marginHorizontal: 16, marginBottom: 10, borderWidth: 1, borderRadius: 16 },
    archivedCard: { opacity: 0.7 },
    noteCardContent: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
    noteIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    noteDetails: { flex: 1, marginLeft: 12 },
    noteTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
    noteTitle: { flex: 1 },
    pinChip: { height: 26, marginLeft: 8 },
    pinChipText: { fontSize: 11 },
    noteMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
    projectMeta: { flexShrink: 1, marginLeft: 8 },
    empty: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingTop: 72 },
    emptyIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    emptyTitle: { textAlign: 'center', marginBottom: 6 },
    emptyDescription: { textAlign: 'center', lineHeight: 21 },
    fab: { position: 'absolute', right: 16 },
});
