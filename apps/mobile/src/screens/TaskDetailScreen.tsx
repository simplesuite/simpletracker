import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { TextInput, Button } from 'react-native-paper';
import type { RouteProp } from '@react-navigation/native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useTaskStore } from '@simpletracker/core';
import type { TasksStackParamList } from '../navigation/types';

export function TaskDetailScreen() {
    const route = useRoute<RouteProp<TasksStackParamList, 'TaskDetail'>>();
    const navigation = useNavigation();
    const { id } = route.params;

    const task = useTaskStore((s) => s.tasks.find((t) => t.recordID === id));
    const updateTask = useTaskStore((s) => s.updateTask);
    const completeTask = useTaskStore((s) => s.completeTask);

    const [title, setTitle] = useState(task?.title ?? '');
    const [body, setBody] = useState(task?.body ?? '');

    useEffect(() => {
        if (task) {
            setTitle(task.title);
            setBody(task.body);
        }
    }, [task?.recordID]);

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <TextInput
                mode="flat"
                placeholder="Title"
                value={title}
                onChangeText={setTitle}
                onBlur={() => updateTask(id, { title })}
                style={styles.title}
            />
            <TextInput
                mode="flat"
                placeholder="Notes"
                value={body}
                onChangeText={setBody}
                onBlur={() => updateTask(id, { body })}
                multiline
                style={styles.body}
            />
            <View style={styles.actions}>
                <Button
                    mode="contained"
                    icon="check"
                    onPress={async () => {
                        await completeTask(id);
                        navigation.goBack();
                    }}
                >
                    Complete
                </Button>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { padding: 16 },
    title: { fontSize: 20, marginBottom: 8, backgroundColor: 'transparent' },
    body: { minHeight: 120, backgroundColor: 'transparent' },
    actions: { marginTop: 24 },
});
