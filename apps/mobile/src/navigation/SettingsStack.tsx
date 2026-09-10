import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { getUiTheme } from '@simpletracker/ui';
import { useThemeStore } from '../store/themeStore';
import { SettingsScreen } from '../screens/SettingsScreen';
import type { SettingsStackParamList } from './types';

const Stack = createNativeStackNavigator<SettingsStackParamList>();

export function SettingsStack() {
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
                name="Settings"
                component={SettingsScreen}
                options={{ title: 'Settings' }}
            />
        </Stack.Navigator>
    );
}
