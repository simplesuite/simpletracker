import * as React from 'react';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import AppBar from '@mui/material/AppBar';
import logo from '../../logo.png'
import { useGlobalStore } from "../../store/globalStore";
import IconButton from "@mui/material/IconButton";
import RefreshIcon from '@mui/icons-material/Refresh';
import Chip from '@mui/material/Chip';
import Badge from '@mui/material/Badge';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import SyncIcon from '@mui/icons-material/Sync';
import { useOfflineStore } from "../../store/offlineStore";
import { useNoteStore } from "../../store/noteStore";
import { useTaskStore } from "../../store/taskStore";
import { useProjectStore } from "../../store/projectStore";
import { keyframes } from '@mui/system';

const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

export default function AppToolbar() {
    const currentTheme = useGlobalStore(s => s.themeAtom);
    const isOnline = useOfflineStore(s => s.isOnline);
    const pendingCount = useOfflineStore(s => s.pendingCount);
    const isSyncing = useOfflineStore(s => s.isSyncing);
    const lastSyncError = useOfflineStore(s => s.lastSyncError);
    const [refreshing, setRefreshing] = React.useState(false);

    async function handleRefresh() {
        setRefreshing(true);
        try {
            await Promise.all([
                useNoteStore.getState().fetchNotes(),
                useNoteStore.getState().fetchArchivedNotes(),
                useTaskStore.getState().fetchTasks(),
                useProjectStore.getState().fetchProjects(),
            ]);
        } catch (err) {
            console.warn('Refresh failed:', err);
        }
        setRefreshing(false);
    }

    const renderConnectivityIndicator = () => {
        // Offline state: show offline chip with pending count if any
        if (!isOnline) {
            const label = pendingCount > 0 ? `Offline · ${pendingCount} pending` : 'Offline';
            return (
                <Chip
                    icon={<CloudOffIcon />}
                    label={label}
                    size="small"
                    color="warning"
                    variant="outlined"
                    sx={{ mr: 1 }}
                    aria-label={label}
                />
            );
        }

        // Online and syncing: show syncing chip with animation and pending count
        if (isSyncing) {
            const label = `Syncing${pendingCount > 0 ? ` ${pendingCount}` : ''}...`;
            return (
                <Chip
                    icon={
                        <SyncIcon
                            sx={{ animation: `${spin} 1s linear infinite` }}
                        />
                    }
                    label={label}
                    size="small"
                    color="info"
                    variant="outlined"
                    sx={{ mr: 1 }}
                    aria-label={label}
                />
            );
        }

        // Online with pending mutations (not yet syncing): show pending badge
        if (pendingCount > 0) {
            return (
                <Chip
                    icon={<SyncIcon fontSize="small" />}
                    label={lastSyncError || `${pendingCount} pending`}
                    size="small"
                    color={lastSyncError ? 'error' : 'warning'}
                    variant="outlined"
                    sx={{ mr: 1, maxWidth: 220 }}
                    aria-label={lastSyncError || `${pendingCount} pending mutations`}
                />
            );
        }

        return null;
    };

    return (
        <>
            <AppBar position="fixed" elevation={0}
                sx={{
                    width: '100%',
                    paddingTop: 'env(safe-area-inset-top, 0px)',
                    backdropFilter: 'blur(5px)',
                    backgroundColor: currentTheme === 'dark'
                        ? 'rgba(18, 18, 18, 0.7)'
                        : 'rgba(255, 255, 255, 0.7)',
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                }}>
                <Toolbar variant='dense' sx={currentTheme === 'dark' ? null : { color: 'primary.main' }}>
                    <img
                        height='30'
                        src={logo}
                        alt='logo'
                    />
                    <Typography variant="h6" sx={{ ml: 1, fontWeight: 100 }}>simple</Typography>
                    <Typography variant="h6" align="left" sx={{ flexGrow: 1 }}>
                        Tracker
                    </Typography>
                    {renderConnectivityIndicator()}
                    <IconButton
                        size='small'
                        onClick={handleRefresh}
                        disabled={refreshing}
                        aria-label="Refresh data"
                    >
                        <RefreshIcon sx={refreshing ? { animation: `${spin} 1s linear infinite` } : undefined} />
                    </IconButton>
                </Toolbar>
            </AppBar>
        </>
    );
}
