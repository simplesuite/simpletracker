import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { getUiTheme } from '@simpletracker/ui';
import { useThemeStore } from '../store/themeStore';
import { SignInScreen } from '../screens/SignInScreen';
import { SignUpScreen } from '../screens/SignUpScreen';
import { ForgotPasswordScreen } from '../screens/ForgotPasswordScreen';
import { ResetPasswordScreen } from '../screens/ResetPasswordScreen';
import type { AuthStackParamList } from './types';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthStack() {
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
                name="SignIn"
                component={SignInScreen}
                options={{ title: 'Sign In' }}
            />
            <Stack.Screen
                name="SignUp"
                component={SignUpScreen}
                options={{ title: 'Sign Up' }}
            />
            <Stack.Screen
                name="ForgotPassword"
                component={ForgotPasswordScreen}
                options={{ title: 'Reset Password' }}
            />
            <Stack.Screen
                name="ResetPassword"
                component={ResetPasswordScreen}
                options={{ title: 'New Password' }}
            />
        </Stack.Navigator>
    );
}
