import { FlatList, View, StyleSheet } from 'react-native';
import { List, FAB, Text, Checkbox } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTaskStore } from '@simpletracker/core';
import type { TasksStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<TasksStackParamList, 'TasksList'>;

export function TasksListScreen() {
    const navigation = useNavigation<Nav>();
    const tasks = useTaskStore((s) => s.tasks);
    const createBlankTask = useTaskStore((s) => s.createBlankTask);
    const completeTask = useTaskStore((s) => s.completeTask);
    const reopenTask = useTaskStore((s) => s.reopenTask);

    const openTasks = tasks.filter((t) => t.status === 'open');

    const onAdd = async () => {
        const task = await createBlankTask();
        navigation.navigate('TaskDetail', { id: task.recordID });
    };

    return (
        <View style={styles.container}>
            {openTasks.length === 0 ? (
                <View style={styles.empty}>
                    <Text variant="bodyLarge">No open tasks.</Text>
                </View>
            ) : (
                <FlatList
                    data={openTasks}
                    keyExtractor={(t) => t.recordID}
                    renderItem={({ item }) => (
                        <List.Item
                            title={item.title || '(untitled)'}
                            left={() => (
                                <Checkbox
                                    status={item.status === 'completed' ? 'checked' : 'unchecked'}
                                    onPress={() =>
                                        item.status === 'completed'
                                            ? reopenTask(item.recordID)
                                            : completeTask(item.recordID)
                                    }
                                />
                            )}
                            onPress={() => navigation.navigate('TaskDetail', { id: item.recordID })}
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
