import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { TextInput, Button } from 'react-native-paper';
import type { RouteProp } from '@react-navigation/native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useProjectStore } from '@simpletracker/core';
import type { ProjectsStackParamList } from '../navigation/types';
import { ShareProjectDialog } from '../components/ShareProjectDialog';

export function ProjectDetailScreen() {
    const route = useRoute<RouteProp<ProjectsStackParamList, 'ProjectDetail'>>();
    const { id } = route.params;

    const project = useProjectStore((s) => s.projects.find((p) => p.recordID === id));
    const updateProject = useProjectStore((s) => s.updateProject);

    const [name, setName] = useState(project?.name ?? '');
    const [description, setDescription] = useState(project?.description ?? '');
    const [shareDialogOpen, setShareDialogOpen] = useState(false);

    useEffect(() => {
        if (project) {
            setName(project.name);
            setDescription(project.description);
        }
    }, [project?.recordID]);

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <TextInput
                mode="flat"
                placeholder="Project name"
                value={name}
                onChangeText={setName}
                onBlur={() => updateProject(id, { name })}
                style={styles.title}
            />
            <TextInput
                mode="flat"
                placeholder="Description"
                value={description}
                onChangeText={setDescription}
                onBlur={() => updateProject(id, { description })}
                multiline
                style={styles.body}
            />
        </ScrollView>

    );
}

const styles = StyleSheet.create({
    container: { padding: 16 },
    title: { fontSize: 20, marginBottom: 8, backgroundColor: 'transparent' },
    body: { minHeight: 120, backgroundColor: 'transparent' },
});
