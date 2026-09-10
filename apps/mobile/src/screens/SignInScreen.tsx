import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, View } from 'react-native';
import { Button, Card, Dialog, Text, TextField, getUiTheme } from '@simpletracker/ui';
import { PRODUCTION_URL, supabase, SUPABASE_URL } from '../lib/supabase';
import { resetBackendConfig, saveBackendConfig } from '../lib/backendConfig';
import { useThemeStore } from '../store/themeStore';

export function SignInScreen({ navigation }: { navigation: any }) {
    const { effectiveTheme } = useThemeStore();
    const theme = getUiTheme(effectiveTheme);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [backendDialogOpen, setBackendDialogOpen] = useState(false);
    const [backendUrl, setBackendUrl] = useState('');
    const [backendKey, setBackendKey] = useState('');
    const [backendSaving, setBackendSaving] = useState(false);
    const [usingCustomBackend, setUsingCustomBackend] = useState(SUPABASE_URL !== PRODUCTION_URL);

    const signIn = async () => {
        setLoading(true);
        setError(null);
        setNotice(null);
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) setError(signInError.message);
        setLoading(false);
    };

    const openBackendSettings = () => {
        setBackendUrl(usingCustomBackend ? SUPABASE_URL : '');
        setBackendKey('');
        setError(null);
        setNotice(null);
        setBackendDialogOpen(true);
    };

    const saveBackend = async () => {
        const url = backendUrl.trim().replace(/\/$/, '');
        const key = backendKey.trim();
        if (!/^https:\/\//i.test(url) || key.length < 20) {
            setError('Enter a valid HTTPS self-hosted Supabase URL and anon key.');
            return;
        }
        setBackendSaving(true);
        setError(null);
        try {
            await saveBackendConfig({ url, anonKey: key });
            setUsingCustomBackend(true);
            setBackendDialogOpen(false);
            setBackendKey('');
            setNotice('Custom backend saved. Restart the app to apply it.');
        } catch {
            setError('Unable to save the backend configuration.');
        } finally {
            setBackendSaving(false);
        }
    };

    const resetBackend = () => {
        Alert.alert('Use production backend?', 'This removes the custom backend setting and applies production on the next app launch.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Use production', style: 'destructive', onPress: async () => {
                try {
                    await resetBackendConfig();
                    setUsingCustomBackend(false);
                    setBackendDialogOpen(false);
                    setNotice('Production backend restored. Restart the app to apply it.');
                } catch {
                    setError('Unable to restore the production backend.');
                }
            } },
        ]);
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
                    {notice ? <Text variant="bodySmall" className="mb-3" style={{ color: theme.primary }}>{notice}</Text> : null}

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

                <View className="mt-4 items-center gap-1">
                    <Text variant="bodySmall" style={{ color: theme.onSurfaceVariant }}>
                        {usingCustomBackend ? 'Custom backend configured' : 'Production backend (default)'}
                    </Text>
                    <Button variant="text" compact onPress={openBackendSettings}>
                        Backend settings
                    </Button>
                </View>
            </View>

            <Dialog
                visible={backendDialogOpen}
                onDismiss={() => setBackendDialogOpen(false)}
                title="Backend settings"
                actions={<>
                    <Button variant="text" compact onPress={resetBackend}>Use production</Button>
                    <Button variant="text" compact onPress={() => setBackendDialogOpen(false)}>Cancel</Button>
                    <Button compact loading={backendSaving} onPress={saveBackend}>Save</Button>
                </>}
            >
                <Text variant="bodySmall" className="mb-3" style={{ color: theme.onSurfaceVariant }}>
                    Production is used by default. Configure a self-hosted backend only if needed. Changes apply after restarting the app.
                </Text>
                <TextField
                    label="Self-hosted Supabase URL"
                    placeholder="https://your-server.example.com"
                    value={backendUrl}
                    onChangeText={setBackendUrl}
                    autoCapitalize="none"
                    keyboardType="url"
                    className="mb-3"
                />
                <TextField
                    label="Self-hosted anon key"
                    value={backendKey}
                    onChangeText={setBackendKey}
                    autoCapitalize="none"
                    secureTextEntry
                    helperText="Use the public anon key from your self-hosted Supabase deployment."
                />
            </Dialog>
        </KeyboardAvoidingView>
    );
}
