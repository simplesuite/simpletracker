import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Divider, List, RadioButton, Text, useTheme } from 'react-native-paper';
import { clearLocalData } from '@simpletracker/core';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';

export function SettingsScreen() {
    const theme = useTheme();
    const userId = useAuthStore((s) => s.userId);
    const { themeMode, setThemeMode } = useThemeStore();
    const [email, setEmail] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (mounted) setEmail(session?.user?.email ?? null);
        });
        return () => {
            mounted = false;
        };
    }, []);

    const signOut = async () => {
        // Wipe local synced data so the next user on this device can't see it.
        try {
            await clearLocalData();
        } catch {
            /* best-effort */
        }
        await supabase.auth.signOut();
    };

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <Text variant="headlineSmall" style={styles.heading}>
                Settings
            </Text>

            <Card style={styles.card}>
                <Card.Content>
                    <Text variant="titleMedium" style={styles.cardTitle}>Account</Text>
                    <List.Item
                        title={email || 'Signed in'}
                        description={userId ? `User ID: ${userId}` : undefined}
                        left={(props) => <List.Icon {...props} icon="account-circle-outline" />}
                    />
                </Card.Content>
            </Card>

            <Card style={styles.card}>
                <Card.Content>
                    <Text variant="titleMedium" style={styles.cardTitle}>Appearance</Text>
                    <RadioButton.Group
                        value={themeMode}
                        onValueChange={(value) => setThemeMode(value as 'system' | 'light' | 'dark')}
                    >
                        <RadioButton.Item label="Use system setting" value="system" />
                        <RadioButton.Item label="Light" value="light" />
                        <RadioButton.Item label="Dark" value="dark" />
                    </RadioButton.Group>
                </Card.Content>
            </Card>

            <View style={styles.logoutSection}>
                <Divider style={styles.divider} />
                <Button mode="outlined" onPress={signOut} icon="logout" textColor={theme.colors.error}>
                    Sign out
                </Button>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { padding: 16, paddingTop: 24, paddingBottom: 40 },
    heading: { marginBottom: 16 },
    card: { marginBottom: 16 },
    cardTitle: { marginBottom: 8 },
    logoutSection: { marginTop: 8 },
    divider: { marginBottom: 16 },
});
