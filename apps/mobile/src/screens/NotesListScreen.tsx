import { FlatList, View, StyleSheet } from 'react-native';
import { List, FAB, Text } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNoteStore } from '@simpletracker/core';
import type { NotesStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<NotesStackParamList, 'NotesList'>;

export function NotesListScreen() {
    const navigation = useNavigation<Nav>();
    // The shared core store drives both web and mobile — same selector API.
    const notes = useNoteStore((s) => s.notes);
    const createNote = useNoteStore((s) => s.createNote);

    const onAdd = async () => {
        const note = await createNote();
        if (note) navigation.navigate('NoteDetail', { id: note.recordID });
    };

    return (
        <View style={styles.container}>
            {notes.length === 0 ? (
                <View style={styles.empty}>
                    <Text variant="bodyLarge">No notes yet.</Text>
                </View>
            ) : (
                <FlatList
                    data={notes}
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
            <FAB icon="plus" style={styles.fab} onPress={onAdd} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    fab: { position: 'absolute', right: 16, bottom: 16 },
});
