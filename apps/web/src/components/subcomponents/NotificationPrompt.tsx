import React from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import Box from '@mui/material/Box';
import { useNotificationStore } from '../../store/notificationStore';
import { notificationsSupported, requestNotificationPermission } from '../../lib/notifications';
import { dialogPaperStyles } from '../../store/globalStore';

/**
 * One-time prompt asking the user if they'd like to enable task due-date notifications.
 * Only shows if:
 *  - Browser supports notifications
 *  - Permission hasn't been denied
 *  - We haven't already prompted
 */
export default function NotificationPrompt() {
    const prompted = useNotificationStore(s => s.prompted);
    const setPrompted = useNotificationStore(s => s.setPrompted);
    const setEnabled = useNotificationStore(s => s.setEnabled);

    const shouldShow = !prompted && notificationsSupported() && Notification.permission === 'default';

    const handleEnable = async () => {
        const granted = await requestNotificationPermission();
        setEnabled(granted);
        setPrompted(true);
    };

    const handleDismiss = () => {
        setPrompted(true);
    };

    if (!shouldShow) return null;

    return (
        <Dialog
            open={shouldShow}
            onClose={handleDismiss}
            slotProps={{ paper: dialogPaperStyles }}
        >
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <NotificationsActiveIcon color="primary" />
                Enable Notifications?
            </DialogTitle>
            <DialogContent>
                <DialogContentText>
                    Get a daily reminder when tasks are due or overdue. Notifications are grouped
                    into one per day so they won't be noisy.
                </DialogContentText>
                <Box sx={{ mt: 1 }}>
                    <DialogContentText variant="body2" color="text.secondary">
                        You can change this anytime in Settings.
                    </DialogContentText>
                </Box>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button onClick={handleDismiss} color="inherit">
                    No Thanks
                </Button>
                <Button onClick={handleEnable} variant="contained">
                    Enable
                </Button>
            </DialogActions>
        </Dialog>
    );
}
