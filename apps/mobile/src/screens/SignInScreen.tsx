import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { Button, Card, HelperText, Text, TextInput, useTheme } from 'react-native-paper';
import { supabase } from '../lib/supabase';

export function SignInScreen({ navigation }: { navigation: any }) {
    const theme = useTheme();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const signIn = async () => {
        setLoading(true);
        setError(null);
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) setError(error.message);
        setLoading(false);
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={[styles.screen, { backgroundColor: theme.colors.background }]}
        >
            <View style={styles.content}>
                <View style={styles.branding}>
                    <Text variant="headlineMedium" style={styles.brand}>simpleTracker</Text>
                    <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                        A calmer way to keep track of what matters.
                    </Text>
                </View>

                <Card style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
                    <Card.Content>
                        <Text variant="titleLarge" style={styles.cardTitle}>Welcome back</Text>
                        <Text variant="bodyMedium" style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
                            Sign in to continue to your workspace.
                        </Text>

                        {error ? <HelperText type="error" visible>{error}</HelperText> : null}

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
                        <TextInput
                            mode="outlined"
                            label="Password"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                            autoComplete="password"
                            style={styles.input}
                        />
                        <Button mode="contained" onPress={signIn} loading={loading} disabled={loading} style={styles.button} contentStyle={styles.buttonContent}>
                            Sign in
                        </Button>

                        <Button mode="text" compact onPress={() => navigation.navigate('ForgotPassword')} style={styles.forgotButton}>
                            Forgot password?
                        </Button>
                        <Text variant="bodyMedium" style={styles.linkRow}>
                            New to simpleTracker?{' '}
                            <Text style={[styles.link, { color: theme.colors.primary }]} onPress={() => navigation.navigate('SignUp')}>
                                Create an account
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
    content: { flex: 1, justifyContent: 'center', padding: 16 },
    branding: { alignItems: 'center', marginBottom: 20, gap: 4 },
    brand: { fontWeight: '700' },
    card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 22 },
    cardTitle: { marginBottom: 4 },
    subtitle: { marginBottom: 18 },
    input: { marginBottom: 12 },
    button: { marginTop: 4, borderRadius: 12 },
    buttonContent: { paddingVertical: 4 },
    forgotButton: { alignSelf: 'center', marginTop: 6 },
    linkRow: { textAlign: 'center', marginTop: 12 },
    link: { fontWeight: '700' },
});
