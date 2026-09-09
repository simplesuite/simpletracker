import { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { TextInput, Button, Text, HelperText, Card } from 'react-native-paper';
import { supabase } from '../lib/supabase';

export function ForgotPasswordScreen({ navigation }: { navigation: any }) {
    const [email, setEmail] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const validateEmail = (email: string) => {
        return String(email)
            .toLowerCase()
            .match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    };

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
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.container}
            >
                <Card style={styles.card}>
                    <Card.Content>
                        <Text variant="headlineMedium" style={styles.title}>
                            Check your email
                        </Text>
                        <Text variant="bodyMedium" style={styles.message}>
                            If an account exists for {email}, you'll receive a password reset link shortly.
                        </Text>
                        <Button
                            mode="contained"
                            onPress={() => navigation.navigate('Root' as any)}
                            style={styles.button}
                        >
                            Back to Sign In
                        </Button>
                    </Card.Content>
                </Card>
            </KeyboardAvoidingView>
        );
    }

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <Card style={styles.card}>
                <Card.Content>
                    <Text variant="headlineMedium" style={styles.title}>
                        Forgot Password
                    </Text>
                    <Text variant="bodyMedium" style={styles.subtitle}>
                        Enter your email and we'll send you a link to reset your password.
                    </Text>

                    {error && (
                        <HelperText type="error" visible={!!error}>
                            {error}
                        </HelperText>
                    )}

                    <TextInput
                        label="Email"
                        value={email}
                        onChangeText={setEmail}
                        autoCapitalize="none"
                        keyboardType="email-address"
                        style={styles.input}
                    />

                    <Button
                        mode="contained"
                        onPress={handleResetPassword}
                        loading={loading}
                        disabled={loading}
                        style={styles.button}
                    >
                        Send Reset Link
                    </Button>

                    <Text variant="bodyMedium" style={styles.linkRow}>
                        Remember your password?{' '}
                        <Text
                            style={styles.link}
                            onPress={() => navigation.navigate('Root' as any)}
                        >
                            Sign In
                        </Text>
                    </Text>
                </Card.Content>
            </Card>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 16, justifyContent: 'center' },
    card: { marginBottom: 16 },
    title: { textAlign: 'center', marginBottom: 16 },
    subtitle: { textAlign: 'center', color: '#666', marginBottom: 24 },
    message: { textAlign: 'center', marginBottom: 16 },
    input: { marginBottom: 12 },
    button: { marginTop: 16 },
    linkRow: { textAlign: 'center', marginTop: 16 },
    link: { color: '#0366d6', fontWeight: '600' },
});
