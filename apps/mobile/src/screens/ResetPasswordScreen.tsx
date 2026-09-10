import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { Button, Card, HelperText, Text, TextInput, useTheme } from 'react-native-paper';
import { supabase } from '../lib/supabase';

export function ResetPasswordScreen({ navigation }: { navigation: any }) {
    const theme = useTheme();
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const validatePassword = (password: string) => {
        return password.length >= 8;
    };

    const handleResetPassword = async () => {
        setError(null);

        if (!validatePassword(newPassword)) {
            setError('Password must be at least 8 characters');
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        setLoading(true);

        try {
            const { error: updateError } = await supabase.auth.updateUser({
                password: newPassword,
            });

            if (updateError) {
                setError(updateError.message);
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
                            <Text variant="headlineSmall" style={styles.title}>Password updated</Text>
                            <Text variant="bodyMedium" style={styles.centerText}>
                                Your password has been reset successfully. You can now sign in with your new password.
                            </Text>
                            <Button mode="contained" onPress={() => navigation.navigate('SignIn')} style={styles.button}>
                                Go to sign in
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
                        <Text variant="headlineSmall" style={styles.title}>Choose a new password</Text>
                        <Text variant="bodyMedium" style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
                            Use at least 8 characters for your new password.
                        </Text>

                        {error && <HelperText type="error" visible>{error}</HelperText>}

                        <TextInput
                            mode="outlined"
                            label="New password"
                            value={newPassword}
                            onChangeText={setNewPassword}
                            secureTextEntry={!showPassword}
                            autoComplete="password-new"
                            right={<TextInput.Icon icon={showPassword ? 'eye-off-outline' : 'eye-outline'} onPress={() => setShowPassword(!showPassword)} />}
                            style={styles.input}
                        />
                        <TextInput
                            mode="outlined"
                            label="Confirm new password"
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            secureTextEntry={!showPassword}
                            autoComplete="password-new"
                            style={styles.input}
                        />
                        <Button mode="contained" onPress={handleResetPassword} loading={loading} disabled={loading || newPassword.length < 8} style={styles.button} contentStyle={styles.buttonContent}>
                            Reset password
                        </Button>
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
});
