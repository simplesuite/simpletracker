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
import Tooltip from '@mui/material/Tooltip';
import Switch from '@mui/material/Switch';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import DeleteIcon from '@mui/icons-material/Delete';
import ArchiveIcon from '@mui/icons-material/Archive';
import UnarchiveIcon from '@mui/icons-material/Unarchive';
import ShareIcon from '@mui/icons-material/Share';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import TitleIcon from '@mui/icons-material/Title';
import CodeIcon from '@mui/icons-material/Code';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import LinkIcon from '@mui/icons-material/Link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useNoteStore } from '../store/noteStore';
import { useProjectStore } from '../store/projectStore';
import { dialogPaperStyles, useGlobalStore } from '../store/globalStore';
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
    const [showPreview, setShowPreview] = useState(() => {
        const stored = localStorage.getItem('notePreviewEnabled');
        return stored === null ? true : stored === 'true';
    });
    const handlePreviewToggle = (checked: boolean) => {
        setShowPreview(checked);
        localStorage.setItem('notePreviewEnabled', String(checked));
    };
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

    // Debounce timer ref
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);

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

    // Insert markdown at cursor position
    const insertMarkdown = (prefix: string, suffix: string = '', defaultText: string = '') => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = body.substring(start, end);
        const insertText = selectedText || defaultText;
        const newBody = body.substring(0, start) + prefix + insertText + suffix + body.substring(end);

        if (newBody.length > 100000) {
            setBodyError('Body must not exceed 100,000 characters');
            return;
        }

        setBodyError(null);
        setBody(newBody);
        debouncedSave({ body: newBody });

        // Restore focus and set cursor position after the inserted text
        setTimeout(() => {
            textarea.focus();
            const cursorPos = start + prefix.length + insertText.length + suffix.length;
            textarea.setSelectionRange(
                selectedText ? cursorPos : start + prefix.length,
                selectedText ? cursorPos : start + prefix.length + insertText.length
            );
        }, 0);
    };

    const insertLinePrefix = (prefix: string) => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = body.substring(start, end);

        // If there's a selection spanning multiple lines, prefix each line
        if (selectedText.includes('\n')) {
            const lines = selectedText.split('\n').map(line => prefix + line);
            const newText = lines.join('\n');
            const newBody = body.substring(0, start) + newText + body.substring(end);
            setBody(newBody);
            debouncedSave({ body: newBody });
            setTimeout(() => {
                textarea.focus();
                textarea.setSelectionRange(start, start + newText.length);
            }, 0);
        } else {
            // Find the start of the current line
            const lineStart = body.lastIndexOf('\n', start - 1) + 1;
            const newBody = body.substring(0, lineStart) + prefix + body.substring(lineStart);
            setBody(newBody);
            debouncedSave({ body: newBody });
            setTimeout(() => {
                textarea.focus();
                textarea.setSelectionRange(start + prefix.length, end + prefix.length);
            }, 0);
        }
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
            navigate(-1);
        } else {
            setError(useNoteStore.getState().error || 'Failed to delete note.');
        }
    };

    const handleBack = () => {
        if (!title.trim() && !body.trim()) {
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
        <Box sx={{ pb: 4, maxWidth: 600, mx: 'auto' }}>
            {/* Header with back button and menu */}
            <Box display="flex" alignItems="flex-start" justifyContent="space-between" sx={{ mb: 2 }}>
                <IconButton onClick={handleBack} aria-label="Back to notes">
                    <ArrowBackIcon />
                </IconButton>
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
                        <MenuItem onClick={() => { setMenuAnchorEl(null); setShareDialogOpen(true); }}>
                            <ListItemIcon><ShareIcon fontSize="small" /></ListItemIcon>
                            <ListItemText>Share</ListItemText>
                        </MenuItem>
                    )}
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

            {/* Markdown toolbar + editor + live preview */}
            <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, mb: 2 }}>
                {/* Toolbar */}
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, p: 0.5, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'action.hover', alignItems: 'center' }}>
                    <Tooltip title="Heading">
                        <IconButton size="small" onClick={() => insertLinePrefix('## ')} disabled={!!offlineMessage && isShared}>
                            <TitleIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Bold">
                        <IconButton size="small" onClick={() => insertMarkdown('**', '**', 'bold')} disabled={!!offlineMessage && isShared}>
                            <FormatBoldIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Italic">
                        <IconButton size="small" onClick={() => insertMarkdown('*', '*', 'italic')} disabled={!!offlineMessage && isShared}>
                            <FormatItalicIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Bullet list">
                        <IconButton size="small" onClick={() => insertLinePrefix('- ')} disabled={!!offlineMessage && isShared}>
                            <FormatListBulletedIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Checkbox">
                        <IconButton size="small" onClick={() => insertLinePrefix('- [ ] ')} disabled={!!offlineMessage && isShared}>
                            <CheckBoxIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
                    <Tooltip title="Code">
                        <IconButton size="small" onClick={() => insertMarkdown('`', '`', 'code')} disabled={!!offlineMessage && isShared}>
                            <CodeIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Quote">
                        <IconButton size="small" onClick={() => insertLinePrefix('> ')} disabled={!!offlineMessage && isShared}>
                            <FormatQuoteIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Link">
                        <IconButton size="small" onClick={() => insertMarkdown('[', '](url)', 'link text')} disabled={!!offlineMessage && isShared}>
                            <LinkIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Box sx={{ flex: 1 }} />
                    <Tooltip title={showPreview ? 'Hide preview' : 'Show preview'}>
                        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mr: 0.5 }}>
                            <Typography variant="caption" color="text.secondary">Preview</Typography>
                            <Switch size="small" checked={showPreview} onChange={(e) => handlePreviewToggle(e.target.checked)} />
                        </Stack>
                    </Tooltip>
                </Box>

                {/* Textarea */}
                <TextField
                    fullWidth
                    multiline
                    minRows={12}
                    placeholder="Write your note in markdown..."
                    value={body}
                    onChange={handleBodyChange}
                    error={!!bodyError}
                    helperText={bodyError || `${body.length}/100,000`}
                    disabled={!!offlineMessage && isShared}
                    inputRef={textareaRef}
                    sx={{
                        '& .MuiOutlinedInput-root': { borderRadius: 0 },
                        '& fieldset': { border: 'none' },
                    }}
                />

                {/* Live preview */}
                {showPreview && body && (
                    <>
                        <Divider />
                        <Box
                            sx={{
                                p: 2,
                                minHeight: 100,
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
                                '& input[type="checkbox"]': { mr: 1 },
                            }}
                        >
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
                        </Box>
                    </>
                )}
            </Box>


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
        </Box>
    );
}
