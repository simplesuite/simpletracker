import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import { Button, Card, Text, TextField, getUiTheme } from '@simpletracker/ui';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useThemeStore } from '../store/themeStore';

export function ResetPasswordScreen({ navigation }: { navigation: any }) {
    const { effectiveTheme } = useThemeStore();
    const theme = getUiTheme(effectiveTheme);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const validatePassword = (value: string) => value.length >= 8;

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
            const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
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
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1" style={{ backgroundColor: theme.background }}>
                <View className="flex-1 justify-center px-4">
                    <Card className="rounded-3xl p-5">
                        <View className="mb-4 h-13 w-13 self-center items-center justify-center rounded-2xl bg-primary-container dark:bg-primary-container-dark">
                            <Text variant="titleLarge" style={{ color: theme.primary }}>✓</Text>
                        </View>
                        <Text variant="headline" className="mb-2 text-center">Password updated</Text>
                        <Text variant="body" className="mb-5 text-center">Your password has been reset successfully. You can now sign in with your new password.</Text>
                        <Button onPress={() => navigation.navigate('SignIn')}>Go to sign in</Button>
                    </Card>
                </View>
            </KeyboardAvoidingView>
        );
    }

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1" style={{ backgroundColor: theme.background }}>
            <View className="flex-1 justify-center px-4">
                <Card className="rounded-3xl p-5">
                    <Text variant="headline" className="mb-2 text-center">Choose a new password</Text>
                    <Text variant="body" className="mb-5 text-center" style={{ color: theme.onSurfaceVariant }}>
                        Use at least 8 characters for your new password.
                    </Text>
                    {error ? <Text variant="bodySmall" className="mb-3" style={{ color: theme.error }}>{error}</Text> : null}
                    <TextField
                        label="New password"
                        value={newPassword}
                        onChangeText={setNewPassword}
                        secureTextEntry={!showPassword}
                        autoComplete="password-new"
                        trailing={(
                            <Pressable accessibilityRole="button" accessibilityLabel={showPassword ? 'Hide password' : 'Show password'} onPress={() => setShowPassword((value) => !value)}>
                                <MaterialCommunityIcons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={21} color={theme.onSurfaceVariant} />
                            </Pressable>
                        )}
                        className="mb-3"
                    />
                    <TextField label="Confirm new password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry={!showPassword} autoComplete="password-new" className="mb-3" />
                    <Button onPress={handleResetPassword} loading={loading} disabled={loading || newPassword.length < 8} className="mt-1">Reset password</Button>
                </Card>
            </View>
        </KeyboardAvoidingView>
    );
}
