import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from 'react-native-paper';
import { NotesListScreen } from '../screens/NotesListScreen';
import { NoteDetailScreen } from '../screens/NoteDetailScreen';
import type { NotesStackParamList } from './types';

const Stack = createNativeStackNavigator<NotesStackParamList>();

export function NotesStack() {
    const theme = useTheme();

    return (
        <Stack.Navigator screenOptions={{ contentStyle: { backgroundColor: theme.colors.background } }}>
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
