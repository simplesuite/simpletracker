import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Chip, Divider, List, RadioButton, Text, useTheme } from 'react-native-paper';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { clearLocalData } from '@simpletracker/core';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';

export function SettingsScreen() {
    const theme = useTheme();
    const tabBarHeight = useBottomTabBarHeight();
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

    const themeLabel = themeMode === 'system' ? 'System default' : themeMode === 'light' ? 'Light' : 'Dark';

    return (
        <ScrollView
            style={[styles.scroll, { backgroundColor: theme.colors.background }]}
            contentContainerStyle={[styles.container, { paddingBottom: tabBarHeight + 24 }]}
        >
            <View style={styles.header}>
                <Text variant="labelLarge" style={[styles.eyebrow, { color: theme.colors.primary }]}>PREFERENCES</Text>
                <Text variant="headlineMedium">Settings</Text>
                <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                    Manage your account and app appearance.
                </Text>
            </View>

            <Card style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
                <Card.Content>
                    <View style={styles.sectionHeading}>
                        <View>
                            <Text variant="titleLarge">Account</Text>
                            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                Your current signed-in account
                            </Text>
                        </View>
                        <View style={[styles.iconBadge, { backgroundColor: theme.colors.primaryContainer }]}>
                            <List.Icon icon="account-outline" color={theme.colors.primary} />
                        </View>
                    </View>
                    <List.Item
                        title={email || 'Signed in'}
                        description={userId ? `User ID: ${userId}` : undefined}
                        titleStyle={styles.accountTitle}
                        descriptionNumberOfLines={1}
                        contentStyle={styles.accountContent}
                        left={(props) => <List.Icon {...props} icon="email-outline" color={theme.colors.onSurfaceVariant} />}
                    />
                </Card.Content>
            </Card>

            <Card style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
                <Card.Content>
                    <View style={styles.sectionHeading}>
                        <View>
                            <Text variant="titleLarge">Appearance</Text>
                            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                Choose how SimpleTracker looks
                            </Text>
                        </View>
                        <Chip compact icon="palette-outline">{themeLabel}</Chip>
                    </View>
                    <RadioButton.Group
                        value={themeMode}
                        onValueChange={(value) => setThemeMode(value as 'system' | 'light' | 'dark')}
                    >
                        <View style={[styles.optionRow, { borderColor: theme.colors.outlineVariant }]}>
                            <View style={styles.optionCopy}>
                                <Text variant="bodyLarge">Use system setting</Text>
                                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>Follow your device theme</Text>
                            </View>
                            <RadioButton value="system" />
                        </View>
                        <View style={[styles.optionRow, { borderColor: theme.colors.outlineVariant }]}>
                            <View style={styles.optionCopy}>
                                <Text variant="bodyLarge">Light</Text>
                                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>A bright interface</Text>
                            </View>
                            <RadioButton value="light" />
                        </View>
                        <View style={[styles.optionRow, { borderColor: theme.colors.outlineVariant }]}>
                            <View style={styles.optionCopy}>
                                <Text variant="bodyLarge">Dark</Text>
                                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>A darker interface</Text>
                            </View>
                            <RadioButton value="dark" />
                        </View>
                    </RadioButton.Group>
                </Card.Content>
            </Card>

            <View style={[styles.signOutCard, { backgroundColor: theme.colors.errorContainer, borderColor: theme.colors.error }]}>
                <View style={styles.signOutCopy}>
                    <Text variant="titleMedium">Sign out</Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.onErrorContainer }}>
                        Local synced data will be cleared from this device.
                    </Text>
                </View>
                <Button mode="outlined" icon="logout" onPress={signOut} textColor={theme.colors.error}>
                    Sign out
                </Button>
            </View>

            <Divider style={styles.footerDivider} />
            <Text variant="bodySmall" style={[styles.footerNote, { color: theme.colors.onSurfaceVariant }]}>
                Theme preferences are saved on this device.
            </Text>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    scroll: { flex: 1 },
    container: { padding: 16, paddingTop: 20, gap: 12 },
    header: { gap: 4, marginBottom: 8 },
    eyebrow: { letterSpacing: 1.2, fontWeight: '700' },
    card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 20, overflow: 'hidden' },
    sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8 },
    iconBadge: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    accountTitle: { fontWeight: '600' },
    accountContent: { paddingLeft: 0 },
    optionRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 6 },
    optionCopy: { flex: 1, gap: 2 },
    signOutCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderWidth: StyleSheet.hairlineWidth, borderRadius: 20, padding: 16, marginTop: 4 },
    signOutCopy: { flex: 1, gap: 4 },
    footerDivider: { marginTop: 8 },
    footerNote: { textAlign: 'center', marginBottom: 8 },
});
