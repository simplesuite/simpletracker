import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { Button, Card, Text, TextField, getUiTheme } from '@simpletracker/ui';
import { supabase } from '../lib/supabase';
import { useThemeStore } from '../store/themeStore';

export function ForgotPasswordScreen({ navigation }: { navigation: any }) {
    const { effectiveTheme } = useThemeStore();
    const theme = getUiTheme(effectiveTheme);
    const [email, setEmail] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const validateEmail = (value: string) => String(value).toLowerCase().match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);

    const handleResetPassword = async () => {
        setError(null);
        if (!validateEmail(email)) {
            setError('Please enter a valid email address');
            return;
        }
        setLoading(true);
        try {
            const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: 'simpletracker://reset-password',
            });
            if (resetError) {
                setError(resetError.message);
                return;
            }
            setSubmitted(true);
        } catch (err: any) {
            setError(err.message || 'Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    if (submitted) {
        return (
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1" style={{ backgroundColor: theme.background }}>
                <View className="flex-1 justify-center px-4">
                    <Card className="rounded-3xl p-5">
                        <View className="mb-4 h-13 w-13 self-center items-center justify-center rounded-2xl bg-primary-container dark:bg-primary-container-dark">
                            <Text variant="titleLarge" style={{ color: theme.primary }}>✓</Text>
                        </View>
                        <Text variant="headline" className="mb-2 text-center">Check your email</Text>
                        <Text variant="body" className="mb-5 text-center">If an account exists for {email}, you'll receive a password reset link shortly.</Text>
                        <Button onPress={() => navigation.navigate('SignIn')}>Back to sign in</Button>
                    </Card>
                </View>
            </KeyboardAvoidingView>
        );
    }

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1" style={{ backgroundColor: theme.background }}>
            <View className="flex-1 justify-center px-4">
                <Card className="rounded-3xl p-5">
                    <Text variant="headline" className="mb-2 text-center">Reset your password</Text>
                    <Text variant="body" className="mb-5 text-center" style={{ color: theme.onSurfaceVariant }}>
                        Enter your email and we'll send you a secure reset link.
                    </Text>
                    {error ? <Text variant="bodySmall" className="mb-3" style={{ color: theme.error }}>{error}</Text> : null}
                    <TextField label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" className="mb-3" />
                    <Button onPress={handleResetPassword} loading={loading} disabled={loading} className="mt-1">Send reset link</Button>
                    <Text variant="body" className="mt-3 text-center">
                        Remember your password?{' '}
                        <Text className="font-bold" style={{ color: theme.primary }} onPress={() => navigation.navigate('SignIn')}>Sign in</Text>
                    </Text>
                </Card>
            </View>
        </KeyboardAvoidingView>
    );
}
