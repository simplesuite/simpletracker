import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NotesListScreen } from '../screens/NotesListScreen';
import { NoteDetailScreen } from '../screens/NoteDetailScreen';
import type { NotesStackParamList } from './types';

const Stack = createNativeStackNavigator<NotesStackParamList>();

export function NotesStack() {
    return (
        <Stack.Navigator>
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
