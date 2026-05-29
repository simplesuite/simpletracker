import React from 'react';
import TextField from "@mui/material/TextField";
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Grid from '@mui/material/Grid';
import { useModalStore } from '../../store/modalStore';
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import { dialogPaperStyles, useGlobalStore } from "../../store/globalStore";
import InputAdornment from '@mui/material/InputAdornment';
import { supabase } from "../../lib/supabase";
import { ensureSession } from "../extras/ensureSession";
import CloseIcon from '@mui/icons-material/Close';
import IconButton from "@mui/material/IconButton";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import SaveIcon from '@mui/icons-material/Save';

export default function ChangePassword() {
    const openModal = useModalStore(s => s.openChangePassword);
    const setOpenModal = useModalStore(s => s.setOpenChangePassword);
    const setSnackText = useGlobalStore(s => s.setSnackBarText);
    const setSnackSev = useGlobalStore(s => s.setSnackBarSeverity);
    const setSnackOpen = useGlobalStore(s => s.setSnackBarOpen);
    const [currentPassword, setCurrentPassword] = React.useState('')
    const [newPassword0, setNewPassword0] = React.useState('')
    const [newPassword1, setNewPassword1] = React.useState('')
    const [showPassword0, setShowPassword0] = React.useState(false)
    const [showPassword1, setShowPassword1] = React.useState(false)
    const [showPassword2, setShowPassword2] = React.useState(false)
    const [errorText, setErrorText] = React.useState('')
    const theme = useTheme();
    const bigger = useMediaQuery(theme.breakpoints.up('sm'));
    const verifyInputs = () => {
        if (newPassword0 !== newPassword1) {
            setErrorText('New passwords must match!')
            return false
        }
        if (!currentPassword) {
            setErrorText('Please enter your current password')
        }
        return true
    }
    async function handleSubmit(event: any) {
        event.preventDefault();
        setErrorText('')
        if (verifyInputs()) {
            await ensureSession();
            const { data, error } = await supabase.auth.updateUser({
                password: newPassword0,
            })
            if (error) {
                setErrorText(error.message)
                return
            }
            setOpenModal(false)
            setSnackSev('success')
            setSnackText('Password Saved!')
            setSnackOpen(true)
        }
    }
    React.useEffect(() => {
        if (openModal) return;
        setCurrentPassword('')
        setNewPassword0('')
        setNewPassword1('')
        setErrorText('')
    }, [openModal])
    return (
        <>
            <Dialog open={openModal}
                onClose={() => setOpenModal(false)}
                scroll='paper'
                fullScreen={!bigger}
                slotProps={{ paper: bigger ? dialogPaperStyles : undefined }}
            >
                <Box sx={{ bgcolor: 'background.paper', height: '100%' }} component='form' onSubmit={handleSubmit}>
                    <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        Change Password <IconButton onClick={() => setOpenModal(false)}><CloseIcon /></IconButton>
                    </DialogTitle>
                    <DialogContent dividers>
                        <Grid container spacing={2}>
                            <Grid size={12}>
                                <TextField
                                    fullWidth
                                    name="current"
                                    type={showPassword0 ? 'text' : 'password'}
                                    label="Current Password"
                                    value={currentPassword}
                                    slotProps={{
                                        input: {
                                            endAdornment: <InputAdornment position="end">
                                                <IconButton
                                                    aria-label="toggle password visibility"
                                                    onClick={() => {
                                                        setShowPassword0(!showPassword0)
                                                    }}
                                                    onMouseDown={(event: React.MouseEvent<HTMLButtonElement>) => {
                                                        event.preventDefault();
                                                    }}
                                                    edge="end"
                                                >
                                                    {showPassword0 ? <VisibilityOff /> : <Visibility />}
                                                </IconButton>
                                            </InputAdornment>,
                                        },
                                    }}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                />
                            </Grid>
                            <Grid size={12}>
                                <TextField
                                    fullWidth
                                    name="new"
                                    type={showPassword1 ? 'text' : 'password'}
                                    label="New Password"
                                    value={newPassword0}
                                    slotProps={{
                                        input: {
                                            endAdornment: <InputAdornment position="end">
                                                <IconButton
                                                    aria-label="toggle password visibility"
                                                    onClick={() => {
                                                        setShowPassword1(!showPassword1)
                                                    }}
                                                    onMouseDown={(event: React.MouseEvent<HTMLButtonElement>) => {
                                                        event.preventDefault();
                                                    }}
                                                    edge="end"
                                                >
                                                    {showPassword1 ? <VisibilityOff /> : <Visibility />}
                                                </IconButton>
                                            </InputAdornment>,
                                        },
                                    }}
                                    onChange={(e) => setNewPassword0(e.target.value)}
                                />
                            </Grid>
                            <Grid size={12}>
                                <TextField
                                    fullWidth
                                    name="newRepeat"
                                    type={showPassword2 ? 'text' : 'password'}
                                    label="New Password Again"
                                    value={newPassword1}
                                    slotProps={{
                                        input: {
                                            endAdornment: <InputAdornment position="end">
                                                <IconButton
                                                    aria-label="toggle password visibility"
                                                    onClick={() => {
                                                        setShowPassword2(!showPassword2)
                                                    }}
                                                    onMouseDown={(event: React.MouseEvent<HTMLButtonElement>) => {
                                                        event.preventDefault();
                                                    }}
                                                    edge="end"
                                                >
                                                    {showPassword2 ? <VisibilityOff /> : <Visibility />}
                                                </IconButton>
                                            </InputAdornment>,
                                        },
                                    }}
                                    onChange={(e) => setNewPassword1(e.target.value)}
                                />
                            </Grid>
                        </Grid>
                    </DialogContent>
                    <Box sx={{ mx: 1, mt: 0.5 }}><Typography color='error'>{errorText}</Typography></Box>
                    <DialogActions>
                        <Button fullWidth startIcon={<SaveIcon />} variant='contained' type='submit'>Save New Password</Button>
                    </DialogActions>
                </Box>
            </Dialog>
        </>
    )
}
