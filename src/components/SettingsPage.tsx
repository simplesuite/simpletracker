import React from 'react';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import { Switch } from "@mui/material";
import { useGlobalStore, dialogPaperStyles } from "../store/globalStore";
import { useModalStore } from "../store/modalStore";
import { useNavigate } from "react-router-dom";
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Divider from "@mui/material/Divider";
import Typography from '@mui/material/Typography';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import NotificationsIcon from '@mui/icons-material/Notifications';
import ListItemIcon from '@mui/material/ListItemIcon';
import LockResetIcon from '@mui/icons-material/LockReset';
import LogoutIcon from '@mui/icons-material/Logout';
import LockIcon from '@mui/icons-material/Lock';
import DownloadIcon from '@mui/icons-material/Download';
import StarIcon from '@mui/icons-material/Star';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import Chip from '@mui/material/Chip';
import { supabase } from "../lib/supabase";
import { redirectToCheckout, redirectToBillingPortal, useEntitlement } from "../lib/checkout";
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import QrCodeIcon from '@mui/icons-material/QrCode';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import { QRCodeSVG } from 'qrcode.react';
import ChangePassword from './modals/ChangePassword';
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useIsOffline } from "./extras/OfflineAlert";
import CloseIcon from '@mui/icons-material/Close';
import IconButton from "@mui/material/IconButton";
import DialogActions from '@mui/material/DialogActions';
import Alert from '@mui/material/Alert';
import { useNotificationStore } from '../store/notificationStore';
import { notificationsSupported, requestNotificationPermission } from '../lib/notifications';
import { useNoteStore } from '../store/noteStore';
import { useTaskStore } from '../store/taskStore';
import { useProjectStore } from '../store/projectStore';
import { CSVLink } from 'react-csv';

