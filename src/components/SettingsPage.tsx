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
import ListItemIcon from '@mui/material/ListItemIcon';
import LockResetIcon from '@mui/icons-material/LockReset';
import LogoutIcon from '@mui/icons-material/Logout';
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
