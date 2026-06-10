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
import DownloadIcon from '@mui/icons-material/Download';
import { supabase } from "../lib/supabase";
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import QrCodeIcon from '@mui/icons-material/QrCode';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import { QRCodeSVG } from 'qrcode.react';
import ChangePassword from './modals/ChangePassword'
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
    const currentUserDetails = useGlobalStore(s => s.currentUser)
    const [qrOpen, setQrOpen] = React.useState(false)
    const notificationsEnabled = useNotificationStore(s => s.enabled);
    const setNotificationsEnabled = useNotificationStore(s => s.setEnabled);
    const setNotificationsPrompted = useNotificationStore(s => s.setPrompted);
    const showNotificationsSetting = notificationsSupported();

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
        // Re-check when the app regains focus (user may have changed system settings)
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') check();
        };
        document.addEventListener('visibilitychange', handleVisibility);
        return () => document.removeEventListener('visibilitychange', handleVisibility);
    }, [notificationsEnabled]);

    const handleFixPermission = async () => {
        if (Notification.permission === 'denied') {
            // Can't re-request after denial — direct user to system settings
            setSnackSev('info');
            setSnackText('Please enable notifications in your device/browser settings');
            setSnackOpen(true);
        } else {
            // Permission is 'default' — we can re-request
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

    const handleThemeClick = (event: any) => {
        setSlideCheck(event.target.checked);
        if (event.target.checked) {
            setTheme('dark');
            localStorage.setItem('userTheme', 'dark')
            setSnackSev('success')
            setSnackText('Dark mode activated!')
            setSnackOpen(true)
        } else {
            setTheme('light');
            localStorage.setItem('userTheme', 'light')
            setSnackSev('success')
            setSnackText('Set to light mode.')
            setSnackOpen(true)
        }
    };

    const handleListThemeClick = () => {
        if (!slideCheck) {
            setTheme('dark');
            localStorage.setItem('userTheme', 'dark')
            setSnackSev('success')
            setSnackText('Dark mode activated!')
            setSnackOpen(true)
        } else {
            setTheme('light');
            localStorage.setItem('userTheme', 'light')
            setSnackSev('success')
            setSnackText('Set to light mode.')
            setSnackOpen(true)
        }
        setSlideCheck(!slideCheck);
    };

    const handleNotificationsToggle = async () => {
        if (!notificationsEnabled) {
            // Turning on — need permission
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
            // Turning off
            setNotificationsEnabled(false);
            setSnackSev('success');
            setSnackText('Notifications disabled');
            setSnackOpen(true);
        }
    };

    async function supaLogOut() {
        let { error } = await supabase.auth.signOut()
    }

    React.useEffect(() => {
        if (currentTheme === 'dark') {
            setSlideCheck(true)
        } else {
            setSlideCheck(false)
        }
    }, [slideCheck, currentTheme]);

    const navigate = useNavigate();
    const fnLogout = () => {
        supaLogOut()
        navigate("/login", { replace: true });
    }

    const copyUserID = async () => {
        await navigator.clipboard
            .writeText(currentUserDetails.recordID)
            .then(() => {
                setSnackSev('success')
                setSnackText('User ID copied')
                setSnackOpen(true)
            })
            .catch(() => {
                setSnackSev('error')
                setSnackText('Something went wrong')
                setSnackOpen(true)
            });
    }

    React.useEffect(() => {
        window.scrollTo(0, 0)
    }, [])

    return (
        <>
            <Box display='flex' flexDirection='column' alignItems='center'>
                <Stack spacing={2} alignItems="stretch" sx={{ maxWidth: 400, width: '100%' }}>
                    <Typography sx={{ alignSelf: 'flex-start' }} color='text.secondary' variant='h6'>Settings</Typography>
                    <Paper elevation={4} sx={{ width: '100%', borderRadius: 3 }}>
                        <List>
                            <ListItem disablePadding>
                                <Typography color='text.secondary' variant='h6' sx={{ fontWeight: '600', ml: 1 }}>General</Typography>
                            </ListItem>
                            <Divider />
                            <ListItem disablePadding>
                                <ListItemButton onClick={handleListThemeClick}>
                                    <ListItemIcon>
                                        <DarkModeIcon />
                                    </ListItemIcon>
                                    <ListItemText primary="Dark Mode" />
                                    <Switch sx={{ ml: 1 }} size='small' checked={slideCheck} onChange={handleThemeClick} />
                                </ListItemButton>
                            </ListItem>
                            {showNotificationsSetting && (
                                <>
                                    <Divider />
                                    <ListItem disablePadding>
                                        <ListItemButton onClick={handleNotificationsToggle}>
                                            <ListItemIcon>
                                                <NotificationsIcon />
                                            </ListItemIcon>
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
                    <Paper elevation={4} sx={{ width: '100%', borderRadius: 3 }}>
                        <List>
                            <ListItem disablePadding>
                                <Typography color='text.secondary' variant='h6' sx={{ fontWeight: '600', ml: 1 }}>Account: {currentUserDetails.fullName}</Typography>
                            </ListItem>
                            <Divider />
                            <ListItem disablePadding>
                                <ListItemButton onClick={() => setQrOpen(true)}>
                                    <ListItemIcon>
                                        <QrCodeIcon />
                                    </ListItemIcon>
                                    <ListItemText primary="Show My QR Code" secondary="For sharing" />
                                </ListItemButton>
                            </ListItem>
                            <Divider />
                            <ListItem disablePadding>
                                <ListItemButton onClick={() => setOpenChangePassword(true)} disabled={offline}>
                                    <ListItemIcon>
                                        <LockResetIcon />
                                    </ListItemIcon>
                                    <ListItemText primary="Change Password" />
                                </ListItemButton>
                            </ListItem>
                            <Divider />
                            <ListItem disablePadding>
                                <ListItemButton onClick={fnLogout} disabled={offline}>
                                    <ListItemIcon>
                                        <LogoutIcon />
                                    </ListItemIcon>
                                    <ListItemText primary="Logout" />
                                </ListItemButton>
                            </ListItem>
                        </List>
                    </Paper>
                    <Paper elevation={4} sx={{ width: '100%', borderRadius: 3 }}>
                        <List>
                            <ListItem disablePadding>
                                <Typography color='text.secondary' variant='h6' sx={{ fontWeight: '600', ml: 1 }}>Export Data</Typography>
                            </ListItem>
                            <Divider />
                            <ListItem disablePadding>
                                <ListItemButton component={CSVLink} data={notesCSVData} filename="simpletracker-notes.csv" target="_blank" sx={{ textDecoration: 'none', color: 'inherit' }}>
                                    <ListItemIcon>
                                        <DownloadIcon />
                                    </ListItemIcon>
                                    <ListItemText primary="Export Notes" secondary={`${notesCSVData.length} notes`} />
                                </ListItemButton>
                            </ListItem>
                            <Divider />
                            <ListItem disablePadding>
                                <ListItemButton component={CSVLink} data={tasksCSVData} filename="simpletracker-tasks.csv" target="_blank" sx={{ textDecoration: 'none', color: 'inherit' }}>
                                    <ListItemIcon>
                                        <DownloadIcon />
                                    </ListItemIcon>
                                    <ListItemText primary="Export Tasks" secondary={`${tasksCSVData.length} tasks`} />
                                </ListItemButton>
                            </ListItem>
                            <Divider />
                            <ListItem disablePadding>
                                <ListItemButton component={CSVLink} data={projectsCSVData} filename="simpletracker-projects.csv" target="_blank" sx={{ textDecoration: 'none', color: 'inherit' }}>
                                    <ListItemIcon>
                                        <DownloadIcon />
                                    </ListItemIcon>
                                    <ListItemText primary="Export Projects" secondary={`${projectsCSVData.length} projects`} />
                                </ListItemButton>
                            </ListItem>
                        </List>
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
    )
}
