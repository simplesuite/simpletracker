import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ProjectsListScreen } from '../screens/ProjectsListScreen';
import { ProjectDetailScreen } from '../screens/ProjectDetailScreen';
import type { ProjectsStackParamList } from './types';

const Stack = createNativeStackNavigator<ProjectsStackParamList>();

export function ProjectsStack() {
    return (
        <Stack.Navigator>
            <Stack.Screen
                name="ProjectsList"
                component={ProjectsListScreen}
                options={{ title: 'Projects' }}
            />
            <Stack.Screen
                name="ProjectDetail"
                component={ProjectDetailScreen}
                options={{ title: 'Project' }}
            />
        </Stack.Navigator>
    );
}
