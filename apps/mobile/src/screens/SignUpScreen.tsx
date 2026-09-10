import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, HelperText, Text, TextInput, useTheme } from 'react-native-paper';
import { supabase } from '../lib/supabase';

export function SignUpScreen({ navigation }: { navigation: any }) {
    const theme = useTheme();
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
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.screen, { backgroundColor: theme.colors.background }]}>
                <View style={styles.centerContent}>
                    <Card style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
                        <Card.Content>
                            <View style={[styles.statusBadge, { backgroundColor: theme.colors.primaryContainer }]}>
                                <Text variant="titleLarge" style={{ color: theme.colors.primary }}>✓</Text>
                            </View>
                            <Text variant="headlineSmall" style={styles.title}>Check your email</Text>
                            <Text variant="bodyMedium" style={styles.centerText}>
                                You're signed up. Please verify your email before logging in.
                            </Text>
                            <Text variant="bodySmall" style={[styles.centerText, { color: theme.colors.onSurfaceVariant }]}>
                                If you're using a self-hosted instance, there may be no email verification.
                            </Text>
                            <Button mode="contained" onPress={() => navigation.navigate('SignIn')} style={styles.button}>
                                Back to sign in
                            </Button>
                        </Card.Content>
                    </Card>
                </View>
            </KeyboardAvoidingView>
        );
    }

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.screen, { backgroundColor: theme.colors.background }]}>
            <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                <Card style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
                    <Card.Content>
                        <Text variant="headlineSmall" style={styles.title}>Create your account</Text>
                        <Text variant="bodyMedium" style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
                            Set up your workspace in a few steps.
                        </Text>

                        {error && <HelperText type="error" visible>{error}</HelperText>}

                        <TextInput mode="outlined" label="Full name" value={fullName} onChangeText={setFullName} autoCapitalize="words" autoComplete="name" style={styles.input} />
                        <TextInput mode="outlined" label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" style={styles.input} />
                        <TextInput mode="outlined" label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password-new" style={styles.input} />
                        <TextInput mode="outlined" label="Confirm password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry autoComplete="password-new" style={styles.input} />

                        <Button mode="contained" onPress={handleSignUp} loading={loading} disabled={loading} style={styles.button} contentStyle={styles.buttonContent}>
                            Create account
                        </Button>
                        <Text variant="bodyMedium" style={styles.linkRow}>
                            Already have an account?{' '}
                            <Text style={[styles.link, { color: theme.colors.primary }]} onPress={() => navigation.navigate('SignIn')}>
                                Sign in
                            </Text>
                        </Text>
                    </Card.Content>
                </Card>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1 },
    centerContent: { flex: 1, justifyContent: 'center', padding: 16 },
    scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 16 },
    card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 22 },
    title: { textAlign: 'center', marginBottom: 8 },
    subtitle: { textAlign: 'center', marginBottom: 20 },
    centerText: { textAlign: 'center', marginBottom: 16 },
    statusBadge: { alignSelf: 'center', width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    input: { marginBottom: 12 },
    button: { marginTop: 4, borderRadius: 12 },
    buttonContent: { paddingVertical: 4 },
    linkRow: { textAlign: 'center', marginTop: 14 },
    link: { fontWeight: '700' },
});
