import * as React from 'react';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import RefreshIcon from '@mui/icons-material/Refresh';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import CloudDoneIcon from '@mui/icons-material/CloudDone';
import SyncIcon from '@mui/icons-material/Sync';
import { keyframes } from '@mui/system';
import { useOfflineStore, useNoteStore, useTaskStore, useProjectStore } from '@simpletracker/core';

const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

/**
 * Connection status + manual refresh, surfaced on the Settings page so the
 * controls that normally live in the top AppBar remain reachable when the app
 * runs as an installed PWA (where the AppBar is hidden).
 */
export default function ConnectionCard() {
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

    const renderStatusChip = () => {
        if (!isOnline) {
            const label = pendingCount > 0 ? `Offline · ${pendingCount} pending` : 'Offline';
            return (
                <Chip
                    icon={<CloudOffIcon />}
                    label={label}
                    size="small"
                    color="warning"
                    variant="outlined"
                    aria-label={label}
                />
            );
        }
        if (isSyncing) {
            const label = `Syncing${pendingCount > 0 ? ` ${pendingCount}` : ''}...`;
            return (
                <Chip
                    icon={<SyncIcon sx={{ animation: `${spin} 1s linear infinite` }} />}
                    label={label}
                    size="small"
                    color="info"
                    variant="outlined"
                    aria-label={label}
                />
            );
        }
        if (pendingCount > 0) {
            return (
                <Chip
                    icon={<SyncIcon fontSize="small" />}
                    label={lastSyncError || `${pendingCount} pending`}
                    size="small"
                    color={lastSyncError ? 'error' : 'warning'}
                    variant="outlined"
                    sx={{ maxWidth: 260 }}
                    aria-label={lastSyncError || `${pendingCount} pending mutations`}
                />
            );
        }
        return (
            <Chip
                icon={<CloudDoneIcon />}
                label="Online"
                size="small"
                color="success"
                variant="outlined"
                aria-label="Online"
            />
        );
    };

    return (
        <Paper elevation={4} sx={{ borderRadius: "20px", p: 3 }}>
            <Typography color="text.secondary" variant="subtitle2" sx={{ fontWeight: 800, mb: 2.5, textTransform: 'uppercase' }}>
                Connection
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5 }}>
                {renderStatusChip()}
                <Button
                    variant="outlined"
                    color="primary"
                    startIcon={<RefreshIcon sx={refreshing ? { animation: `${spin} 1s linear infinite` } : undefined} />}
                    onClick={handleRefresh}
                    disabled={refreshing}
                    sx={{ textTransform: 'none', borderRadius: 2 }}
                >
                    Refresh
                </Button>
            </Box>
        </Paper>
    );
}
