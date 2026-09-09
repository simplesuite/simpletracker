import { useState } from 'react';
import { FlatList, View, StyleSheet, TextInput } from 'react-native';
import { List, FAB, Text, Chip } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNoteStore, useProjectStore } from '@simpletracker/core';
import type { NotesStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<NotesStackParamList, 'NotesList'>;

export function NotesListScreen() {
    const navigation = useNavigation<Nav>();
    const notes = useNoteStore((s) => s.notes);
    const archivedNotes = useNoteStore((s) => s.archivedNotes);
    const sharedNotes = useNoteStore((s) => s.sharedNotes);
    const createNote = useNoteStore((s) => s.createNote);

    const projects = useProjectStore((s) => s.projects);

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedProjectIDs, setSelectedProjectIDs] = useState<Set<string>>(new Set());
    const [archivedExpanded, setArchivedExpanded] = useState(false);

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
                <View style={styles.projectChips}>
                    {sortedProjects.map((project) => {
                        const count = notes.filter((n) => n.projectID === project.recordID).length;
                        return (
                            <Chip
                                key={project.recordID}
                                selected={!!selectedProjectIDs.has(project.recordID)}
                                onPress={() => toggleProjectFilter(project.recordID)}
                                style={styles.projectChip}
                            >
                                {project.name} ({count})
                            </Chip>
                        );
                    })}
                </View>
            )}

            {filteredNotes.length === 0 && filteredArchivedNotes.length === 0 ? (
                <View style={styles.empty}>
                    <Text variant="bodyLarge">
                        {searchQuery.trim() ? 'No notes match your search.' : 'No notes yet.'}
                    </Text>
                </View>
            ) : (
                <>
                    {/* Active notes */}
                    {filteredNotes.length > 0 && (
                        <FlatList
                            data={filteredNotes}
                            keyExtractor={(n) => n.recordID}
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
                    )}

                    {/* Archived section */}
                    {filteredArchivedNotes.length > 0 && (
                        <View style={styles.archivedSection}>
                            <View
                                style={styles.archivedHeader}
                            >
                                <Text variant="bodyMedium">Archived ({filteredArchivedNotes.length})</Text>
                            </View>
                            <FlatList
                                data={filteredArchivedNotes}
                                keyExtractor={(n) => n.recordID}
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
                        </View>
                    )}
                </>
            )}
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
        gap: 8,
        paddingHorizontal: 16,
        paddingVertical: 8,
        overflow: 'scroll',
    },
    projectChip: { flexShrink: 1 },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    archivedSection: { marginTop: 16 },
    archivedHeader: { padding: 16, alignItems: 'center' },
    fab: { position: 'absolute', right: 16, bottom: 16 },
});
