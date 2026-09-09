import { useState } from 'react';
import { SectionList, ScrollView, View, StyleSheet, TextInput, RefreshControl } from 'react-native';
import { List, FAB, Text, Chip } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { refreshAllData, useNoteStore, useProjectStore } from '@simpletracker/core';
import type { NotesStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<NotesStackParamList, 'NotesList'>;

export function NotesListScreen() {
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

    // Filter notes by search and project
    const filteredNotes = notes.filter((note) => {
        let matchesSearch = true;
        let matchesProject = true;

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            const titleMatch = note.title.toLowerCase().includes(q) ? true : false;
            const bodyMatch = note.body && typeof note.body === 'string' && note.body.toLowerCase().includes(q) ? true : false;
            matchesSearch = titleMatch || bodyMatch;
        }

        if (selectedProjectIDs.size > 0) {
            const pid = note.projectID;
            matchesProject = typeof pid === 'string' && selectedProjectIDs.has(pid);
        }

        return matchesSearch && matchesProject;
    });

    const filteredArchivedNotes = archivedNotes.filter((note) => {
        let matchesSearch = true;
        let matchesProject = true;

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            const titleMatch = note.title.toLowerCase().includes(q) ? true : false;
            const bodyMatch = note.body && typeof note.body === 'string' && note.body.toLowerCase().includes(q) ? true : false;
            matchesSearch = titleMatch || bodyMatch;
        }

        if (selectedProjectIDs.size > 0) {
            const pid = note.projectID;
            matchesProject = typeof pid === 'string' && selectedProjectIDs.has(pid);
        }

        return matchesSearch && matchesProject;
    });

    // Sort projects by most notes
    const sortedProjects = [...projects].sort((a, b) => {
        const aCount = notes.filter((n) => n.projectID === a.recordID).length;
        const bCount = notes.filter((n) => n.projectID === b.recordID).length;
        return bCount - aCount;
    });

    const sections = [
        ...(filteredNotes.length > 0 ? [{ title: '', data: filteredNotes }] : []),
        ...(filteredArchivedNotes.length > 0
            ? [{ title: `Archived (${filteredArchivedNotes.length})`, data: filteredArchivedNotes }]
            : []),
    ];

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
        <View style={styles.container}>
            {/* Search bar */}
            <View style={styles.searchContainer}>
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search notes..."
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
                        const count = notes.filter((n) => n.projectID === project.recordID).length;
                        return (
                            <Chip
                                key={project.recordID}
                                selected={!!selectedProjectIDs.has(project.recordID)}
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

            <SectionList
                sections={sections}
                keyExtractor={(item) => item.recordID}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <Text variant="bodyLarge">
                            {searchQuery.trim() ? 'No notes match your search.' : 'No notes yet.'}
                        </Text>
                    </View>
                }
                renderSectionHeader={({ section }) =>
                    section.title ? (
                        <View style={styles.archivedHeader}>
                            <Text variant="bodyMedium">{section.title}</Text>
                        </View>
                    ) : null
                }
                renderItem={({ item }) => (
                    <List.Item
                        title={item.title || '(untitled)'}
                        description={item.noteType === 'list' ? 'Checklist' : item.body?.slice(0, 60)}
                        left={(props) => (
                            <List.Icon
                                {...props}
                                icon={item.noteType === 'list' ? 'format-list-checks' : 'note-text-outline'}
                            />
                        )}
                        onPress={() => navigation.navigate('NoteDetail', { id: item.recordID })}
                    />
                )}
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
    archivedHeader: { padding: 16, alignItems: 'center' },
    fab: { position: 'absolute', right: 16, bottom: 16 },
});
