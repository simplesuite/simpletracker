import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TasksListScreen } from '../screens/TasksListScreen';
import { TaskDetailScreen } from '../screens/TaskDetailScreen';
import type { TasksStackParamList } from './types';

const Stack = createNativeStackNavigator<TasksStackParamList>();

export function TasksStack() {
    return (
        <Stack.Navigator>
            <Stack.Screen
                name="TasksList"
                component={TasksListScreen}
                options={{ title: 'Tasks' }}
            />
            <Stack.Screen
                name="TaskDetail"
                component={TaskDetailScreen}
                options={{ title: 'Task' }}
            />
        </Stack.Navigator>
    );
}