export default function SettingsPage() {
    const offline = useIsOffline();
    const theme = useTheme();
    const bigger = useMediaQuery(theme.breakpoints.up('sm'));
    const [slideCheck, setSlideCheck] = React.useState(false);
    const currentTheme = useGlobalStore(s => s.themeAtom);
    const setTheme = useGlobalStore(s => s.setThemeAtom);
    const setOpenChangePassword = useModalStore(s => s.setOpenChangePassword);
    const setSnackText = useGlobalStore(s => s.setSnackBarText);
    const setSnackSev = useGlobalStore(s => s.setSnackBarSeverity);
    const setSnackOpen = useGlobalStore(s => s.setSnackBarOpen);
    const currentUserDetails = useGlobalStore(s => s.currentUser);
    const [qrOpen, setQrOpen] = React.useState(false);
    const notificationsEnabled = useNotificationStore(s => s.enabled);
    const setNotificationsEnabled = useNotificationStore(s => s.setEnabled);
    const setNotificationsPrompted = useNotificationStore(s => s.setPrompted);
    const showNotificationsSetting = notificationsSupported();

    const [checkoutLoading, setCheckoutLoading] = React.useState(false);
    const [billingLoading, setBillingLoading] = React.useState(false);
    const { entitlement, subscriptionState, loading: entitlementLoading } = useEntitlement();
    const hasPro = entitlementLoading || subscriptionState !== 'free';

    const notes = useNoteStore(s => s.notes);
    const archivedNotes = useNoteStore(s => s.archivedNotes);
    const tasks = useTaskStore(s => s.tasks);
    const projects = useProjectStore(s => s.projects);

    const formatDate = (ts: number) => new Date(ts).toISOString();

    const notesCSVData = React.useMemo(() => {
        const allNotes = [...notes, ...archivedNotes];
        return allNotes.map(n => ({
            title: n.title,
            body: n.body,
            type: n.noteType,
            project: projects.find(p => p.recordID === n.projectID)?.name || '',
            archived: n.archived ? 'Yes' : 'No',
            pinned: n.pinned ? 'Yes' : 'No',
            createdAt: formatDate(n.createdAt),
            updatedAt: formatDate(n.updatedAt),
        }));
    }, [notes, archivedNotes, projects]);

    const tasksCSVData = React.useMemo(() => {
        return tasks.map(t => ({
            title: t.title,
            body: t.body,
            status: t.status,
            project: projects.find(p => p.recordID === t.projectID)?.name || '',
            dueDate: t.dueDate ? formatDate(t.dueDate) : '',
            isRecurring: t.isRecurring ? 'Yes' : 'No',
            recurrenceInterval: t.recurrenceInterval ?? '',
            recurrenceUnit: t.recurrenceUnit ?? '',
            completedAt: t.completedAt ? formatDate(t.completedAt) : '',
            createdAt: formatDate(t.createdAt),
            updatedAt: formatDate(t.updatedAt),
        }));
    }, [tasks, projects]);

    const projectsCSVData = React.useMemo(() => {
        return projects.map(p => ({
            name: p.name,
            description: p.description,
            createdAt: formatDate(p.createdAt),
            updatedAt: formatDate(p.updatedAt),
        }));
    }, [projects]);

    // Detect mismatch: app thinks notifications are enabled but system permission is off
    const [permissionMismatch, setPermissionMismatch] = React.useState(false);
    React.useEffect(() => {
        const check = () => {
            if (notificationsEnabled && notificationsSupported() && Notification.permission !== 'granted') {
                setPermissionMismatch(true);
            } else {
                setPermissionMismatch(false);
            }
        };
        check();
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') check();
        };
        document.addEventListener('visibilitychange', handleVisibility);
        return () => document.removeEventListener('visibilitychange', handleVisibility);
    }, [notificationsEnabled]);

    const handleFixPermission = async () => {
        if (Notification.permission === 'denied') {
            setSnackSev('info');
            setSnackText('Please enable notifications in your device/browser settings');
            setSnackOpen(true);
        } else {
            const granted = await requestNotificationPermission();
            if (granted) {
                setPermissionMismatch(false);
                setSnackSev('success');
                setSnackText('Notifications re-enabled!');
                setSnackOpen(true);
            } else {
                setSnackSev('warning');
                setSnackText('Permission denied — enable in device settings');
                setSnackOpen(true);
            }
        }
    };

    const handleUpgrade = async () => {
        setCheckoutLoading(true);
        try {
            await redirectToCheckout();
        } catch (err: any) {
            setSnackSev('error');
            setSnackText(err.message || 'Failed to start checkout');
            setSnackOpen(true);
            setCheckoutLoading(false);
        }
    };

    const handleManageBilling = async () => {
        setBillingLoading(true);
        try {
            await redirectToBillingPortal();
        } catch (err: any) {
            setSnackSev('error');
            setSnackText(err.message || 'Failed to open billing portal');
            setSnackOpen(true);
            setBillingLoading(false);
        }
    };

    const handleThemeClick = (event: any) => {
        setSlideCheck(event.target.checked);
        if (event.target.checked) {
            setTheme('dark');
            localStorage.setItem('userTheme', 'dark');
            setSnackSev('success');
            setSnackText('Dark mode activated!');
            setSnackOpen(true);
        } else {
            setTheme('light');
            localStorage.setItem('userTheme', 'light');
            setSnackSev('success');
            setSnackText('Set to light mode.');
            setSnackOpen(true);
        }
    };

    const handleListThemeClick = () => {
        if (!slideCheck) {
            setTheme('dark');
            localStorage.setItem('userTheme', 'dark');
            setSnackSev('success');
            setSnackText('Dark mode activated!');
            setSnackOpen(true);
        } else {
            setTheme('light');
            localStorage.setItem('userTheme', 'light');
            setSnackSev('success');
            setSnackText('Set to light mode.');
            setSnackOpen(true);
        }
        setSlideCheck(!slideCheck);
    };

    const handleNotificationsToggle = async () => {
        if (!notificationsEnabled) {
            const granted = await requestNotificationPermission();
            if (granted) {
                setNotificationsEnabled(true);
                setNotificationsPrompted(true);
                setSnackSev('success');
                setSnackText('Notifications enabled');
                setSnackOpen(true);
            } else {
                setSnackSev('warning');
                setSnackText('Notification permission denied by browser');
                setSnackOpen(true);
            }
        } else {
            setNotificationsEnabled(false);
            setSnackSev('success');
            setSnackText('Notifications disabled');
            setSnackOpen(true);
        }
    };

    async function supaLogOut() {
        let { error } = await supabase.auth.signOut();
    }

    React.useEffect(() => {
        if (currentTheme === 'dark') {
            setSlideCheck(true);
        } else {
            setSlideCheck(false);
        }
    }, [slideCheck, currentTheme]);

    const navigate = useNavigate();
    const fnLogout = () => {
        supaLogOut();
        navigate("/login", { replace: true });
    };

    const copyUserID = async () => {
        await navigator.clipboard
            .writeText(currentUserDetails.recordID)
            .then(() => {
                setSnackSev('success');
                setSnackText('User ID copied');
                setSnackOpen(true);
            })
            .catch(() => {
                setSnackSev('error');
                setSnackText('Something went wrong');
                setSnackOpen(true);
            });
    };

    React.useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    return (
        <>
            <Box display='flex' flexDirection='column' alignItems='center'>
                <Stack spacing={2} alignItems="stretch" sx={{ maxWidth: 600, width: '100%' }}>

                    {/* Account & Subscription */}
                    <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                            <Typography color='text.secondary' variant='subtitle2' sx={{ fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                {currentUserDetails.fullName}
                            </Typography>
                            {!entitlementLoading && (
                                subscriptionState === 'active' ? (
                                    <Chip label="Pro" size="small" color="success" />
                                ) : subscriptionState === 'trialing' ? (
                                    <Chip label="Trial" size="small" color="info" />
                                ) : subscriptionState === 'canceling' ? (
                                    <Chip label="Canceling" size="small" color="warning" />
                                ) : (
                                    <Chip label="Free" size="small" variant="outlined" />
                                )
                            )}
                        </Box>
                        <Paper elevation={4} sx={{ width: '100%', borderRadius: 3 }}>
                            <List>
                                {entitlementLoading ? (
                                    <ListItem sx={{ justifyContent: 'center', py: 2 }}>
                                        <Typography variant="body2" color="text.secondary">Loading...</Typography>
                                    </ListItem>
                                ) : (
                                    <>
                                        {subscriptionState === 'free' && (
                                            <>
                                                <ListItem disablePadding>
                                                    <ListItemButton onClick={handleUpgrade} disabled={offline || checkoutLoading}>
                                                        <ListItemIcon><StarIcon /></ListItemIcon>
                                                        <ListItemText
                                                            primary="Upgrade to Pro"
                                                            secondary={checkoutLoading ? "Redirecting to checkout..." : "Unlock premium features"}
                                                        />
                                                    </ListItemButton>
                                                </ListItem>
                                                <Divider />
                                            </>
                                        )}
                                        {subscriptionState === 'canceling' && (
                                            <>
                                                <ListItem sx={{ px: 2, py: 1 }}>
                                                    <Typography variant="body2" color="text.secondary">
                                                        Your plan is active until {entitlement?.current_period_end
                                                            ? new Date(entitlement.current_period_end).toLocaleDateString()
                                                            : 'end of billing period'}
                                                    </Typography>
                                                </ListItem>
                                                <Divider />
                                            </>
                                        )}
                                        {subscriptionState !== 'free' && (
                                            <>
                                                <ListItem disablePadding>
                                                    <ListItemButton onClick={handleManageBilling} disabled={offline || billingLoading}>
                                                        <ListItemIcon><ManageAccountsIcon /></ListItemIcon>
                                                        <ListItemText
                                                            primary="Manage Subscription"
                                                            secondary={billingLoading ? "Redirecting to billing portal..." : "Update payment, cancel, or view invoices"}
                                                        />
                                                    </ListItemButton>
                                                </ListItem>
                                                <Divider />
                                            </>
                                        )}
                                    </>
                                )}
                                <ListItem disablePadding>
                                    <ListItemButton onClick={() => setQrOpen(true)}>
                                        <ListItemIcon><QrCodeIcon /></ListItemIcon>
                                        <ListItemText primary="Show My QR Code" secondary="For sharing" />
                                    </ListItemButton>
                                </ListItem>
                                <Divider />
                                <ListItem disablePadding>
                                    <ListItemButton onClick={() => setOpenChangePassword(true)} disabled={offline}>
                                        <ListItemIcon><LockResetIcon /></ListItemIcon>
                                        <ListItemText primary="Change Password" />
                                    </ListItemButton>
                                </ListItem>
                                <Divider />
                                <ListItem disablePadding>
                                    <ListItemButton onClick={fnLogout} disabled={offline}>
                                        <ListItemIcon><LogoutIcon /></ListItemIcon>
                                        <ListItemText primary="Logout" />
                                    </ListItemButton>
                                </ListItem>
                            </List>
                        </Paper>
                    </Box>

                    {/* Preferences */}
                    <Box>
                        <Typography color='text.secondary' variant='subtitle2' sx={{ fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, mb: 1 }}>
                            Preferences
                        </Typography>
                        <Paper elevation={4} sx={{ width: '100%', borderRadius: 3 }}>
                            <List>
                                <ListItem disablePadding>
                                    <ListItemButton onClick={handleListThemeClick}>
                                        <ListItemIcon><DarkModeIcon /></ListItemIcon>
                                        <ListItemText primary="Dark Mode" />
                                        <Switch sx={{ ml: 1 }} size='small' checked={slideCheck} onChange={handleThemeClick} />
                                    </ListItemButton>
                                </ListItem>
                                {showNotificationsSetting && (
                                    <>
                                        <Divider />
                                        <ListItem disablePadding>
                                            <ListItemButton onClick={handleNotificationsToggle}>
                                                <ListItemIcon><NotificationsIcon /></ListItemIcon>
                                                <ListItemText primary="Task Notifications" secondary="Daily reminders for due & overdue tasks" />
                                                <Switch sx={{ ml: 1 }} size='small' checked={notificationsEnabled} onChange={handleNotificationsToggle} />
                                            </ListItemButton>
                                        </ListItem>
                                        {permissionMismatch && (
                                            <ListItem>
                                                <Alert
                                                    severity="warning"
                                                    sx={{ width: '100%', borderRadius: 2 }}
                                                    action={
                                                        <Button color="inherit" size="small" onClick={handleFixPermission}>
                                                            {Notification.permission === 'denied' ? 'How to fix' : 'Allow'}
                                                        </Button>
                                                    }
                                                >
                                                    Notifications are blocked at the system level
                                                </Alert>
                                            </ListItem>
                                        )}
                                    </>
                                )}
                            </List>
                        </Paper>
                    </Box>

                    {/* Export Data */}
                    <Box>
                        <Typography color='text.secondary' variant='subtitle2' sx={{ fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, mb: 1 }}>
                            Export Data
                        </Typography>
                        <Paper elevation={4} sx={{ width: '100%', borderRadius: 3 }}>
                            <List>
                                <ListItem disablePadding>
                                    {hasPro ? (
                                        <ListItemButton component={CSVLink} data={notesCSVData} filename="simpletracker-notes.csv" target="_blank" sx={{ textDecoration: 'none', color: 'inherit' }}>
                                            <ListItemIcon><DownloadIcon /></ListItemIcon>
                                            <ListItemText primary="Export Notes" secondary={`${notesCSVData.length} notes`} />
                                        </ListItemButton>
                                    ) : (
                                        <ListItemButton disabled>
                                            <ListItemIcon><LockIcon color="disabled" /></ListItemIcon>
                                            <ListItemText primary="Export Notes" secondary="Pro feature" />
                                            <Chip label="Pro" size="small" variant="outlined" sx={{ ml: 1 }} />
                                        </ListItemButton>
                                    )}
                                </ListItem>
                                <Divider />
                                <ListItem disablePadding>
                                    {hasPro ? (
                                        <ListItemButton component={CSVLink} data={tasksCSVData} filename="simpletracker-tasks.csv" target="_blank" sx={{ textDecoration: 'none', color: 'inherit' }}>
                                            <ListItemIcon><DownloadIcon /></ListItemIcon>
                                            <ListItemText primary="Export Tasks" secondary={`${tasksCSVData.length} tasks`} />
                                        </ListItemButton>
                                    ) : (
                                        <ListItemButton disabled>
                                            <ListItemIcon><LockIcon color="disabled" /></ListItemIcon>
                                            <ListItemText primary="Export Tasks" secondary="Pro feature" />
                                            <Chip label="Pro" size="small" variant="outlined" sx={{ ml: 1 }} />
                                        </ListItemButton>
                                    )}
                                </ListItem>
                                <Divider />
                                <ListItem disablePadding>
                                    {hasPro ? (
                                        <ListItemButton component={CSVLink} data={projectsCSVData} filename="simpletracker-projects.csv" target="_blank" sx={{ textDecoration: 'none', color: 'inherit' }}>
                                            <ListItemIcon><DownloadIcon /></ListItemIcon>
                                            <ListItemText primary="Export Projects" secondary={`${projectsCSVData.length} projects`} />
                                        </ListItemButton>
                                    ) : (
                                        <ListItemButton disabled>
                                            <ListItemIcon><LockIcon color="disabled" /></ListItemIcon>
                                            <ListItemText primary="Export Projects" secondary="Pro feature" />
                                            <Chip label="Pro" size="small" variant="outlined" sx={{ ml: 1 }} />
                                        </ListItemButton>
                                    )}
                                </ListItem>
                            </List>
                        </Paper>
                    </Box>

                </Stack>
            </Box>
            <ChangePassword />
            <Dialog
                open={qrOpen}
                onClose={() => setQrOpen(false)}
                fullScreen={!bigger}
                slotProps={{ paper: bigger ? dialogPaperStyles : undefined }}
            >
                <Box sx={{ bgcolor: 'background.paper', height: '100%' }} component='form' onSubmit={() => { copyUserID(); setQrOpen(false); }}>
                    <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        My User ID<IconButton onClick={() => setQrOpen(false)}><CloseIcon /></IconButton>
                    </DialogTitle>
                    <DialogContent sx={{ textAlign: 'center', pb: 3 }} dividers>
                        <QRCodeSVG value={currentUserDetails.recordID} size={200} />
                        <Typography variant='body2' color='text.secondary' sx={{ mt: 2, wordBreak: 'break-all' }}>
                            {currentUserDetails.recordID}
                        </Typography>
                        <DialogActions>
                            <Button
                                sx={{ mt: 1 }}
                                fullWidth
                                variant='contained'
                                type='submit'
                                startIcon={<ContentCopyIcon />}
                            >
                                Copy to Clipboard
                            </Button>
                        </DialogActions>
                    </DialogContent>
                </Box>
            </Dialog>
        </>
    );
}
