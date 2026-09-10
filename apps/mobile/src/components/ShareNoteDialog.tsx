import { useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, Dialog, Text, TextField } from '@simpletracker/ui';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
    getRecentlySharedWithUsers,
    lookupUserByID,
    searchUsers,
    useNoteStore,
} from '@simpletracker/core';
import type { NoteShared } from '@simpletracker/core';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';

type ShareUser = { recordID: string; fullName: string; email: string };
type NoteShare = NoteShared & ShareUser;

interface ShareNoteDialogProps {
    visible: boolean;
    noteId: string;
    onClose: () => void;
}

export function ShareNoteDialog({ visible, noteId, onClose }: ShareNoteDialogProps) {
    const { effectiveTheme } = useThemeStore();
    const userId = useAuthStore((s) => s.userId);
    const shareNote = useNoteStore((s) => s.shareNote);
    const unshareNote = useNoteStore((s) => s.unshareNote);
    const getSharesForNote = useNoteStore((s) => s.getSharesForNote);
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<ShareUser[]>([]);
    const [recentUsers, setRecentUsers] = useState<ShareUser[]>([]);
    const [selectedUser, setSelectedUser] = useState<ShareUser | null>(null);
    const [shares, setShares] = useState<NoteShare[]>([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [searchLoading, setSearchLoading] = useState(false);
    const [sharesLoading, setSharesLoading] = useState(false);
    const searchRequestRef = useRef(0);

    const loadShares = async () => {
        if (!noteId) return;
        setSharesLoading(true);
        try {
            const records = await getSharesForNote(noteId);
            const enriched = await Promise.all(records.map(async (share) => {
                const user = await lookupUserByID(share.sharedToID);
                return {
                    ...share,
                    recordID: share.recordID,
                    fullName: user?.fullName || share.sharedToID,
                    email: user?.email || '',
                };
            }));
            setShares(enriched);
        } catch {
            setError('Unable to load note shares right now.');
        } finally {
            setSharesLoading(false);
        }
    };

    useEffect(() => {
        if (!visible || !userId) return;
        setError('');
        searchRequestRef.current += 1;
        setSelectedUser(null);
        setQuery('');
        setResults([]);
        loadShares();
        getRecentlySharedWithUsers(userId).then(setRecentUsers).catch(() => setRecentUsers([]));
    }, [visible, noteId, userId]);

    const handleQueryChange = async (value: string) => {
        const requestID = ++searchRequestRef.current;
        setQuery(value);
        setSelectedUser(null);
        setError('');
        if (value.trim().length < 2 || !userId) {
            setResults([]);
            return;
        }
        setSearchLoading(true);
        try {
            const found = await searchUsers(value, userId);
            if (requestID !== searchRequestRef.current) return;
            const sharedIDs = new Set(shares.map((share) => share.sharedToID));
            setResults(found.filter((user) => !sharedIDs.has(user.recordID)));
        } catch {
            if (requestID === searchRequestRef.current) setError('Unable to search users right now.');
        } finally {
            if (requestID === searchRequestRef.current) setSearchLoading(false);
        }
    };

    const handleShare = async () => {
        if (!noteId || !selectedUser) {
            setError('Select a user to share with.');
            return;
        }
        setLoading(true);
        setError('');
        try {
            const success = await shareNote(noteId, selectedUser.recordID);
            if (success) {
                setSelectedUser(null);
                setQuery('');
                setResults([]);
                await loadShares();
            } else {
                setError(useNoteStore.getState().error ?? 'Failed to share note.');
            }
        } catch {
            setError('Failed to share note. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleUnshare = async (sharedToID: string) => {
        setError('');
        try {
            const success = await unshareNote(noteId, sharedToID);
            if (success) setShares((current) => current.filter((share) => share.sharedToID !== sharedToID));
            else setError(useNoteStore.getState().error ?? 'Failed to remove share.');
        } catch {
            setError('Failed to remove share. Please try again.');
        }
    };

    const sharedIDs = new Set(shares.map((share) => share.sharedToID));
    const visibleRecentUsers = recentUsers.filter((user) => !sharedIDs.has(user.recordID));

    return (
        <Dialog
            visible={visible}
            onDismiss={onClose}
            title="Share Note"
            actions={(
                <>
                    <Button variant="text" compact onPress={onClose}>Done</Button>
                    <Button compact onPress={handleShare} loading={loading} disabled={!selectedUser}>Share</Button>
                </>
            )}
        >
            <ScrollView className="max-h-96" keyboardShouldPersistTaps="handled">
                <TextField
                    label="Find a user"
                    placeholder="Search by name or email"
                    value={query}
                    onChangeText={handleQueryChange}
                    autoCapitalize="none"
                    leading={<MaterialCommunityIcons name="magnify" size={19} color={effectiveTheme === 'dark' ? '#94a3b8' : '#64748b'} />}
                    error={!!error}
                />
                {searchLoading ? <Text variant="bodySmall" className="py-3">Searching…</Text> : null}
                {selectedUser ? (
                    <View className="mt-3 rounded-2xl bg-indigo-50 p-3 dark:bg-indigo-950">
                        <Text variant="bodySmall">Share this note with</Text>
                        <Text className="font-semibold">{selectedUser.fullName || selectedUser.email}</Text>
                        <Text variant="bodySmall">{selectedUser.email}</Text>
                        <Button variant="text" compact className="mt-1 self-start" onPress={() => setSelectedUser(null)}>Choose another</Button>
                    </View>
                ) : null}
                {!selectedUser && results.length > 0 ? (
                    <View className="mt-3 gap-2">
                        <Text variant="label">Search results</Text>
                        {results.map((user) => (
                            <Button key={user.recordID} variant="outlined" compact className="justify-start" onPress={() => setSelectedUser(user)}>
                                {user.fullName || user.email}
                            </Button>
                        ))}
                    </View>
                ) : null}
                {!selectedUser && !query.trim() && visibleRecentUsers.length > 0 ? (
                    <View className="mt-3 gap-2">
                        <Text variant="label">Recently shared with</Text>
                        {visibleRecentUsers.map((user) => (
                            <Button key={user.recordID} variant="outlined" compact className="justify-start" onPress={() => setSelectedUser(user)}>
                                {user.fullName || user.email}
                            </Button>
                        ))}
                    </View>
                ) : null}
                <View className="mt-4 border-t border-slate-200 pt-3 dark:border-slate-800">
                    <Text variant="label">Currently shared with</Text>
                    {sharesLoading ? <Text variant="bodySmall" className="py-3">Loading shares…</Text> : shares.length === 0 ? <Text variant="bodySmall" className="py-3">Not shared with anyone.</Text> : shares.map((share) => (
                        <View key={share.recordID} className="flex-row items-center border-b border-slate-200 py-2 dark:border-slate-800">
                            <View className="min-w-0 flex-1">
                                <Text numberOfLines={1} className="font-semibold">{share.fullName}</Text>
                                {share.email ? <Text variant="bodySmall" numberOfLines={1}>{share.email}</Text> : null}
                            </View>
                            <Button variant="danger" compact icon={<MaterialCommunityIcons name="account-remove-outline" size={17} color={effectiveTheme === 'dark' ? '#fca5a5' : '#dc2626'} />} accessibilityLabel={`Remove ${share.fullName}`} onPress={() => handleUnshare(share.sharedToID)}>Remove</Button>
                        </View>
                    ))}
                </View>
                {error ? <Text variant="bodySmall" className="mt-3" style={{ color: effectiveTheme === 'dark' ? '#fca5a5' : '#dc2626' }}>{error}</Text> : null}
            </ScrollView>
        </Dialog>
    );
}
