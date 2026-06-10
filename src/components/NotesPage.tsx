import React from 'react';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import Fab from '@mui/material/Fab';
import AddIcon from '@mui/icons-material/Add';
import Chip from '@mui/material/Chip';
import PeopleIcon from '@mui/icons-material/People';
import FolderIcon from '@mui/icons-material/Folder';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import PushPinIcon from '@mui/icons-material/PushPin';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ChecklistIcon from '@mui/icons-material/Checklist';
import CircularProgress from '@mui/material/CircularProgress';
import Collapse from '@mui/material/Collapse';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import { useNavigate } from 'react-router-dom';
import { useNoteStore } from '../store/noteStore';
import { useProjectStore } from '../store/projectStore';
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
    const projects = useProjectStore((s) => s.projects);

    const [searchQuery, setSearchQuery] = React.useState('');
    const [archivedExpanded, setArchivedExpanded] = React.useState(false);

    // Build a map of projectID -> project name for quick lookup
    const projectNameMap = React.useMemo(() => {
        const map = new Map<string, string>();
        for (const p of projects) {
            map.set(p.recordID, p.name);
        }
        return map;
    }, [projects]);

    React.useEffect(() => {
        fetchNotes();
        fetchArchivedNotes();
    }, [fetchNotes, fetchArchivedNotes]);

    const handleCreateNote = async () => {
        const newNote = await createNote();
        if (newNote) {
            navigate(`/notes/${newNote.recordID}`);
        }
    };

    // Combine own notes and shared notes for the active view, sorted by pinned first then updatedAt desc
    const activeNotes: Note[] = React.useMemo(() => {
        const combined = [...notes, ...sharedNotes];
        // Deduplicate by recordID (in case of overlap)
        const map = new Map<string, Note>();
        for (const note of combined) {
            map.set(note.recordID, note);
        }
        return Array.from(map.values()).sort((a, b) => {
            // Pinned notes come first
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            // Then sort by updatedAt desc
            return b.updatedAt - a.updatedAt;
        });
    }, [notes, sharedNotes]);

    // Filter active notes by search query (title and body)
    const filteredActiveNotes = React.useMemo(() => {
        if (!searchQuery.trim()) return activeNotes;
        const q = searchQuery.toLowerCase();
        return activeNotes.filter(
            (n) => n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q)
        );
    }, [activeNotes, searchQuery]);

    // Filter archived notes by search query
    const filteredArchivedNotes = React.useMemo(() => {
        if (!searchQuery.trim()) return archivedNotes;
        const q = searchQuery.toLowerCase();
        return archivedNotes.filter(
            (n) => n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q)
        );
    }, [archivedNotes, searchQuery]);

    const isSharedNote = (note: Note): boolean => {
        return note.creatorID !== currentUserID;
    };

    const renderNoteGrid = (noteList: Note[]) => (
        <Box
            sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 1.5,
            }}
        >
            {noteList.map((note) => (
                <Card
                    key={note.recordID}
                    variant="outlined"
                    sx={{
                        borderColor: note.pinned ? 'primary.main' : 'divider',
                        borderRadius: 3,
                    }}
                >
                    <CardActionArea
                        onClick={() => navigate(`/notes/${note.recordID}`)}
                        sx={{ height: '100%' }}
                    >
                        <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                                {note.pinned && (
                                    <PushPinIcon color="primary" sx={{ fontSize: 14 }} />
                                )}
                                {note.noteType === 'list' && (
                                    <ChecklistIcon color="action" sx={{ fontSize: 14 }} />
                                )}
                                <Typography
                                    variant="subtitle2"
                                    noWrap
                                    sx={{
                                        flex: 1,
                                        fontStyle: note.title ? 'normal' : 'italic',
                                        color: note.title ? 'text.primary' : 'text.secondary',
                                    }}
                                >
                                    {note.title || 'Untitled'}
                                </Typography>
                            </Box>
                            {note.body && (
                                <Typography
                                    variant="body2"
                                    color="text.secondary"
                                    sx={{
                                        display: '-webkit-box',
                                        WebkitLineClamp: 1,
                                        WebkitBoxOrient: 'vertical',
                                        overflow: 'hidden',
                                        mb: 0.5,
                                        fontSize: '0.75rem',
                                    }}
                                >
                                    {note.body}
                                </Typography>
                            )}
                            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexWrap: 'wrap', mt: 'auto' }}>
                                <Typography variant="caption" color="text.secondary">
                                    {formatTimestamp(note.updatedAt)}
                                </Typography>
                                {isSharedNote(note) && (
                                    <Chip
                                        icon={<PeopleIcon />}
                                        label="Shared"
                                        size="small"
                                        variant="outlined"
                                        color="primary"
                                        sx={{ height: 18, fontSize: '0.65rem' }}
                                    />
                                )}
                                {note.projectID && projectNameMap.has(note.projectID) && (
                                    <Chip
                                        label={projectNameMap.get(note.projectID)}
                                        size="small"
                                        variant="outlined"
                                        sx={{ height: 18, fontSize: '0.65rem' }}
                                    />
                                )}
                            </Box>
                        </CardContent>
                    </CardActionArea>
                </Card>
            ))}
        </Box>
    );

    return (
        <Box sx={{ maxWidth: 600, mx: 'auto' }}>
            <TextField
                size="small"
                placeholder="Search notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                fullWidth
                sx={{ mb: 2 }}
                slotProps={{
                    input: {
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon fontSize="small" color="action" />
                            </InputAdornment>
                        ),
                        endAdornment: searchQuery ? (
                            <InputAdornment position="end">
                                <IconButton size="small" onClick={() => setSearchQuery('')} aria-label="Clear search">
                                    <ClearIcon fontSize="small" />
                                </IconButton>
                            </InputAdornment>
                        ) : null,
                    },
                }}
            />

            {loading && filteredActiveNotes.length === 0 ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                    <CircularProgress />
                </Box>
            ) : filteredActiveNotes.length === 0 && filteredArchivedNotes.length === 0 ? (
                <Typography variant="body1" color="text.secondary" sx={{ mt: 2 }}>
                    {searchQuery.trim()
                        ? 'No notes match your search.'
                        : 'No notes yet. Tap + to create one.'}
                </Typography>
            ) : (
                <>
                    {filteredActiveNotes.length > 0 && renderNoteGrid(filteredActiveNotes)}

                    {filteredArchivedNotes.length > 0 && (
                        <>
                            <Box
                                onClick={() => setArchivedExpanded(!archivedExpanded)}
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    cursor: 'pointer',
                                    mt: filteredActiveNotes.length > 0 ? 2 : 0,
                                    mb: 1,
                                    px: 1,
                                    py: 0.5,
                                    borderRadius: 1,
                                    '&:hover': { bgcolor: 'action.hover' },
                                }}
                            >
                                {archivedExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                                <Typography variant="body2" color="text.secondary" sx={{ ml: 0.5 }}>
                                    Archived ({filteredArchivedNotes.length})
                                </Typography>
                            </Box>
                            <Collapse in={archivedExpanded}>
                                {renderNoteGrid(filteredArchivedNotes)}
                            </Collapse>
                        </>
                    )}
                </>
            )}

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
        </Box>
    );
}
