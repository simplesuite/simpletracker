import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Stack from '@mui/material/Stack';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteIcon from '@mui/icons-material/Delete';
import ArchiveIcon from '@mui/icons-material/Archive';
import UnarchiveIcon from '@mui/icons-material/Unarchive';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useNoteStore } from '../store/noteStore';
import { useProjectStore } from '../store/projectStore';
import { useGlobalStore } from '../store/globalStore';
import { useOfflineStore } from '../store/offlineStore';
import { supabase } from '../lib/supabase';
import { ensureSession } from './extras/ensureSession';
import { isSharedItem } from '../lib/sharing';
import type { Note, NoteShared, ProjectShared } from '../types/index';

export default function NoteDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const notes = useNoteStore((s) => s.notes);
    const sharedNotes = useNoteStore((s) => s.sharedNotes);
    const archivedNotes = useNoteStore((s) => s.archivedNotes);
    const updateNote = useNoteStore((s) => s.updateNote);
    const archiveNote = useNoteStore((s) => s.archiveNote);
    const unarchiveNote = useNoteStore((s) => s.unarchiveNote);
    const deleteNote = useNoteStore((s) => s.deleteNote);
    const shareNote = useNoteStore((s) => s.shareNote);
    const unshareNote = useNoteStore((s) => s.unshareNote);
    const getSharesForNote = useNoteStore((s) => s.getSharesForNote);
    const storeError = useNoteStore((s) => s.error);

    const projects = useProjectStore((s) => s.projects);
    const currentUserID = useGlobalStore((s) => s.currentUser.recordID);
    const isOnline = useOfflineStore((s) => s.isOnline);

    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [projectID, setProjectID] = useState<string | null>(null);
    const [archived, setArchived] = useState(false);
    const [creatorID, setCreatorID] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [titleError, setTitleError] = useState<string | null>(null);
    const [bodyError, setBodyError] = useState<string | null>(null);
    const [tabIndex, setTabIndex] = useState(0);
    const [isShared, setIsShared] = useState(false);
    const [offlineMessage, setOfflineMessage] = useState<string | null>(null);

    // Share management state
    const [shares, setShares] = useState<NoteShared[]>([]);
    const [shareEmail, setShareEmail] = useState('');
    const [shareError, setShareError] = useState<string | null>(null);
    const [shareLoading, setShareLoading] = useState(false);

    // Delete confirmation dialog
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

    // Debounce timer ref
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const isCreator = creatorID === currentUserID;

    // Find note from local state or fetch from server
    useEffect(() => {
        if (!id) return;

        const loadNote = async () => {
            setLoading(true);
            setError(null);
            setOfflineMessage(null);

            // Try to find in local state first
            const allLocalNotes = [...notes, ...sharedNotes, ...archivedNotes];
            const localNote = allLocalNotes.find((n) => n.recordID === id);

            if (localNote) {
                // Check if this is a shared item
                const shared = localNote.creatorID !== currentUserID;
                setIsShared(shared);

                if (shared) {
                    // Shared items: must fetch from server
                    if (!isOnline) {
                        setOfflineMessage('Shared items require an internet connection.');
                        setTitle(localNote.title);
                        setBody(localNote.body);
                        setProjectID(localNote.projectID);
                        setArchived(localNote.archived);
                        setCreatorID(localNote.creatorID);
                        setLoading(false);
                        return;
                    }

                    try {
                        await ensureSession();
                        const { data, error: fetchError } = await supabase
                            .from('notes')
                            .select('*')
                            .eq('recordID', id)
                            .single();

                        if (fetchError || !data) {
                            setError('Failed to load note from server.');
                            setLoading(false);
                            return;
                        }

                        setTitle(data.title);
                        setBody(data.body);
                        setProjectID(data.projectID);
                        setArchived(data.archived);
                        setCreatorID(data.creatorID);
                    } catch {
                        setError('Failed to load note from server.');
                    }
                } else {
                    setTitle(localNote.title);
                    setBody(localNote.body);
                    setProjectID(localNote.projectID);
                    setArchived(localNote.archived);
                    setCreatorID(localNote.creatorID);
                }
            } else {
                // Not in local state — try fetching from server
                if (!isOnline) {
                    setError('Note not found. You may be offline.');
                    setLoading(false);
                    return;
                }

                try {
                    await ensureSession();
                    const { data, error: fetchError } = await supabase
                        .from('notes')
                        .select('*')
                        .eq('recordID', id)
                        .single();

                    if (fetchError || !data) {
                        setError('Note not found.');
                        setLoading(false);
                        return;
                    }

                    const shared = data.creatorID !== currentUserID;
                    setIsShared(shared);
                    setTitle(data.title);
                    setBody(data.body);
                    setProjectID(data.projectID);
                    setArchived(data.archived);
                    setCreatorID(data.creatorID);
                } catch {
                    setError('Failed to load note.');
                }
            }

            setLoading(false);
        };

        loadNote();
    }, [id, currentUserID, isOnline]);

    // Load shares for creator
    useEffect(() => {
        if (!id || !isCreator) return;

        const loadShares = async () => {
            const noteShares = await getSharesForNote(id);
            setShares(noteShares);
        };

        loadShares();
    }, [id, isCreator, getSharesForNote]);

    // Auto-save with debounce
    const debouncedSave = useCallback(
        (fields: Partial<Pick<Note, 'title' | 'body' | 'projectID'>>) => {
            if (!id) return;

            if (isShared && !isOnline) {
                setOfflineMessage('Shared items require an internet connection.');
                return;
            }

            if (saveTimerRef.current) {
                clearTimeout(saveTimerRef.current);
            }

            saveTimerRef.current = setTimeout(async () => {
                const success = await updateNote(id, fields);
                if (!success) {
                    setError(useNoteStore.getState().error || 'Failed to save note.');
                } else {
                    setError(null);
                }
            }, 800);
        },
        [id, updateNote, isShared, isOnline]
    );

    // Cleanup debounce timer on unmount
    useEffect(() => {
        return () => {
            if (saveTimerRef.current) {
                clearTimeout(saveTimerRef.current);
            }
        };
    }, []);

    const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newTitle = e.target.value;
        if (newTitle.length > 255) {
            setTitleError('Title must not exceed 255 characters');
            return;
        }
        setTitleError(null);
        setTitle(newTitle);
        debouncedSave({ title: newTitle });
    };

    const handleBodyChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newBody = e.target.value;
        if (newBody.length > 100000) {
            setBodyError('Body must not exceed 100,000 characters');
            return;
        }
        setBodyError(null);
        setBody(newBody);
        debouncedSave({ body: newBody });
    };

    const handleProjectChange = (newProjectID: string) => {
        const value = newProjectID === '' ? null : newProjectID;
        setProjectID(value);
        debouncedSave({ projectID: value });
    };

    const handleArchive = async () => {
        if (!id) return;
        const success = archived ? await unarchiveNote(id) : await archiveNote(id);
        if (success) {
            setArchived(!archived);
        } else {
            setError(useNoteStore.getState().error || 'Failed to update archive status.');
        }
    };

    const handleDelete = async () => {
        if (!id) return;
        setDeleteDialogOpen(false);
        const success = await deleteNote(id);
        if (success) {
            navigate('/notes');
        } else {
            setError(useNoteStore.getState().error || 'Failed to delete note.');
        }
    };

    const handleShare = async () => {
        if (!id || !shareEmail.trim()) return;
        setShareLoading(true);
        setShareError(null);

        const success = await shareNote(id, shareEmail.trim());
        if (success) {
            setShareEmail('');
            // Reload shares
            const updatedShares = await getSharesForNote(id);
            setShares(updatedShares);
            setIsShared(true);
        } else {
            setShareError(useNoteStore.getState().error || 'Failed to share note.');
        }
        setShareLoading(false);
    };

    const handleUnshare = async (sharedToID: string) => {
        if (!id) return;
        const success = await unshareNote(id, sharedToID);
        if (success) {
            const updatedShares = await getSharesForNote(id);
            setShares(updatedShares);
            if (updatedShares.length === 0) {
                setIsShared(false);
            }
        } else {
            setShareError(useNoteStore.getState().error || 'Failed to remove share.');
        }
    };

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="40vh">
                <CircularProgress />
            </Box>
        );
    }

    if (error && !title && !body) {
        return (
            <Box sx={{ p: 2 }}>
                <IconButton onClick={() => navigate('/notes')} sx={{ mb: 1 }}>
                    <ArrowBackIcon />
                </IconButton>
                <Alert severity="error">{error}</Alert>
            </Box>
        );
    }

    return (
        <Box sx={{ pb: 4 }}>
            {/* Header with back button and actions */}
            <Box display="flex" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                <IconButton onClick={() => navigate('/notes')} aria-label="Back to notes">
                    <ArrowBackIcon />
                </IconButton>
                <Stack direction="row" spacing={1}>
                    <IconButton onClick={handleArchive} aria-label={archived ? 'Unarchive' : 'Archive'}>
                        {archived ? <UnarchiveIcon /> : <ArchiveIcon />}
                    </IconButton>
                    {isCreator && (
                        <IconButton
                            onClick={() => setDeleteDialogOpen(true)}
                            color="error"
                            aria-label="Delete note"
                        >
                            <DeleteIcon />
                        </IconButton>
                    )}
                </Stack>
            </Box>

            {/* Error messages */}
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            {offlineMessage && <Alert severity="warning" sx={{ mb: 2 }}>{offlineMessage}</Alert>}

            {/* Title input */}
            <TextField
                fullWidth
                variant="standard"
                placeholder="Untitled"
                value={title}
                onChange={handleTitleChange}
                error={!!titleError}
                helperText={titleError || `${title.length}/255`}
                disabled={!!offlineMessage && isShared}
                inputProps={{ maxLength: 255 }}
                sx={{ mb: 2, '& .MuiInput-input': { fontSize: '1.5rem', fontWeight: 500 } }}
            />

            {/* Project assignment */}
            <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                <InputLabel id="project-select-label">Project</InputLabel>
                <Select
                    labelId="project-select-label"
                    value={projectID || ''}
                    onChange={(e) => handleProjectChange(e.target.value)}
                    label="Project"
                    disabled={!!offlineMessage && isShared}
                >
                    <MenuItem value="">
                        <em>None</em>
                    </MenuItem>
                    {projects.map((project) => (
                        <MenuItem key={project.recordID} value={project.recordID}>
                            {project.name}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>

            {/* Edit / Preview tabs */}
            <Tabs value={tabIndex} onChange={(_, v) => setTabIndex(v)} sx={{ mb: 2 }}>
                <Tab label="Edit" />
                <Tab label="Preview" />
            </Tabs>

            {tabIndex === 0 && (
                <TextField
                    fullWidth
                    multiline
                    minRows={10}
                    maxRows={30}
                    placeholder="Write your note in markdown..."
                    value={body}
                    onChange={handleBodyChange}
                    error={!!bodyError}
                    helperText={bodyError || `${body.length}/100,000`}
                    disabled={!!offlineMessage && isShared}
                    sx={{ mb: 2 }}
                />
            )}

            {tabIndex === 1 && (
                <Box
                    sx={{
                        p: 2,
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 1,
                        minHeight: 200,
                        mb: 2,
                        '& h1, & h2, & h3, & h4, & h5, & h6': { mt: 2, mb: 1 },
                        '& p': { mb: 1 },
                        '& ul, & ol': { pl: 3 },
                        '& blockquote': {
                            borderLeft: '4px solid',
                            borderColor: 'divider',
                            pl: 2,
                            ml: 0,
                            color: 'text.secondary',
                        },
                        '& code': {
                            bgcolor: 'action.hover',
                            px: 0.5,
                            borderRadius: 0.5,
                            fontFamily: 'monospace',
                        },
                        '& pre': {
                            bgcolor: 'action.hover',
                            p: 2,
                            borderRadius: 1,
                            overflow: 'auto',
                        },
                        '& a': { color: 'primary.main' },
                    }}
                >
                    {body ? (
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
                    ) : (
                        <Typography color="text.secondary" fontStyle="italic">
                            Nothing to preview
                        </Typography>
                    )}
                </Box>
            )}

            <Divider sx={{ my: 3 }} />

            {/* Share management section — creator only */}
            {isCreator && (
                <Box sx={{ mb: 3 }}>
                    <Typography variant="h6" gutterBottom>
                        Sharing
                    </Typography>

                    {shareError && <Alert severity="error" sx={{ mb: 2 }}>{shareError}</Alert>}

                    <Box display="flex" gap={1} sx={{ mb: 2 }}>
                        <TextField
                            size="small"
                            placeholder="Enter email to share"
                            value={shareEmail}
                            onChange={(e) => setShareEmail(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleShare();
                            }}
                            sx={{ flex: 1 }}
                        />
                        <Button
                            variant="contained"
                            size="small"
                            onClick={handleShare}
                            disabled={shareLoading || !shareEmail.trim()}
                        >
                            {shareLoading ? <CircularProgress size={20} /> : 'Share'}
                        </Button>
                    </Box>

                    {shares.length > 0 && (
                        <Box>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                Shared with:
                            </Typography>
                            <Stack spacing={1}>
                                {shares.map((share) => (
                                    <Box
                                        key={share.recordID}
                                        display="flex"
                                        alignItems="center"
                                        justifyContent="space-between"
                                    >
                                        <Chip label={share.sharedToID} size="small" />
                                        <IconButton
                                            size="small"
                                            onClick={() => handleUnshare(share.sharedToID)}
                                            aria-label="Remove share"
                                        >
                                            <PersonRemoveIcon fontSize="small" />
                                        </IconButton>
                                    </Box>
                                ))}
                            </Stack>
                        </Box>
                    )}
                </Box>
            )}

            {/* Delete confirmation dialog */}
            <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
                <DialogTitle>Delete Note</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Are you sure you want to permanently delete this note? This action cannot be undone.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleDelete} color="error" variant="contained">
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
