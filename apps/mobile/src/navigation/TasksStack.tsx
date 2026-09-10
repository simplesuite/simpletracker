import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { getUiTheme } from '@simpletracker/ui';
import { useThemeStore } from '../store/themeStore';
import { TasksListScreen } from '../screens/TasksListScreen';
import { TaskDetailScreen } from '../screens/TaskDetailScreen';
import type { TasksStackParamList } from './types';

const Stack = createNativeStackNavigator<TasksStackParamList>();

export function TasksStack() {
    const { effectiveTheme } = useThemeStore();
    const theme = getUiTheme(effectiveTheme);

    return (
        <Stack.Navigator
            screenOptions={{
                contentStyle: { backgroundColor: theme.background },
                headerStyle: { backgroundColor: theme.surface },
                headerTintColor: theme.onSurface,
                headerTitleStyle: { color: theme.onSurface, fontWeight: '700' },
                headerShadowVisible: false,
            }}
        >
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
