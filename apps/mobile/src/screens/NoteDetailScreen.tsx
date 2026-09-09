import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { TextInput } from 'react-native-paper';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import { useNoteStore } from '@simpletracker/core';
import type { NotesStackParamList } from '../navigation/types';

export function NoteDetailScreen() {
    const route = useRoute<RouteProp<NotesStackParamList, 'NoteDetail'>>();
    const { id } = route.params;

    const note = useNoteStore((s) => s.notes.find((n) => n.recordID === id));
    const updateNote = useNoteStore((s) => s.updateNote);

    const [title, setTitle] = useState(note?.title ?? '');
    const [body, setBody] = useState(note?.body ?? '');

    useEffect(() => {
        if (note) {
            setTitle(note.title);
            setBody(note.body);
        }
    }, [note?.recordID]);

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <TextInput
                mode="flat"
                placeholder="Title"
                value={title}
                onChangeText={setTitle}
                onBlur={() => updateNote(id, { title })}
                style={styles.title}
            />
            <TextInput
                mode="flat"
                placeholder="Write something…"
                value={body}
                onChangeText={setBody}
                onBlur={() => updateNote(id, { body })}
                multiline
                style={styles.body}
            />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { padding: 16 },
    title: { fontSize: 20, marginBottom: 8, backgroundColor: 'transparent' },
    body: { minHeight: 240, backgroundColor: 'transparent' },
});
