import { FlatList, View, StyleSheet } from 'react-native';
import { List, FAB, Text } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useProjectStore } from '@simpletracker/core';
import type { ProjectsStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<ProjectsStackParamList, 'ProjectsList'>;

export function ProjectsListScreen() {
    const navigation = useNavigation<Nav>();
    const projects = useProjectStore((s) => s.projects);
    const createBlankProject = useProjectStore((s) => s.createBlankProject);

    const onAdd = async () => {
        const project = await createBlankProject();
        navigation.navigate('ProjectDetail', { id: project.recordID });
    };

    return (
        <View style={styles.container}>
            {projects.length === 0 ? (
                <View style={styles.empty}>
                    <Text variant="bodyLarge">No projects yet.</Text>
                </View>
            ) : (
                <FlatList
                    data={projects}
                    keyExtractor={(p) => p.recordID}
                    renderItem={({ item }) => (
                        <List.Item
                            title={item.name || '(untitled)'}
                            description={item.description || undefined}
                            left={(props) => <List.Icon {...props} icon="folder-outline" />}
                            onPress={() => navigation.navigate('ProjectDetail', { id: item.recordID })}
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
