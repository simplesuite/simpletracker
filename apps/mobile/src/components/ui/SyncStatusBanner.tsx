import { useEffect, useState } from 'react';
import { Pressable, Text as NativeText, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { refreshAllData, useOfflineStore } from '@simpletracker/core';
import { getUiTheme } from '@simpletracker/ui';
import { useThemeStore } from '../../store/themeStore';

// Writes normally confirm within a second or two. Only call out "waiting to
// sync" once changes have been queued for a while, so the banner doesn't flash
// on every edit.
const PENDING_GRACE_MS = 4000;

function changes(count: number): string {
    return `${count} ${count === 1 ? 'change' : 'changes'}`;
}

/**
 * Global sync status for mobile. Shows nothing while everything is in step;
 * otherwise surfaces (in priority order) writes the server rejected, a sync
 * error, being offline, or changes still waiting to upload.
 */
export function SyncStatusBanner() {
    const insets = useSafeAreaInsets();
    const effectiveTheme = useThemeStore((s) => s.effectiveTheme);
    const theme = getUiTheme(effectiveTheme);
    const isOnline = useOfflineStore((s) => s.isOnline);
    const pendingCount = useOfflineStore((s) => s.pendingCount);
    const isSyncing = useOfflineStore((s) => s.isSyncing);
    const lastSyncError = useOfflineStore((s) => s.lastSyncError);
    const hasRejected = useOfflineStore((s) => s.rejectedWrites.length > 0);
    const clearRejectedWrites = useOfflineStore((s) => s.clearRejectedWrites);
    const [retrying, setRetrying] = useState(false);
    const [pendingLong, setPendingLong] = useState(false);

    useEffect(() => {
        if (pendingCount <= 0) {
            setPendingLong(false);
            return;
        }
        const timer = setTimeout(() => setPendingLong(true), PENDING_GRACE_MS);
        return () => clearTimeout(timer);
    }, [pendingCount]);

    const retry = async () => {
        setRetrying(true);
        try {
            await refreshAllData();
        } catch {
            // The poller will surface the failure through lastSyncError.
        } finally {
            setRetrying(false);
        }
    };

    let tone: 'error' | 'warning';
    let message: string;
    let action: { label: string; a11y: string; onPress: () => void } | null = null;

    if (hasRejected && lastSyncError) {
        tone = 'error';
        message = lastSyncError;
        action = { label: 'Dismiss', a11y: 'Dismiss rejected changes', onPress: clearRejectedWrites };
    } else if (!isOnline) {
        tone = 'warning';
        message = pendingCount > 0
            ? `Offline · ${changes(pendingCount)} saved on this device, will sync when you're back online`
            : "Offline · changes will sync when you're back online";
    } else if (lastSyncError) {
        tone = 'error';
        message = `Sync problem: ${lastSyncError}${pendingCount > 0 ? ` (${changes(pendingCount)} unsaved)` : ''}`;
        action = { label: retrying ? 'Retrying…' : 'Retry', a11y: 'Retry sync', onPress: retry };
    } else if (pendingCount > 0 && pendingLong) {
        tone = 'warning';
        message = isSyncing ? `Syncing ${changes(pendingCount)}…` : `${changes(pendingCount)} waiting to sync`;
        action = { label: retrying ? 'Retrying…' : 'Retry', a11y: 'Retry sync', onPress: retry };
    } else {
        return null;
    }

    const background = tone === 'error' ? theme.errorContainer : theme.primaryContainer;
    const foreground = tone === 'error' ? theme.onErrorContainer : theme.onPrimaryContainer;

    return (
        <View
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            style={{
                backgroundColor: background,
                paddingTop: insets.top + 6,
                paddingBottom: 6,
                paddingHorizontal: 16,
                flexDirection: 'row',
                alignItems: 'center',
            }}
        >
            <NativeText style={{ color: foreground, fontSize: 13, flex: 1 }}>{message}</NativeText>
            {action ? (
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={action.a11y}
                    disabled={retrying}
                    onPress={action.onPress}
                    hitSlop={8}
                    style={{ marginLeft: 12, opacity: retrying ? 0.5 : 1 }}
                >
                    <NativeText style={{ color: foreground, fontSize: 13, fontWeight: '700' }}>{action.label}</NativeText>
                </Pressable>
            ) : null}
        </View>
    );
}
