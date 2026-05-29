import * as React from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import { dialogPaperStyles, useGlobalStore } from "../../store/globalStore";
import Box from "@mui/material/Box";
import { useModalStore } from '../../store/modalStore';

export default function AreYouSure() {
    const open = useModalStore(s => s.areYouSure)
    const setOpen = useModalStore(s => s.setAreYouSure)
    const setAccept = useGlobalStore(s => s.setAreYouSureAccept)
    const title = useGlobalStore(s => s.areYouSureTitle)
    const details = useGlobalStore(s => s.areYouSureDetails)
    function handleClick(answer: boolean) {
        setAccept(answer)
        setOpen(false)
    }
    return (
        <div>
            <Dialog
                open={open}
                onClose={() => setOpen(false)}
                slotProps={{ paper: dialogPaperStyles }}
            >
                <Box sx={{ bgcolor: 'background.paper', height: '100%' }}>
                    <DialogTitle id="alert-dialog-title">
                        {title}
                    </DialogTitle>
                    <DialogContent>
                        <DialogContentText>
                            {details}
                        </DialogContentText>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => handleClick(false)} size='small'>Cancel</Button>
                        <Button onClick={() => handleClick(true)} size='small' autoFocus variant='contained'>
                            Let's do it
                        </Button>
                    </DialogActions>
                </Box>
            </Dialog>
        </div>
    );
}
