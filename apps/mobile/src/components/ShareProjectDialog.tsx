import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Dialog, Portal, Button, TextInput } from 'react-native-paper';
import { useProjectStore } from '@simpletracker/core';

interface ShareProjectDialogProps {
    visible: boolean;
    projectId: string;
    onClose: () => void;
}

export function ShareProjectDialog({ visible, projectId, onClose }: ShareProjectDialogProps) {
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
        <Portal>
            <Dialog visible={visible} onDismiss={onClose}>
                <Dialog.Title>Share Project</Dialog.Title>
                <Dialog.Content>
                    <TextInput
                        mode="outlined"
                        placeholder="Enter email to share with"
                        value={email}
                        onChangeText={setEmail}
                        error={!!error}
                        style={styles.emailInput}
                    />
                    {error && <View style={styles.errorContainer}><Button mode="text" onPress={() => setError('')} icon="close">Clear</Button></View>}
                </Dialog.Content>
                <Dialog.Actions>
                    <Button onPress={onClose}>Cancel</Button>
                    <Button onPress={handleShare} loading={loading}>Share</Button>
                </Dialog.Actions>
            </Dialog>
        </Portal>
    );
}

const styles = StyleSheet.create({
    emailInput: { marginBottom: 16 },
    errorContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 8 },
});
