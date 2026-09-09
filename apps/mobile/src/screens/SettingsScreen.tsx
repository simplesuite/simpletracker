import { View, StyleSheet } from 'react-native';
import { Button, Text, Divider } from 'react-native-paper';
import { clearLocalData } from '@simpletracker/core';
import { supabase } from '../lib/supabase';

export function SettingsScreen() {
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
        <View style={styles.container}>
            <Text variant="titleLarge" style={styles.heading}>
                Settings
            </Text>
            <Divider style={styles.divider} />
            <Button mode="outlined" onPress={signOut} icon="logout">
                Sign out
            </Button>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 16, paddingTop: 64 },
    heading: { marginBottom: 8 },
    divider: { marginBottom: 16 },
});
