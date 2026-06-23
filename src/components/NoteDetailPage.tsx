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
import Stack from '@mui/material/Stack';
import Menu from '@mui/material/Menu';
import Checkbox from '@mui/material/Checkbox';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import DeleteIcon from '@mui/icons-material/Delete';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import ArchiveIcon from '@mui/icons-material/Archive';
import UnarchiveIcon from '@mui/icons-material/Unarchive';
import ShareIcon from '@mui/icons-material/Share';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import PushPinIcon from '@mui/icons-material/PushPin';
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined';
import AddIcon from '@mui/icons-material/Add';
import ChecklistIcon from '@mui/icons-material/Checklist';
import NotesIcon from '@mui/icons-material/Notes';
import MarkdownEditor from './MarkdownEditor';
import { useNoteStore } from '../store/noteStore';
import { useProjectStore } from '../store/projectStore';
import { dialogPaperStyles, useGlobalStore } from '../store/globalStore';
import { useOfflineStore } from '../store/offlineStore';
import { supabase } from '../lib/supabase';
import { ensureSession } from './extras/ensureSession';
import { isSharedItem } from '../lib/sharing';
import { useEntitlement } from '../lib/checkout';
import type { Note, NoteShared, NoteListItem, ProjectShared } from '../types/index';

/** Inline editable text field that only persists on blur (not on every keystroke). */
function ListItemTextField({ value, onSave }: { value: string; onSave: (newValue: string) => void }) {
    const [localValue, setLocalValue] = useState(value);
    const localRef = useRef(localValue);
    localRef.current = localValue;

    // Sync incoming prop changes (e.g. from toggling completion status)
    useEffect(() => {
        setLocalValue(value);
    }, [value]);

    // Save on unmount if changed
    useEffect(() => {
        return () => {
            if (localRef.current !== value) {
                onSave(localRef.current);
            }
        };
    }, [value]);

    return (
        <TextField
            variant="standard"
            fullWidth
            multiline
            value={localValue}
            onChange={(e) => {
                if (e.target.value.length <= 255) {
                    setLocalValue(e.target.value);
                }
            }}
            onBlur={() => {
                if (localValue !== value) {
                    onSave(localValue);
                }
            }}
            inputProps={{ maxLength: 255 }}
            sx={{ '& .MuiInput-input': { py: 0.5 } }}
        />
    );
}

