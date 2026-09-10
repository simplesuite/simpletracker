import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { getUiTheme } from '@simpletracker/ui';
import { useThemeStore } from '../store/themeStore';
import { NotesListScreen } from '../screens/NotesListScreen';
import { NoteDetailScreen } from '../screens/NoteDetailScreen';
import type { NotesStackParamList } from './types';

const Stack = createNativeStackNavigator<NotesStackParamList>();

export function NotesStack() {
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
                name="NotesList"
                component={NotesListScreen}
                options={{ title: 'Notes' }}
            />
            <Stack.Screen
                name="NoteDetail"
                component={NoteDetailScreen}
                options={{ title: 'Note' }}
            />
        </Stack.Navigator>
    );
}
