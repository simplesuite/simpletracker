import React from 'react';
import Snackbar from '@mui/material/Snackbar';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';

interface UpdatePromptProps {
    open: boolean;
    onUpdate: () => void;
    onDismiss: () => void;
}

export default function UpdatePrompt({ open, onUpdate, onDismiss }: UpdatePromptProps) {
    return (
        <Snackbar
            open={open}
            anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
            sx={{ top: 'max(24px, env(safe-area-inset-top, 24px))' }}
        >
            <Alert
                severity="info"
                variant="filled"
                action={
                    <>
                        <Button color="inherit" size="small" onClick={onDismiss}>Later</Button>
                        <Button color="inherit" size="small" onClick={onUpdate} sx={{ fontWeight: 'bold' }}>Update</Button>
                    </>
                }
            >
                A new version is available
            </Alert>
        </Snackbar>
    );
}
