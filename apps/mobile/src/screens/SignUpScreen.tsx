import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { Button, Card, Text, TextField, getUiTheme } from '@simpletracker/ui';
import { supabase } from '../lib/supabase';
import { useThemeStore } from '../store/themeStore';

export function SignUpScreen({ navigation }: { navigation: any }) {
    const { effectiveTheme } = useThemeStore();
    const theme = getUiTheme(effectiveTheme);
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const validateEmail = (value: string) => String(value).toLowerCase().match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    const validatePassword = (value: string) => value.length >= 8;

    const handleSignUp = async () => {
        setError(null);
        if (!fullName.trim()) {
            setError('Please enter your full name');
            return;
        }
        if (!validateEmail(email)) {
            setError('Please enter a valid email address');
            return;
        }
        if (!validatePassword(password)) {
            setError('Password must be at least 8 characters');
            return;
        }
        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        setLoading(true);
        try {
            const { error: signUpError } = await supabase.auth.signUp({
                email,
                password,
                options: { data: { full_name: fullName } },
            });
            if (signUpError) {
                setError(signUpError.message);
                return;
            }
            setSuccess(true);
        } catch (err: any) {
            setError(err.message || 'Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1" style={{ backgroundColor: theme.background }}>
                <View className="flex-1 justify-center px-4">
                    <Card className="rounded-3xl p-5">
                        <View className="mb-4 h-13 w-13 self-center items-center justify-center rounded-2xl bg-primary-container dark:bg-primary-container-dark">
                            <Text variant="titleLarge" style={{ color: theme.primary }}>✓</Text>
                        </View>
                        <Text variant="headline" className="mb-2 text-center">Check your email</Text>
                        <Text variant="body" className="mb-4 text-center">You're signed up. Please verify your email before logging in.</Text>
                        <Text variant="bodySmall" className="mb-4 text-center" style={{ color: theme.onSurfaceVariant }}>
                            If you're using a self-hosted instance, there may be no email verification.
                        </Text>
                        <Button onPress={() => navigation.navigate('SignIn')}>Back to sign in</Button>
                    </Card>
                </View>
            </KeyboardAvoidingView>
        );
    }

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1" style={{ backgroundColor: theme.background }}>
            <ScrollView contentContainerClassName="grow justify-center p-4" keyboardShouldPersistTaps="handled">
                <Card className="rounded-3xl p-5">
                    <Text variant="headline" className="mb-2 text-center">Create your account</Text>
                    <Text variant="body" className="mb-5 text-center" style={{ color: theme.onSurfaceVariant }}>
                        Set up your workspace in a few steps.
                    </Text>
                    {error ? <Text variant="bodySmall" className="mb-3" style={{ color: theme.error }}>{error}</Text> : null}
                    <TextField label="Full name" value={fullName} onChangeText={setFullName} autoCapitalize="words" autoComplete="name" className="mb-3" />
                    <TextField label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" className="mb-3" />
                    <TextField label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password-new" className="mb-3" />
                    <TextField label="Confirm password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry autoComplete="password-new" className="mb-3" />
                    <Button onPress={handleSignUp} loading={loading} disabled={loading} className="mt-1">Create account</Button>
                    <Text variant="body" className="mt-3 text-center">
                        Already have an account?{' '}
                        <Text className="font-bold" style={{ color: theme.primary }} onPress={() => navigation.navigate('SignIn')}>Sign in</Text>
                    </Text>
                </Card>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}
