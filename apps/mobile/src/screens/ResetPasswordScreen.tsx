import { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { TextInput, Button, Text, HelperText, Card, IconButton } from 'react-native-paper';
import { supabase } from '../lib/supabase';

export function ResetPasswordScreen({ navigation }: { navigation: any }) {
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
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.container}
            >
                <Card style={styles.card}>
                    <Card.Content>
                        <Text variant="headlineMedium" style={styles.title}>
                            Password updated
                        </Text>
                        <Text variant="bodyMedium" style={styles.successText}>
                            Your password has been reset successfully. You can now sign in with your new password.
                        </Text>
                        <Button
                            mode="contained"
                            onPress={() => navigation.navigate('Root' as any)}
                            style={styles.button}
                        >
                            Go to Sign In
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
                        Reset Password
                    </Text>
                    <Text variant="bodyMedium" style={styles.subtitle}>
                        Enter your new password below.
                    </Text>

                    {error && (
                        <HelperText type="error" visible={!!error}>
                            {error}
                        </HelperText>
                    )}

                    <TextInput
                        label="New Password"
                        value={newPassword}
                        onChangeText={setNewPassword}
                        secureTextEntry={!showPassword}
                        right={
                            <TextInput.Icon
                                icon={showPassword ? 'eye-off' : 'eye'}
                                onPress={() => setShowPassword(!showPassword)}
                            />
                        }
                        style={styles.input}
                    />

                    <TextInput
                        label="Confirm New Password"
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        secureTextEntry={!showPassword}
                        style={styles.input}
                    />

                    <Button
                        mode="contained"
                        onPress={handleResetPassword}
                        loading={loading}
                        disabled={loading || newPassword.length < 8}
                        style={styles.button}
                    >
                        Reset Password
                    </Button>
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
    input: { marginBottom: 12 },
    button: { marginTop: 16 },
});