export default function NoteDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const notes = useNoteStore((s) => s.notes);
    const sharedNotes = useNoteStore((s) => s.sharedNotes);
    const archivedNotes = useNoteStore((s) => s.archivedNotes);
    const updateNote = useNoteStore((s) => s.updateNote);
    const togglePinNote = useNoteStore((s) => s.togglePinNote);
    const archiveNote = useNoteStore((s) => s.archiveNote);
    const unarchiveNote = useNoteStore((s) => s.unarchiveNote);
    const deleteNote = useNoteStore((s) => s.deleteNote);
    const shareNote = useNoteStore((s) => s.shareNote);
    const unshareNote = useNoteStore((s) => s.unshareNote);
    const getSharesForNote = useNoteStore((s) => s.getSharesForNote);
    const storeError = useNoteStore((s) => s.error);

    // List item store selectors
    const listItems = useNoteStore((s) => s.listItems);
    const fetchListItems = useNoteStore((s) => s.fetchListItems);
    const addListItem = useNoteStore((s) => s.addListItem);
    const toggleListItem = useNoteStore((s) => s.toggleListItem);
    const updateListItemTitle = useNoteStore((s) => s.updateListItemTitle);
    const deleteListItem = useNoteStore((s) => s.deleteListItem);

    const projects = useProjectStore((s) => s.projects);
    const currentUserID = useGlobalStore((s) => s.currentUser.recordID);
    const isOnline = useOfflineStore((s) => s.isOnline);
    const { subscriptionState, loading: entitlementLoading } = useEntitlement();
    const hasPro = entitlementLoading || subscriptionState !== 'free';

    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [noteType, setNoteType] = useState<'text' | 'list'>('text');
    const [projectID, setProjectID] = useState<string | null>(null);
    const [archived, setArchived] = useState(false);
    const [pinned, setPinned] = useState(false);
    const [creatorID, setCreatorID] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [titleError, setTitleError] = useState<string | null>(null);
    const [bodyError, setBodyError] = useState<string | null>(null);
    const [newItemText, setNewItemText] = useState('');
    const [isShared, setIsShared] = useState(false);
    const [offlineMessage, setOfflineMessage] = useState<string | null>(null);

    // Share management state
    const [shares, setShares] = useState<NoteShared[]>([]);
    const [shareEmail, setShareEmail] = useState('');
    const [shareError, setShareError] = useState<string | null>(null);
    const [shareLoading, setShareLoading] = useState(false);

    // Delete confirmation dialog
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

    // Empty note back-navigation dialog
    const [emptyNoteDialogOpen, setEmptyNoteDialogOpen] = useState(false);

    // Menu state
    const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
    const menuOpen = Boolean(menuAnchorEl);

    // Share dialog state
    const [shareDialogOpen, setShareDialogOpen] = useState(false);

    // Delete completed list items state
    const [completedItemsMenuAnchor, setCompletedItemsMenuAnchor] = useState<null | HTMLElement>(null);
    const [deleteCompletedItemsDialogOpen, setDeleteCompletedItemsDialogOpen] = useState(false);
    const [deletingCompletedItems, setDeletingCompletedItems] = useState(false);

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

            // Read latest store state directly to avoid stale closure from render
            const storeState = useNoteStore.getState();
            const allLocalNotes = [...storeState.notes, ...storeState.sharedNotes, ...storeState.archivedNotes];
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
                        setPinned(localNote.pinned);
                        setCreatorID(localNote.creatorID);
                        setNoteType(localNote.noteType || 'text');
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
                        setPinned(data.pinned);
                        setCreatorID(data.creatorID);
                        setNoteType(data.noteType || 'text');
                    } catch {
                        setError('Failed to load note from server.');
                    }
                } else {
                    setTitle(localNote.title);
                    setBody(localNote.body);
                    setProjectID(localNote.projectID);
                    setArchived(localNote.archived);
                    setPinned(localNote.pinned);
                    setCreatorID(localNote.creatorID);
                    setNoteType(localNote.noteType || 'text');
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
                    setPinned(data.pinned);
                    setCreatorID(data.creatorID);
                    setNoteType(data.noteType || 'text');
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

    // Load list items for list-type notes
    useEffect(() => {
        if (!id || noteType !== 'list') return;
        fetchListItems(id);
    }, [id, noteType, fetchListItems]);

    const currentListItems: NoteListItem[] = id ? (listItems[id] || []) : [];

    // Track pending fields so we can flush on unmount
    const pendingFieldsRef = useRef<Partial<Pick<Note, 'title' | 'body' | 'projectID'>> | null>(null);

    // Auto-save with debounce
    const debouncedSave = useCallback(
        (fields: Partial<Pick<Note, 'title' | 'body' | 'projectID'>>) => {
            if (!id) return;

            if (isShared && !isOnline) {
                setOfflineMessage('Shared items require an internet connection.');
                return;
            }

            // Merge with any existing pending fields so we don't lose earlier changes
            pendingFieldsRef.current = { ...pendingFieldsRef.current, ...fields };

            if (saveTimerRef.current) {
                clearTimeout(saveTimerRef.current);
            }

            saveTimerRef.current = setTimeout(async () => {
                const fieldsToSave = pendingFieldsRef.current;
                pendingFieldsRef.current = null;
                if (!fieldsToSave) return;

                const success = await updateNote(id, fieldsToSave);
                if (!success) {
                    setError(useNoteStore.getState().error || 'Failed to save note.');
                } else {
                    setError(null);
                }
            }, 1200);
        },
        [id, updateNote, isShared, isOnline]
    );

    // Flush any pending save immediately (used on unmount and back-navigation)
    const flushPendingSave = useCallback(() => {
        if (saveTimerRef.current) {
            clearTimeout(saveTimerRef.current);
            saveTimerRef.current = null;
        }
        const fieldsToSave = pendingFieldsRef.current;
        pendingFieldsRef.current = null;
        if (fieldsToSave && id) {
            // Fire the save — don't await since we may be unmounting
            updateNote(id, fieldsToSave);
        }
    }, [id, updateNote]);

    // Flush pending save on unmount so data is never lost
    useEffect(() => {
        return () => {
            flushPendingSave();
        };
    }, [flushPendingSave]);

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

    const handleTogglePin = async () => {
        if (!id) return;
        const success = await togglePinNote(id);
        if (success) {
            setPinned(!pinned);
        } else {
            setError(useNoteStore.getState().error || 'Failed to update pin status.');
        }
    };

    const handleToggleNoteType = async () => {
        if (!id) return;
        const newType: 'text' | 'list' = noteType === 'text' ? 'list' : 'text';

        // Use the store's updateNote which handles offline sync properly
        const success = await updateNote(id, { noteType: newType });
        if (!success) {
            setError('Failed to change note type.');
            return;
        }

        setNoteType(newType);

        if (newType === 'list') {
            fetchListItems(id);
        }
    };

    const handleDelete = async () => {
        if (!id) return;
        setDeleteDialogOpen(false);
        const success = await deleteNote(id);
        if (success) {
            navigate(-1);
        } else {
            setError(useNoteStore.getState().error || 'Failed to delete note.');
        }
    };

    const handleBack = () => {
        // Flush any pending debounced save so data isn't lost
        flushPendingSave();

        if (!title.trim() && !body.trim() && (noteType !== 'list' || currentListItems.length === 0)) {
            setEmptyNoteDialogOpen(true);
        } else {
            navigate(-1);
        }
    };

    const handleDeleteEmptyNote = async () => {
        if (!id) return;
        setEmptyNoteDialogOpen(false);
        const success = await deleteNote(id);
        if (success) {
            navigate(-1);
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

    // ─── List Item Handlers ─────────────────────────────────────────────

    const handleAddListItem = async () => {
        if (!id || !newItemText.trim()) return;
        const item = await addListItem(id, newItemText.trim());
        if (item) {
            setNewItemText('');
        } else {
            setError(useNoteStore.getState().error || 'Failed to add item.');
        }
    };

    const handleToggleListItem = async (itemID: string) => {
        await toggleListItem(itemID);
    };

    const handleDeleteListItem = async (itemID: string) => {
        await deleteListItem(itemID);
    };

    const handleDeleteAllCompletedItems = async () => {
        setDeleteCompletedItemsDialogOpen(false);
        setDeletingCompletedItems(true);
        const completedItems = currentListItems.filter((i) => i.isCompleted);
        for (const item of completedItems) {
            await deleteListItem(item.recordID);
        }
        setDeletingCompletedItems(false);
    };

    const handleListItemTitleSave = (itemID: string, newTitle: string) => {
        updateListItemTitle(itemID, newTitle);
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
                <IconButton onClick={handleBack} sx={{ mb: 1 }}>
                    <ArrowBackIcon />
                </IconButton>
                <Alert severity="error">{error}</Alert>
            </Box>
        );
    }

    return (
        <Box sx={{ maxWidth: 600, mx: 'auto', display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 120px)' }}>
            {/* Header with back button and menu */}
            <Box display="flex" alignItems="flex-start" justifyContent="space-between" sx={{ mb: 2 }}>
                <IconButton onClick={handleBack} aria-label="Back to notes">
                    <ArrowBackIcon />
                </IconButton>
                {/* Project assignment */}
                <FormControl fullWidth size="small">
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
                <IconButton
                    onClick={(e) => setMenuAnchorEl(e.currentTarget)}
                    aria-label="More options"
                    aria-controls={menuOpen ? 'note-actions-menu' : undefined}
                    aria-haspopup="true"
                    aria-expanded={menuOpen ? 'true' : undefined}
                >
                    <MoreVertIcon />
                </IconButton>
                <Menu
                    id="note-actions-menu"
                    anchorEl={menuAnchorEl}
                    open={menuOpen}
                    onClose={() => setMenuAnchorEl(null)}
                >
                    {isCreator && (
                        <MenuItem onClick={() => { setMenuAnchorEl(null); setShareDialogOpen(true); }} disabled={!hasPro}>
                            <ListItemIcon><ShareIcon fontSize="small" /></ListItemIcon>
                            <ListItemText>{hasPro ? 'Share' : 'Share (Pro)'}</ListItemText>
                        </MenuItem>
                    )}
                    {!archived && (
                        <MenuItem onClick={() => { setMenuAnchorEl(null); handleTogglePin(); }}>
                            <ListItemIcon>
                                {pinned ? <PushPinIcon fontSize="small" /> : <PushPinOutlinedIcon fontSize="small" />}
                            </ListItemIcon>
                            <ListItemText>{pinned ? 'Unpin' : 'Pin to top'}</ListItemText>
                        </MenuItem>
                    )}
                    <MenuItem onClick={() => { setMenuAnchorEl(null); handleToggleNoteType(); }}>
                        <ListItemIcon>
                            {noteType === 'text' ? <ChecklistIcon fontSize="small" /> : <NotesIcon fontSize="small" />}
                        </ListItemIcon>
                        <ListItemText>{noteType === 'text' ? 'Convert to checklist' : 'Convert to text note'}</ListItemText>
                    </MenuItem>
                    <MenuItem onClick={() => { setMenuAnchorEl(null); handleArchive(); }}>
                        <ListItemIcon>
                            {archived ? <UnarchiveIcon fontSize="small" /> : <ArchiveIcon fontSize="small" />}
                        </ListItemIcon>
                        <ListItemText>{archived ? 'Unarchive' : 'Archive'}</ListItemText>
                    </MenuItem>
                    {isCreator && (
                        <MenuItem onClick={() => { setMenuAnchorEl(null); setDeleteDialogOpen(true); }}>
                            <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
                            <ListItemText sx={{ color: 'error.main' }}>Delete</ListItemText>
                        </MenuItem>
                    )}
                </Menu>
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

            {/* Markdown live-preview editor (text notes only) */}
            {noteType !== 'list' && (
                <Box sx={{
                    border: { xs: 'none', sm: '1px solid' },
                    borderColor: 'divider',
                    borderRadius: { xs: 0, sm: 1 },
                    mb: 2,
                    mx: { xs: -2, sm: 0 },
                    display: 'flex',
                    flexDirection: 'column',
                    flex: 1,
                    overflow: 'hidden',
                }}>
                    <MarkdownEditor
                        value={body}
                        onChange={(newBody) => {
                            if (newBody.length > 100000) {
                                setBodyError('Body must not exceed 100,000 characters');
                                return;
                            }
                            setBodyError(null);
                            setBody(newBody);
                            debouncedSave({ body: newBody });
                        }}
                        placeholder="Write your note in markdown..."
                        disabled={!!offlineMessage && isShared}
                    />
                    {bodyError && (
                        <Typography variant="caption" color="error" sx={{ px: 2, py: 0.5 }}>
                            {bodyError}
                        </Typography>
                    )}
                </Box>
            )}

            {/* Checklist editor (list notes only) */}
            {noteType === 'list' && (
                <Box sx={{ mb: 2 }}>
                    <List dense disablePadding>
                        {currentListItems.filter((i) => !i.isCompleted).map((item) => (
                            <ListItem
                                key={item.recordID}
                                disablePadding
                                secondaryAction={
                                    <IconButton
                                        edge="end"
                                        size="small"
                                        onClick={() => handleDeleteListItem(item.recordID)}
                                        aria-label="Delete item"
                                    >
                                        <DeleteIcon fontSize="small" />
                                    </IconButton>
                                }
                                sx={{ pr: 5, alignItems: 'flex-start' }}
                            >
                                <ListItemIcon sx={{ minWidth: 36, mt: 0.5 }}>
                                    <Checkbox
                                        edge="start"
                                        checked={false}
                                        onChange={() => handleToggleListItem(item.recordID)}
                                        size="small"
                                    />
                                </ListItemIcon>
                                <ListItemTextField
                                    value={item.title}
                                    onSave={(newTitle) => handleListItemTitleSave(item.recordID, newTitle)}
                                />
                            </ListItem>
                        ))}
                    </List>

                    {/* Add new item input */}
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mt: 1, pl: 1 }}>
                        <IconButton size="small" color="primary" onClick={handleAddListItem} aria-label="Add item" sx={{ mt: 0.5 }}>
                            <AddIcon fontSize="small" />
                        </IconButton>
                        <TextField
                            variant="standard"
                            fullWidth
                            multiline
                            placeholder="Add item..."
                            value={newItemText}
                            onChange={(e) => setNewItemText(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleAddListItem();
                                }
                            }}
                            inputProps={{ maxLength: 255 }}
                            sx={{ '& .MuiInput-input': { py: 0.5 } }}
                        />
                    </Box>

                    {/* Completed items */}
                    {currentListItems.filter((i) => i.isCompleted).length > 0 && (
                        <>
                            <Divider sx={{ my: 1.5 }} />
                            <Box sx={{ display: 'flex', alignItems: 'center', px: 1 }}>
                                <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
                                    Completed ({currentListItems.filter((i) => i.isCompleted).length})
                                </Typography>
                                <IconButton
                                    size="small"
                                    onClick={(e) => setCompletedItemsMenuAnchor(e.currentTarget)}
                                    aria-label="Completed items options"
                                >
                                    <MoreVertIcon fontSize="small" />
                                </IconButton>
                                <Menu
                                    anchorEl={completedItemsMenuAnchor}
                                    open={Boolean(completedItemsMenuAnchor)}
                                    onClose={() => setCompletedItemsMenuAnchor(null)}
                                >
                                    <MenuItem
                                        onClick={() => {
                                            setCompletedItemsMenuAnchor(null);
                                            setDeleteCompletedItemsDialogOpen(true);
                                        }}
                                    >
                                        <ListItemIcon><DeleteSweepIcon fontSize="small" color="error" /></ListItemIcon>
                                        <ListItemText sx={{ color: 'error.main' }}>Delete all completed</ListItemText>
                                    </MenuItem>
                                </Menu>
                            </Box>
                            <List dense disablePadding>
                                {currentListItems.filter((i) => i.isCompleted).map((item) => (
                                    <ListItem
                                        key={item.recordID}
                                        disablePadding
                                        secondaryAction={
                                            <IconButton
                                                edge="end"
                                                size="small"
                                                onClick={() => handleDeleteListItem(item.recordID)}
                                                aria-label="Delete item"
                                            >
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        }
                                        sx={{ pr: 5, alignItems: 'flex-start' }}
                                    >
                                        <ListItemIcon sx={{ minWidth: 36, mt: 0.5 }}>
                                            <Checkbox
                                                edge="start"
                                                checked={true}
                                                onChange={() => handleToggleListItem(item.recordID)}
                                                size="small"
                                            />
                                        </ListItemIcon>
                                        <Typography
                                            variant="body2"
                                            sx={{
                                                textDecoration: 'line-through',
                                                color: 'text.secondary',
                                                flex: 1,
                                                py: 0.5,
                                                whiteSpace: 'pre-wrap',
                                                wordBreak: 'break-word',
                                            }}
                                        >
                                            {item.title}
                                        </Typography>
                                    </ListItem>
                                ))}
                            </List>
                        </>
                    )}
                </Box>
            )}


            {/* Share dialog — creator only */}
            {isCreator && (
                <Dialog open={shareDialogOpen} onClose={() => setShareDialogOpen(false)} fullWidth maxWidth="sm" slotProps={{ paper: dialogPaperStyles }}>
                    <Box sx={{ bgcolor: 'background.paper', height: '100%' }}>
                        <DialogTitle>Share Note</DialogTitle>
                        <DialogContent>
                            {shareError && <Alert severity="error" sx={{ mb: 2 }}>{shareError}</Alert>}

                            <Box display="flex" gap={1} sx={{ mt: 1, mb: 2 }}>
                                <TextField
                                    size="small"
                                    placeholder="Paste User ID to share"
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
                        </DialogContent>
                        <DialogActions>
                            <Button onClick={() => setShareDialogOpen(false)}>Done</Button>
                        </DialogActions>
                    </Box>
                </Dialog>
            )}

            {/* Delete confirmation dialog */}
            <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} slotProps={{ paper: dialogPaperStyles }}>
                <Box sx={{ bgcolor: 'background.paper', height: '100%' }}>
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
                </Box>
            </Dialog>

            {/* Empty note dialog */}
            <Dialog open={emptyNoteDialogOpen} onClose={() => setEmptyNoteDialogOpen(false)} slotProps={{ paper: dialogPaperStyles }}>
                <Box sx={{ bgcolor: 'background.paper', height: '100%' }}>
                    <DialogTitle>Delete empty note?</DialogTitle>
                    <DialogContent>
                        <DialogContentText>
                            This note has no title or content. Would you like to delete it?
                        </DialogContentText>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => { setEmptyNoteDialogOpen(false); navigate(-1); }}>
                            Keep
                        </Button>
                        <Button onClick={handleDeleteEmptyNote} color="error" variant="contained">
                            Delete
                        </Button>
                    </DialogActions>
                </Box>
            </Dialog>

            {/* Delete all completed list items dialog */}
            <Dialog open={deleteCompletedItemsDialogOpen} onClose={() => setDeleteCompletedItemsDialogOpen(false)}>
                <DialogTitle>Delete Completed Items</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Are you sure you want to delete {currentListItems.filter((i) => i.isCompleted).length} completed item{currentListItems.filter((i) => i.isCompleted).length !== 1 ? 's' : ''}? This cannot be undone.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteCompletedItemsDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleDeleteAllCompletedItems} color="error" variant="contained" disabled={deletingCompletedItems}>
                        {deletingCompletedItems ? 'Deleting…' : 'Delete All'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
