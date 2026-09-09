import { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { TextInput, Button, Text, HelperText, Card } from 'react-native-paper';
import { supabase } from '../lib/supabase';

export function SignUpScreen({ navigation }: { navigation: any }) {
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const validateEmail = (email: string) => {
        return String(email)
            .toLowerCase()
            .match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    };

    const validatePassword = (password: string) => {
        return password.length >= 8;
    };

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
                options: {
                    data: {
                        full_name: fullName,
                    },
                },
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
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.container}
            >
                <Card style={styles.card}>
                    <Card.Content>
                        <Text variant="headlineMedium" style={styles.title}>
                            Congrats!
                        </Text>
                        <Text variant="bodyMedium" style={styles.successText}>
                            You're signed up. Please verify your email before logging in.
                        </Text>
                        <Text variant="bodySmall" style={styles.infoText}>
                            If you're using a self-hosted instance, there may be no email verification.
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
                        simpleTracker
                    </Text>
                    <Text variant="bodyMedium" style={styles.subtitle}>
                        Sign up to continue
                    </Text>

                    {error && (
                        <HelperText type="error" visible={!!error}>
                            {error}
                        </HelperText>
                    )}

                    <TextInput
                        label="Full Name"
                        value={fullName}
                        onChangeText={setFullName}
                        autoCapitalize="words"
                        style={styles.input}
                    />

                    <TextInput
                        label="Email"
                        value={email}
                        onChangeText={setEmail}
                        autoCapitalize="none"
                        keyboardType="email-address"
                        style={styles.input}
                    />

                    <TextInput
                        label="Password"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                        style={styles.input}
                    />

                    <TextInput
                        label="Confirm Password"
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        secureTextEntry
                        style={styles.input}
                    />

                    <Button
                        mode="contained"
                        onPress={handleSignUp}
                        loading={loading}
                        disabled={loading}
                        style={styles.button}
                    >
                        Sign Up
                    </Button>

                    <Text variant="bodyMedium" style={styles.linkRow}>
                        Already have an account?{' '}
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
    successText: { textAlign: 'center', marginBottom: 16 },
    infoText: { textAlign: 'center', color: '#999', marginBottom: 24 },
    input: { marginBottom: 12 },
    button: { marginTop: 16 },
    linkRow: { textAlign: 'center', marginTop: 16 },
    link: { color: '#0366d6', fontWeight: '600' },
});
