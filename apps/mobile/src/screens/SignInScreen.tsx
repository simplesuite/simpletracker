import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { Button, Card, Text, TextField, getUiTheme } from '@simpletracker/ui';
import { supabase } from '../lib/supabase';
import { useThemeStore } from '../store/themeStore';

export function SignInScreen({ navigation }: { navigation: any }) {
    const { effectiveTheme } = useThemeStore();
    const theme = getUiTheme(effectiveTheme);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const signIn = async () => {
        setLoading(true);
        setError(null);
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) setError(signInError.message);
        setLoading(false);
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="flex-1"
            style={{ backgroundColor: theme.background }}
        >
            <View className="flex-1 justify-center px-4">
                <View className="mb-5 items-center gap-1">
                    <Text variant="headline">simpleTracker</Text>
                    <Text variant="body" style={{ color: theme.onSurfaceVariant }}>
                        A calmer way to keep track of what matters.
                    </Text>
                </View>

                <Card className="rounded-3xl p-5">
                    <Text variant="titleLarge" className="mb-1">Welcome back</Text>
                    <Text variant="body" className="mb-5" style={{ color: theme.onSurfaceVariant }}>
                        Sign in to continue to your workspace.
                    </Text>

                    {error ? <Text variant="bodySmall" className="mb-3" style={{ color: theme.error }}>{error}</Text> : null}

                    <TextField
                        label="Email"
                        value={email}
                        onChangeText={setEmail}
                        autoCapitalize="none"
                        keyboardType="email-address"
                        autoComplete="email"
                        className="mb-3"
                    />
                    <TextField
                        label="Password"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                        autoComplete="password"
                        className="mb-3"
                    />
                    <Button onPress={signIn} loading={loading} disabled={loading} className="mt-1">
                        Sign in
                    </Button>

                    <Button variant="text" compact onPress={() => navigation.navigate('ForgotPassword')} className="self-center mt-2">
                        Forgot password?
                    </Button>
                    <Text variant="body" className="mt-3 text-center">
                        New to simpleTracker?{' '}
                        <Text className="font-bold" style={{ color: theme.primary }} onPress={() => navigation.navigate('SignUp')}>
                            Create an account
                        </Text>
                    </Text>
                </Card>
            </View>
        </KeyboardAvoidingView>
    );
}
