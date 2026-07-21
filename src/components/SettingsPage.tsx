import React from 'react';
import { Switch, alpha } from "@mui/material";
import { useGlobalStore, dialogPaperStyles } from "../store/globalStore";
import { useModalStore } from "../store/modalStore";
import { useNavigate } from "react-router-dom";
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import NotificationsIcon from '@mui/icons-material/Notifications';
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
import MenuBookIcon from '@mui/icons-material/MenuBook';
import BugReportIcon from '@mui/icons-material/BugReport';
import IconButton from "@mui/material/IconButton";
import DialogActions from '@mui/material/DialogActions';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Avatar from '@mui/material/Avatar';
import { useNotificationStore } from '../store/notificationStore';
import { notificationsSupported, requestNotificationPermission } from '../lib/notifications';
import { useNoteStore } from '../store/noteStore';
import { useTaskStore } from '../store/taskStore';
import { useProjectStore } from '../store/projectStore';
import { CSVLink } from 'react-csv';
import IosShareIcon from '@mui/icons-material/IosShare';
import Divider from '@mui/material/Divider';

function getInitials(name: string | null): string {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0][0]?.toUpperCase() || '?';
}

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

    const handleShareApp = async () => {
        const appUrl = 'https://tracker.simplesuite.dev';
        if (navigator.share) {
            try {
                await navigator.share({ title: 'simpleTracker', url: appUrl });
            } catch { /* cancelled */ }
        } else {
            await navigator.clipboard.writeText(appUrl)
                .then(() => { setSnackSev('success'); setSnackText('App link copied!'); setSnackOpen(true); })
                .catch(() => { setSnackSev('error'); setSnackText('Failed to copy link'); setSnackOpen(true); });
        }
    };

    const handleUpgrade = async () => {
        setCheckoutLoading(true);
        try { await redirectToCheckout(); }
        catch (err: any) { setSnackSev('error'); setSnackText(err.message || 'Failed to start checkout'); setSnackOpen(true); setCheckoutLoading(false); }
    };

    const handleManageBilling = async () => {
        setBillingLoading(true);
        try { await redirectToBillingPortal(); }
        catch (err: any) { setSnackSev('error'); setSnackText(err.message || 'Failed to open billing portal'); setSnackOpen(true); setBillingLoading(false); }
    };

    const handleThemeToggle = () => {
        const newDark = !slideCheck;
        setSlideCheck(newDark);
        const mode = newDark ? 'dark' : 'light';
        setTheme(mode);
        localStorage.setItem('userTheme', mode);
        setSnackSev('success');
        setSnackText(newDark ? 'Dark mode activated!' : 'Set to light mode.');
        setSnackOpen(true);
    };

    const handleNotificationsToggle = async () => {
        if (!notificationsEnabled) {
            const granted = await requestNotificationPermission();
            if (granted) { setNotificationsEnabled(true); setNotificationsPrompted(true); setSnackSev('success'); setSnackText('Notifications enabled'); setSnackOpen(true); }
            else { setSnackSev('warning'); setSnackText('Notification permission denied by browser'); setSnackOpen(true); }
        } else {
            setNotificationsEnabled(false); setSnackSev('success'); setSnackText('Notifications disabled'); setSnackOpen(true);
        }
    };

    async function supaLogOut() { await supabase.auth.signOut(); }

    React.useEffect(() => { setSlideCheck(currentTheme === 'dark'); }, [currentTheme]);

    const navigate = useNavigate();
    const fnLogout = () => { supaLogOut(); navigate("/login", { replace: true }); };

    const copyUserID = async () => {
        await navigator.clipboard.writeText(currentUserDetails.recordID)
            .then(() => { setSnackSev('success'); setSnackText('User ID copied'); setSnackOpen(true); })
            .catch(() => { setSnackSev('error'); setSnackText('Something went wrong'); setSnackOpen(true); });
    };

    React.useEffect(() => { window.scrollTo(0, 0); }, []);

    if (entitlementLoading) {
        return <Box display="flex" justifyContent="center" alignItems="center" sx={{ mt: 8 }}><CircularProgress /></Box>;
    }

    const subscriptionLabel = subscriptionState === 'active' ? 'Pro'
        : subscriptionState === 'trialing' ? 'Trial'
            : subscriptionState === 'canceling' ? 'Canceling' : 'Free';
    const subscriptionColor: 'success' | 'info' | 'warning' | 'default' =
        subscriptionState === 'active' ? 'success'
            : subscriptionState === 'trialing' ? 'info'
                : subscriptionState === 'canceling' ? 'warning' : 'default';

    return (
        <>
            <Box display="flex" flexDirection="column" alignItems="center" sx={{ pb: 4 }}>
                <Stack spacing={2.5} alignItems="stretch" sx={{ maxWidth: 560, width: '100%' }}>

                    {/* ─── Profile Card ─── */}
                    <Paper elevation={4} sx={{ borderRadius: 4, p: 3 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5, mb: 2.5 }}>
                            <Avatar
                                src={`https://api.dicebear.com/9.x/shapes/svg?seed=${currentUserDetails.recordID}`}
                                sx={{
                                    width: 72,
                                    height: 72,
                                    fontSize: '1.6rem',
                                    fontWeight: 700,
                                    bgcolor: theme.palette.primary.main,
                                    color: theme.palette.primary.contrastText,
                                    boxShadow: `0 4px 14px ${alpha(theme.palette.primary.main, 0.25)}`,
                                }}>
                                {getInitials(currentUserDetails.fullName)}
                            </Avatar>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }} noWrap>
                                    {currentUserDetails.fullName || 'User'}
                                </Typography>
                            </Box>
                        </Box>
                        <Divider sx={{ mb: 2 }} />
                        <Stack direction="row" spacing={1.5}>
                            <Button
                                variant="outlined" startIcon={<QrCodeIcon />}
                                onClick={() => setQrOpen(true)}
                                sx={{ textTransform: 'none', borderRadius: 2, flex: 1 }}
                            >
                                My QR Code
                            </Button>
                            <Button
                                variant="outlined" startIcon={<LogoutIcon />}
                                onClick={fnLogout} disabled={offline}
                                color="error"
                                sx={{ textTransform: 'none', borderRadius: 2, flex: 1 }}
                            >
                                Log Out
                            </Button>
                        </Stack>
                    </Paper>

                    {/* ─── Upgrade Banner (free only) ─── */}
                    {subscriptionState === 'free' && (
                        <Paper elevation={4} sx={{
                            borderRadius: 4,
                            p: 3,
                            background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.06)}, ${alpha(theme.palette.secondary.main, 0.06)})`,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 2,
                        }}>
                            <StarIcon sx={{ color: theme.palette.primary.main, fontSize: 28 }} />
                            <Box sx={{ flex: 1 }}>
                                <Typography variant="body1" sx={{ fontWeight: 700 }}>Upgrade to Pro</Typography>
                                <Typography variant="caption" color="text.secondary">Unlock exports, sharing & more</Typography>
                            </Box>
                            <Button
                                variant="contained" onClick={handleUpgrade}
                                disabled={offline || checkoutLoading}
                                sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
                            >
                                {checkoutLoading ? 'Loading...' : 'Upgrade'}
                            </Button>
                        </Paper>
                    )}
                    {subscriptionState === 'canceling' && (
                        <Alert severity="info" sx={{ borderRadius: 3 }}>
                            Plan active until {entitlement?.current_period_end
                                ? new Date(entitlement.current_period_end).toLocaleDateString()
                                : 'end of billing period'}
                        </Alert>
                    )}

                    {/* ─── Preferences Card ─── */}
                    <Paper elevation={4} sx={{ borderRadius: 4, p: 3 }}>
                        <Typography color="text.secondary" variant="subtitle2" sx={{ fontWeight: 800, mb: 2.5, textTransform: 'uppercase' }}>
                            Preferences
                        </Typography>

                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                <DarkModeIcon sx={{ color: theme.palette.mode === 'dark' ? '#90caf9' : '#5c6bc0', fontSize: 22 }} />
                                <Box>
                                    <Typography variant="body2" sx={{ fontWeight: 600 }}>Dark Mode</Typography>
                                    <Typography variant="caption" color="text.secondary">Easier on the eyes</Typography>
                                </Box>
                            </Box>
                            <Switch size="small" checked={slideCheck} onChange={handleThemeToggle} />
                        </Box>

                        {showNotificationsSetting && (
                            <>
                                <Divider sx={{ my: 2 }} />
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                        <NotificationsIcon sx={{ color: '#f57c00', fontSize: 22 }} />
                                        <Box>
                                            <Typography variant="body2" sx={{ fontWeight: 600 }}>Task Notifications</Typography>
                                            <Typography variant="caption" color="text.secondary">Daily reminders for due tasks</Typography>
                                        </Box>
                                    </Box>
                                    <Switch size="small" checked={notificationsEnabled} onChange={handleNotificationsToggle} />
                                </Box>
                                {permissionMismatch && (
                                    <Alert
                                        severity="warning"
                                        sx={{ borderRadius: 2, mt: 2 }}
                                        action={
                                            <Button color="inherit" onClick={handleFixPermission}>
                                                {Notification.permission === 'denied' ? 'How to fix' : 'Allow'}
                                            </Button>
                                        }
                                    >
                                        Notifications blocked at system level
                                    </Alert>
                                )}
                            </>
                        )}
                    </Paper>

                    {/* ─── Account Card ─── */}
                    <Paper elevation={4} sx={{ borderRadius: 4, p: 3 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
                            <Typography color="text.secondary" variant="subtitle2" sx={{ fontWeight: 800, textTransform: 'uppercase' }}>
                                Account
                            </Typography>
                            <Chip
                                label={subscriptionLabel}
                                size="small"
                                color={subscriptionColor}
                                variant={subscriptionState === 'free' ? 'outlined' : 'filled'}
                            />
                        </Box>

                        <Stack spacing={1.5}>
                            {subscriptionState !== 'free' && (
                                <Button
                                    variant="outlined" fullWidth startIcon={<ManageAccountsIcon />}
                                    color='primary'
                                    onClick={handleManageBilling} disabled={offline || billingLoading}
                                    sx={{ justifyContent: 'flex-start', textTransform: 'none', borderRadius: 2, py: 1.2 }}
                                >
                                    {billingLoading ? 'Redirecting...' : 'Manage Subscription'}
                                </Button>
                            )}
                            <Button
                                color='primary'
                                variant="outlined" fullWidth startIcon={<LockResetIcon />}
                                onClick={() => setOpenChangePassword(true)} disabled={offline}
                                sx={{ justifyContent: 'flex-start', textTransform: 'none', borderRadius: 2, py: 1.2 }}
                            >
                                Change Password
                            </Button>
                        </Stack>
                    </Paper>

                    {/* ─── Export Card ─── */}
                    <Paper elevation={4} sx={{ borderRadius: 4, p: 3 }}>
                        <Typography color="text.secondary" variant="subtitle2" sx={{ fontWeight: 800, mb: 1, textTransform: 'uppercase' }}>
                            Export Data
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2.5 }}>
                            Download your data as CSV files
                        </Typography>

                        {hasPro ? (
                            <Stack direction={bigger ? "row" : "column"} spacing={1.5}>
                                <Button
                                    color='secondary'
                                    component={CSVLink} data={notesCSVData} filename="simpletracker-notes.csv" target="_blank"
                                    variant="outlined" startIcon={<DownloadIcon />}
                                    sx={{ textDecoration: 'none', textTransform: 'none', borderRadius: 2 }}
                                >
                                    Notes ({notesCSVData.length})
                                </Button>
                                <Button
                                    color='secondary'
                                    component={CSVLink} data={tasksCSVData} filename="simpletracker-tasks.csv" target="_blank"
                                    variant="outlined" startIcon={<DownloadIcon />}
                                    sx={{ textDecoration: 'none', textTransform: 'none', borderRadius: 2 }}
                                >
                                    Tasks ({tasksCSVData.length})
                                </Button>
                                <Button
                                    color='secondary'
                                    component={CSVLink} data={projectsCSVData} filename="simpletracker-projects.csv" target="_blank"
                                    variant="outlined" startIcon={<DownloadIcon />}
                                    sx={{ textDecoration: 'none', textTransform: 'none', borderRadius: 2 }}
                                >
                                    Projects ({projectsCSVData.length})
                                </Button>
                            </Stack>
                        ) : (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 2, borderRadius: 2, bgcolor: alpha(theme.palette.action.disabled, 0.04) }}>
                                <LockIcon sx={{ color: 'text.disabled', fontSize: 20 }} />
                                <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
                                    Exports are a Pro feature
                                </Typography>
                                <Chip label="Pro" size="small" variant="outlined" />
                            </Box>
                        )}
                    </Paper>

                    {/* ─── Support Card ─── */}
                    <Paper elevation={4} sx={{ borderRadius: 4, p: 3 }}>
                        <Typography color="text.secondary" variant="subtitle2" sx={{ fontWeight: 800, mb: 2.5, textTransform: 'uppercase' }}>
                            Support
                        </Typography>

                        <Stack direction={bigger ? "row" : "column"} spacing={1.5}>
                            <Button
                                color='primary'
                                variant="outlined" startIcon={<MenuBookIcon />}
                                component="a" href="https://simplesuite.dev/guides" target="_blank" rel="noopener noreferrer"
                                sx={{ textTransform: 'none', borderRadius: 2, textDecoration: 'none' }}
                            >
                                Guides
                            </Button>
                            <Button
                                color='primary'
                                variant="outlined" startIcon={<BugReportIcon />}
                                component="a" href="https://github.com/simplesuite/simpletracker/issues" target="_blank" rel="noopener noreferrer"
                                sx={{ textTransform: 'none', borderRadius: 2, textDecoration: 'none' }}
                            >
                                Report Bug
                            </Button>
                            <Button
                                color='primary'
                                variant="outlined" startIcon={<IosShareIcon />}
                                onClick={handleShareApp}
                                sx={{ textTransform: 'none', borderRadius: 2 }}
                            >
                                Share App
                            </Button>
                        </Stack>
                    </Paper>

                </Stack>
            </Box>

            <ChangePassword />
            <Dialog
                open={qrOpen}
                onClose={() => setQrOpen(false)}
                fullScreen={!bigger}
                slotProps={{ paper: bigger ? dialogPaperStyles : undefined }}
            >
                <Box sx={{ bgcolor: 'background.paper', height: '100%' }} component="form" onSubmit={() => { copyUserID(); setQrOpen(false); }}>
                    <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        My User ID<IconButton onClick={() => setQrOpen(false)}><CloseIcon /></IconButton>
                    </DialogTitle>
                    <DialogContent sx={{ textAlign: 'center', pb: 3 }} dividers>
                        <QRCodeSVG value={currentUserDetails.recordID} size={200} />
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 2, wordBreak: 'break-all' }}>
                            {currentUserDetails.recordID}
                        </Typography>
                        <DialogActions>
                            <Button sx={{ mt: 1 }} fullWidth variant="contained" type="submit" startIcon={<ContentCopyIcon />}>
                                Copy to Clipboard
                            </Button>
                        </DialogActions>
                    </DialogContent>
                </Box>
            </Dialog>
        </>
    );
}
