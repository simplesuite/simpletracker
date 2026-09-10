import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { Button, Card, HelperText, Text, TextInput, useTheme } from 'react-native-paper';
import { supabase } from '../lib/supabase';

export function ForgotPasswordScreen({ navigation }: { navigation: any }) {
    const theme = useTheme();
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
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.screen, { backgroundColor: theme.colors.background }]}>
                <View style={styles.centerContent}>
                    <Card style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
                        <Card.Content>
                            <View style={[styles.statusBadge, { backgroundColor: theme.colors.primaryContainer }]}>
                                <Text variant="titleLarge" style={{ color: theme.colors.primary }}>✓</Text>
                            </View>
                            <Text variant="headlineSmall" style={styles.title}>Check your email</Text>
                            <Text variant="bodyMedium" style={styles.centerText}>
                                If an account exists for {email}, you'll receive a password reset link shortly.
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
            <View style={styles.centerContent}>
                <Card style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
                    <Card.Content>
                        <Text variant="headlineSmall" style={styles.title}>Reset your password</Text>
                        <Text variant="bodyMedium" style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
                            Enter your email and we'll send you a secure reset link.
                        </Text>

                        {error && <HelperText type="error" visible>{error}</HelperText>}

                        <TextInput
                            mode="outlined"
                            label="Email"
                            value={email}
                            onChangeText={setEmail}
                            autoCapitalize="none"
                            keyboardType="email-address"
                            autoComplete="email"
                            style={styles.input}
                        />
                        <Button mode="contained" onPress={handleResetPassword} loading={loading} disabled={loading} style={styles.button} contentStyle={styles.buttonContent}>
                            Send reset link
                        </Button>
                        <Text variant="bodyMedium" style={styles.linkRow}>
                            Remember your password?{' '}
                            <Text style={[styles.link, { color: theme.colors.primary }]} onPress={() => navigation.navigate('SignIn')}>
                                Sign in
                            </Text>
                        </Text>
                    </Card.Content>
                </Card>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1 },
    centerContent: { flex: 1, justifyContent: 'center', padding: 16 },
    card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 22 },
    title: { textAlign: 'center', marginBottom: 8 },
    subtitle: { textAlign: 'center', marginBottom: 20 },
    centerText: { textAlign: 'center', marginBottom: 18 },
    statusBadge: { alignSelf: 'center', width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    input: { marginBottom: 12 },
    button: { marginTop: 4, borderRadius: 12 },
    buttonContent: { paddingVertical: 4 },
    linkRow: { textAlign: 'center', marginTop: 14 },
    link: { fontWeight: '700' },
});
