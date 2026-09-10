import { useState } from 'react';
import { View } from 'react-native';
import { Button, Dialog, Text, TextField } from '@simpletracker/ui';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useProjectStore } from '@simpletracker/core';
import { useThemeStore } from '../store/themeStore';

interface ShareProjectDialogProps {
    visible: boolean;
    projectId: string;
    onClose: () => void;
}

export function ShareProjectDialog({ visible, projectId, onClose }: ShareProjectDialogProps) {
    const { effectiveTheme } = useThemeStore();
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const shareProject = useProjectStore((s) => s.shareProject);

    const handleShare = async () => {
        if (!projectId || !email.trim()) {
            setError('Please enter an email address');
            return;
        }
        setLoading(true);
        setError('');
        try {
            const success = await shareProject(projectId, email.trim());
            if (success) {
                setEmail('');
                onClose();
            } else {
                setError('Failed to share project. Please check the email address.');
            }
        } catch {
            setError('Failed to share project. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog
            visible={visible}
            onDismiss={onClose}
            title="Share Project"
            actions={(
                <>
                    <Button variant="text" compact onPress={onClose}>Cancel</Button>
                    <Button compact onPress={handleShare} loading={loading}>Share</Button>
                </>
            )}
        >
            <TextField
                placeholder="Enter email to share with"
                value={email}
                onChangeText={setEmail}
                error={!!error}
                className="mb-3"
            />
            {error ? (
                <View className="flex-row items-center justify-end">
                    <Text variant="bodySmall" className="mr-2 flex-1" style={{ color: effectiveTheme === 'dark' ? '#fca5a5' : '#dc2626' }}>{error}</Text>
                    <Button variant="text" compact icon={<MaterialCommunityIcons name="close" size={16} color={effectiveTheme === 'dark' ? '#a5b4fc' : '#4f46e5'} />} onPress={() => setError('')}>Clear</Button>
                </View>
            ) : null}
        </Dialog>
    );
}
