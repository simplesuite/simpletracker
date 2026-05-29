import React from 'react';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Fab from '@mui/material/Fab';
import AddIcon from '@mui/icons-material/Add';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Chip from '@mui/material/Chip';
import PeopleIcon from '@mui/icons-material/People';
import CircularProgress from '@mui/material/CircularProgress';
import { useNavigate } from 'react-router-dom';
import { useNoteStore } from '../store/noteStore';
import { useGlobalStore } from '../store/globalStore';
import type { Note } from '../types/index';

function formatTimestamp(ts: number): string {
    const date = new Date(ts);
    const now = new Date();
    const isToday =
        date.getDate() === now.getDate() &&
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear();

    if (isToday) {
        return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    }

    const isThisYear = date.getFullYear() === now.getFullYear();
    if (isThisYear) {
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }

    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function NotesPage() {
    const navigate = useNavigate();
    const notes = useNoteStore((s) => s.notes);
    const archivedNotes = useNoteStore((s) => s.archivedNotes);
    const sharedNotes = useNoteStore((s) => s.sharedNotes);
    const loading = useNoteStore((s) => s.loading);
    const fetchNotes = useNoteStore((s) => s.fetchNotes);
    const fetchArchivedNotes = useNoteStore((s) => s.fetchArchivedNotes);
    const createNote = useNoteStore((s) => s.createNote);
    const currentUserID = useGlobalStore((s) => s.currentUser.recordID);

    const [tabValue, setTabValue] = React.useState(0);

    React.useEffect(() => {
        fetchNotes();
    }, [fetchNotes]);

    React.useEffect(() => {
        if (tabValue === 1) {
            fetchArchivedNotes();
        }
    }, [tabValue, fetchArchivedNotes]);

    const handleCreateNote = async () => {
        const newNote = await createNote();
        if (newNote) {
            navigate(`/notes/${newNote.recordID}`);
        }
    };

    const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
        setTabValue(newValue);
    };

    // Combine own notes and shared notes for the active view, sorted by updatedAt desc
    const activeNotes: Note[] = React.useMemo(() => {
        const combined = [...notes, ...sharedNotes];
        // Deduplicate by recordID (in case of overlap)
        const map = new Map<string, Note>();
        for (const note of combined) {
            map.set(note.recordID, note);
        }
        return Array.from(map.values()).sort((a, b) => b.updatedAt - a.updatedAt);
    }, [notes, sharedNotes]);

    const displayedNotes = tabValue === 0 ? activeNotes : archivedNotes;

    const isSharedNote = (note: Note): boolean => {
        return note.creatorID !== currentUserID;
    };

    return (
        <Box>
            <Tabs
                value={tabValue}
                onChange={handleTabChange}
                sx={{ mb: 2 }}
                aria-label="Notes view toggle"
            >
                <Tab label="Active" />
                <Tab label="Archived" />
            </Tabs>

            {loading && displayedNotes.length === 0 ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                    <CircularProgress />
                </Box>
            ) : displayedNotes.length === 0 ? (
                <Typography variant="body1" color="text.secondary" sx={{ mt: 2 }}>
                    {tabValue === 0
                        ? 'No notes yet. Tap + to create one.'
                        : 'No archived notes.'}
                </Typography>
            ) : (
                <List disablePadding>
                    {displayedNotes.map((note) => (
                        <ListItem key={note.recordID} disablePadding divider>
                            <ListItemButton
                                onClick={() => navigate(`/notes/${note.recordID}`)}
                            >
                                <ListItemText
                                    primary={
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Typography
                                                variant="body1"
                                                noWrap
                                                sx={{
                                                    fontStyle: note.title ? 'normal' : 'italic',
                                                    color: note.title ? 'text.primary' : 'text.secondary',
                                                }}
                                            >
                                                {note.title || 'Untitled'}
                                            </Typography>
                                            {isSharedNote(note) && (
                                                <Chip
                                                    icon={<PeopleIcon />}
                                                    label="Shared"
                                                    size="small"
                                                    variant="outlined"
                                                    color="primary"
                                                />
                                            )}
                                        </Box>
                                    }
                                    secondary={formatTimestamp(note.updatedAt)}
                                />
                            </ListItemButton>
                        </ListItem>
                    ))}
                </List>
            )}

            {tabValue === 0 && (
                <Fab
                    color="primary"
                    aria-label="Create new note"
                    onClick={handleCreateNote}
                    sx={{
                        position: 'fixed',
                        bottom: 72,
                        right: 16,
                    }}
                >
                    <AddIcon />
                </Fab>
            )}
        </Box>
    );
}
