import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { getUiTheme } from '@simpletracker/ui';
import { useThemeStore } from '../store/themeStore';
import { ProjectsListScreen } from '../screens/ProjectsListScreen';
import { ProjectDetailScreen } from '../screens/ProjectDetailScreen';
import type { ProjectsStackParamList } from './types';

const Stack = createNativeStackNavigator<ProjectsStackParamList>();

export function ProjectsStack() {
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
