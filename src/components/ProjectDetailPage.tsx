import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemButton from '@mui/material/ListItemButton';
import Divider from '@mui/material/Divider';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Collapse from '@mui/material/Collapse';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import InputAdornment from '@mui/material/InputAdornment';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import DeleteIcon from '@mui/icons-material/Delete';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import NotesIcon from '@mui/icons-material/Notes';
import ChecklistIcon from '@mui/icons-material/Checklist';
import PushPinIcon from '@mui/icons-material/PushPin';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import ShareIcon from '@mui/icons-material/Share';
import EditIcon from '@mui/icons-material/Edit';
import EditOffIcon from '@mui/icons-material/EditOff';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import AddIcon from '@mui/icons-material/Add';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import RepeatIcon from '@mui/icons-material/Repeat';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import { useProjectStore } from '../store/projectStore';
import { useNoteStore } from '../store/noteStore';
import { useTaskStore } from '../store/taskStore';
import { dialogPaperStyles, useGlobalStore } from '../store/globalStore';
import { validateProjectName } from '../lib/validation';
import { supabase } from '../lib/supabase';
import { useEntitlement } from '../lib/checkout';
import { searchUsers, getRecentlySharedWithUsers } from '../lib/sharing';
import Avatar from '@mui/material/Avatar';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import type { Task, ProjectShared } from '../types/index';

export default function ProjectDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation();

    const projects = useProjectStore((s) => s.projects);
    const loading = useProjectStore((s) => s.loading);
    const fetchProjects = useProjectStore((s) => s.fetchProjects);
    const updateProject = useProjectStore((s) => s.updateProject);
    const deleteProject = useProjectStore((s) => s.deleteProject);
    const shareProject = useProjectStore((s) => s.shareProject);
    const unshareProject = useProjectStore((s) => s.unshareProject);
    const getSharesForProject = useProjectStore((s) => s.getSharesForProject);
    const storeError = useProjectStore((s) => s.error);

    const notes = useNoteStore((s) => s.notes);
    const sharedNotes = useNoteStore((s) => s.sharedNotes);
    const createNote = useNoteStore((s) => s.createNote);
    const listItems = useNoteStore((s) => s.listItems);
    const fetchListItems = useNoteStore((s) => s.fetchListItems);
    const tasks = useTaskStore((s) => s.tasks);
    const createBlankTask = useTaskStore((s) => s.createBlankTask);
    const completeTask = useTaskStore((s) => s.completeTask);
    const reopenTask = useTaskStore((s) => s.reopenTask);
    const deleteTask = useTaskStore((s) => s.deleteTask);
    const currentUserID = useGlobalStore((s) => s.currentUser.recordID);
    const setSnackText = useGlobalStore((s) => s.setSnackBarText);
    const setSnackSev = useGlobalStore((s) => s.setSnackBarSeverity);
    const setSnackOpen = useGlobalStore((s) => s.setSnackBarOpen);

    const project = projects.find((p) => p.recordID === id);
    const isCreator = project?.creatorID === currentUserID;
    const { subscriptionState, loading: entitlementLoading } = useEntitlement();
    const hasPro = entitlementLoading || subscriptionState !== 'free';

    const handleCompleteTask = async (taskId: string) => {
        const task = tasks.find((t) => t.recordID === taskId);
        const success = await completeTask(taskId);
        if (success) {
            setSnackSev('success');
            setSnackText(`"${task?.title || 'Task'}" completed`);
            setSnackOpen(true);
        }
    };

    // Track whether we've attempted to fetch projects
    const [hasFetched, setHasFetched] = useState(false);

    // Fetch projects if the project isn't found in the store (e.g. page refresh)
    useEffect(() => {
        if (!project && !hasFetched) {
            fetchProjects().then(() => setHasFetched(true));
        }
    }, [project, hasFetched, fetchProjects]);

    // Local state
    const [name, setName] = useState(project?.name || '');
    const [description, setDescription] = useState(project?.description || '');
    const [nameError, setNameError] = useState('');
    const [shareEmail, setShareEmail] = useState('');
    const [shares, setShares] = useState<(ProjectShared & { fullName?: string; email?: string })[]>([]);
    const [sharesLoading, setSharesLoading] = useState(false);
    const [searchResults, setSearchResults] = useState<{ recordID: string; fullName: string; email: string }[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [pendingShareUser, setPendingShareUser] = useState<{ recordID: string; fullName: string; email: string } | null>(null);
    const [recentUsers, setRecentUsers] = useState<{ recordID: string; fullName: string; email: string }[]>([]);
    const [error, setError] = useState('');
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
    const menuOpen = Boolean(menuAnchorEl);
    const [shareDialogOpen, setShareDialogOpen] = useState(false);
    const [completedExpanded, setCompletedExpanded] = useState(false);
    const [completedMenuAnchor, setCompletedMenuAnchor] = useState<null | HTMLElement>(null);
    const [deleteCompletedDialogOpen, setDeleteCompletedDialogOpen] = useState(false);
    const [deletingCompleted, setDeletingCompleted] = useState(false);
    const [editing, setEditing] = useState(() => {
        const state = location.state as { editing?: boolean } | null;
        return state?.editing ?? false;
    });
    const [searchQuery, setSearchQuery] = useState('');

    // Sync local state when project changes
    useEffect(() => {
        if (project) {
            setName(project.name);
            setDescription(project.description);
        }
    }, [project?.name, project?.description]);

    // Load shares for this project
    const loadShares = useCallback(async () => {
        if (!id || !isCreator) return;
        setSharesLoading(true);
        const shareRecords = await getSharesForProject(id);
        // Fetch names and emails for each shared user
        const sharesWithNames: (ProjectShared & { fullName?: string; email?: string })[] = [];
        for (const share of shareRecords) {
            const { data } = await supabase
                .from('users')
                .select('fullName, email')
                .eq('recordID', share.sharedToID)
                .single();
            sharesWithNames.push({ ...share, fullName: data?.fullName || share.sharedToID, email: data?.email || '' });
        }
        setShares(sharesWithNames);
        setSharesLoading(false);
    }, [id, isCreator, getSharesForProject]);

    useEffect(() => {
        loadShares();
    }, [loadShares]);

    // Load recently shared-with users when share dialog opens
    useEffect(() => {
        if (!shareDialogOpen || !currentUserID) return;
        getRecentlySharedWithUsers(currentUserID).then(setRecentUsers);
    }, [shareDialogOpen, currentUserID]);

    // Clear error when store error changes
    useEffect(() => {
        if (storeError) {
            setError(storeError);
        }
    }, [storeError]);

    // Filter notes and tasks belonging to this project, pinned notes first
    const projectNotes = useMemo(() => {
        const allNotes = [...notes, ...sharedNotes]
            .filter((n) => n.projectID === id)
            .sort((a, b) => (a.pinned === b.pinned ? 0 : a.pinned ? -1 : 1));
        if (!searchQuery.trim()) return allNotes;
        const q = searchQuery.toLowerCase();
        return allNotes.filter(
            (n) => n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q)
        );
    }, [notes, sharedNotes, id, searchQuery]);

    // Fetch list items for checklist-type notes (for card previews)
    useEffect(() => {
        const listNotes = projectNotes.filter((n) => n.noteType === 'list');
        for (const note of listNotes) {
            if (!listItems[note.recordID]) {
                fetchListItems(note.recordID);
            }
        }
    }, [projectNotes]);

    const projectTasks = useMemo(() => {
        const all = tasks.filter((t) => t.projectID === id);
        if (!searchQuery.trim()) return all;
        const q = searchQuery.toLowerCase();
        return all.filter(
            (t) => t.title.toLowerCase().includes(q) || t.body.toLowerCase().includes(q)
        );
    }, [tasks, id, searchQuery]);

    // Sort tasks: due date ascending (no due date at end), split open vs completed
    const sortByDueDate = (a: Task, b: Task): number => {
        if (a.dueDate != null && b.dueDate != null) return a.dueDate - b.dueDate;
        if (a.dueDate != null) return -1;
        if (b.dueDate != null) return 1;
        return b.createdAt - a.createdAt;
    };

    const openProjectTasks = useMemo(
        () => projectTasks.filter((t) => t.status === 'open').sort(sortByDueDate),
        [projectTasks]
    );
    const completedProjectTasks = useMemo(
        () => projectTasks.filter((t) => t.status === 'completed').sort(sortByDueDate),
        [projectTasks]
    );

    if (!project) {
        if (loading || !hasFetched) {
            return (
                <Box sx={{ p: 2, display: 'flex', justifyContent: 'center', mt: 4 }}>
                    <CircularProgress />
                </Box>
            );
        }
        return (
            <Box sx={{ p: 2 }}>
                <IconButton onClick={() => navigate('/projects')} aria-label="Back to projects" sx={{ mb: 1 }}>
                    <ArrowBackIcon />
                </IconButton>
                <Typography variant="h6" color="error">
                    Project not found
                </Typography>
                <Button onClick={() => navigate('/projects')} sx={{ mt: 2 }}>
                    Back to Projects
                </Button>
            </Box>
        );
    }

    const handleNameBlur = async () => {
        if (name === project.name) return;
        const validation = validateProjectName(name);
        if (!validation.valid) {
            setNameError(validation.error || 'Invalid project name');
            return;
        }
        setNameError('');
        setError('');
        const success = await updateProject(project.recordID, { name });
        if (!success) {
            setError('Failed to update project name');
        }
    };

    const handleBack = () => {
        // If project still has the default placeholder name and no description, delete it
        if (name.trim() === '' || name.trim() === 'Untitled project') {
            if (!description.trim() && projectNotes.length === 0 && projectTasks.length === 0) {
                deleteProject(project.recordID);
            }
        }
        navigate('/projects');
    };

    const handleDescriptionBlur = async () => {
        if (description === project.description) return;
        setError('');
        const success = await updateProject(project.recordID, { description });
        if (!success) {
            setError('Failed to update project description');
        }
    };

    const handleShare = async (userID?: string) => {
        const targetID = userID || shareEmail.trim();
        if (!targetID) return;
        setError('');
        const success = await shareProject(project.recordID, targetID);
        if (success) {
            setShareEmail('');
            setSearchResults([]);
            await loadShares();
        }
        // Error is set by the store if it fails
    };

    const handleSearchUsers = async (query: string) => {
        setShareEmail(query);
        if (query.trim().length < 2) {
            setSearchResults([]);
            return;
        }
        setSearchLoading(true);
        const results = await searchUsers(query, currentUserID);
        // Filter out already-shared users
        const sharedIDs = new Set(shares.map((s) => s.sharedToID));
        setSearchResults(results.filter((u) => !sharedIDs.has(u.recordID)));
        setSearchLoading(false);
    };

    const handleUnshare = async (sharedToID: string) => {
        setError('');
        const success = await unshareProject(project.recordID, sharedToID);
        if (success) {
            setShares((prev) => prev.filter((s) => s.sharedToID !== sharedToID));
        }
    };

    const handleDelete = async () => {
        setDeleteDialogOpen(false);
        const success = await deleteProject(project.recordID);
        if (success) {
            navigate('/projects');
        } else {
            setError('Failed to delete project');
        }
    };

    const handleAddNote = async () => {
        const newNote = await createNote(project.recordID);
        if (newNote) {
            navigate(`/notes/${newNote.recordID}`);
        }
    };

    const handleAddTask = async () => {
        const task = await createBlankTask(project.recordID);
        navigate(`/tasks/${task.recordID}`);
    };

    const handleDeleteAllCompletedInProject = async () => {
        setDeleteCompletedDialogOpen(false);
        setDeletingCompleted(true);
        for (const task of completedProjectTasks) {
            await deleteTask(task.recordID);
        }
        setDeletingCompleted(false);
    };

    const formatDueDate = (dueDate: number): { label: string; color: 'default' | 'warning' | 'error' } => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const date = new Date(dueDate);
        const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const diffDays = Math.round((dateOnly.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
            const label = date.toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
            });
            return { label: `Overdue · ${label}`, color: 'error' };
        }
        if (diffDays === 0) return { label: 'Today', color: 'warning' };
        if (diffDays === 1) return { label: 'Tomorrow', color: 'default' };
        if (diffDays <= 7) {
            const dayName = date.toLocaleDateString(undefined, { weekday: 'short' });
            return { label: dayName, color: 'default' };
        }

        const label = date.toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
        });
        return { label, color: 'default' };
    };

    return (
        <Box sx={{ maxWidth: 600, mx: 'auto' }}>
            {/* Header with back button and menu */}
            <Box display="flex" alignItems="flex-start" justifyContent="space-between" sx={{ mb: 1 }}>
                <IconButton onClick={handleBack} aria-label="Back to projects">
                    <ArrowBackIcon />
                </IconButton>
                {/* Search bar */}
                <TextField
                    size="small"
                    placeholder="Search notes & tasks..."
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
                {isCreator && (
                    <>
                        <IconButton
                            onClick={(e) => setMenuAnchorEl(e.currentTarget)}
                            aria-label="More options"
                            aria-controls={menuOpen ? 'project-actions-menu' : undefined}
                            aria-haspopup="true"
                            aria-expanded={menuOpen ? 'true' : undefined}
                        >
                            <MoreVertIcon />
                        </IconButton>
                        <Menu
                            id="project-actions-menu"
                            anchorEl={menuAnchorEl}
                            open={menuOpen}
                            onClose={() => setMenuAnchorEl(null)}
                        >
                            <MenuItem onClick={() => { setMenuAnchorEl(null); setEditing(!editing); }}>
                                <ListItemIcon>{editing ? <EditOffIcon fontSize="small" /> : <EditIcon fontSize="small" />}</ListItemIcon>
                                <ListItemText>{editing ? 'Done editing' : 'Edit details'}</ListItemText>
                            </MenuItem>
                            <MenuItem onClick={() => { setMenuAnchorEl(null); setShareDialogOpen(true); }} disabled={!hasPro}>
                                <ListItemIcon><ShareIcon fontSize="small" /></ListItemIcon>
                                <ListItemText>{hasPro ? 'Share' : 'Share (Pro)'}</ListItemText>
                            </MenuItem>
                            <MenuItem onClick={() => { setMenuAnchorEl(null); setDeleteDialogOpen(true); }}>
                                <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
                                <ListItemText sx={{ color: 'error.main' }}>Delete</ListItemText>
                            </MenuItem>
                        </Menu>
                    </>
                )}
            </Box>

            {/* Error display */}
            {error && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
                    {error}
                </Alert>
            )}

            {/* Project Name & Description */}
            {editing ? (
                <>
                    <TextField
                        fullWidth
                        variant="standard"
                        label="Project Name"
                        autoFocus
                        value={name}
                        onFocus={(e) => (e.target as HTMLInputElement).select()}
                        onChange={(e) => {
                            setName(e.target.value);
                            if (nameError) {
                                const validation = validateProjectName(e.target.value);
                                if (validation.valid) setNameError('');
                            }
                        }}
                        onBlur={handleNameBlur}
                        error={!!nameError}
                        helperText={nameError}
                        inputProps={{ maxLength: 100 }}
                        sx={{ mb: 2 }}
                    />
                    <TextField
                        fullWidth
                        label="Description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        onBlur={handleDescriptionBlur}
                        multiline
                        minRows={2}
                        maxRows={6}
                        sx={{ mb: 2 }}
                    />
                </>
            ) : (
                <Box sx={{ mb: 2 }}>
                    <Typography variant="h4" sx={{ fontWeight: 600, fontStyle: project.name ? 'normal' : 'italic', color: project.name ? 'text.primary' : 'text.secondary' }}>
                        {project.name || 'Untitled'}
                    </Typography>
                    {project.description && (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}>
                            {project.description}
                        </Typography>
                    )}
                </Box>
            )}

            {/* Notes in this project */}
            <Box display="flex" alignItems="center" justifyContent="space-between">
                <Typography variant="h6" gutterBottom>
                    Notes
                </Typography>
                <Button
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={handleAddNote}
                >
                    Add Note
                </Button>
            </Box>
            {projectNotes.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    No notes in this project.
                </Typography>
            ) : (
                <Grid container spacing={1.5} sx={{ mb: 2 }}>
                    {projectNotes.map((note) => (
                        <Grid size={6} key={note.recordID}>
                            <Paper
                                elevation={4}
                                sx={{
                                    borderColor: note.pinned ? 'primary.main' : 'divider',
                                    borderRadius: 5,
                                    cursor: 'pointer',
                                    height: '100%',
                                }}
                                onClick={() => navigate(`/notes/${note.recordID}`)}
                            >
                                <Box sx={{ p: 1, py: 1.5, display: 'flex', flexDirection: 'column', height: '100%' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                                        {note.pinned && <PushPinIcon color="primary" sx={{ fontSize: 14 }} />}
                                        {note.noteType === 'list'
                                            ? <ChecklistIcon color="action" sx={{ fontSize: 14 }} />
                                            : <NotesIcon color="action" sx={{ fontSize: 14 }} />
                                        }
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
                                    {note.noteType !== 'list' && note.body && (
                                        <Typography
                                            variant="body2"
                                            color="text.secondary"
                                            sx={{
                                                display: '-webkit-box',
                                                WebkitLineClamp: 2,
                                                WebkitBoxOrient: 'vertical',
                                                overflow: 'hidden',
                                                fontSize: '0.75rem',
                                                mb: 0.5,
                                            }}
                                        >
                                            {note.body}
                                        </Typography>
                                    )}
                                    {note.noteType === 'list' && listItems[note.recordID] && listItems[note.recordID].length > 0 && (
                                        <Box sx={{ mb: 0.5 }}>
                                            {listItems[note.recordID].slice(0, 2).map((item) => (
                                                <Typography
                                                    key={item.recordID}
                                                    variant="body2"
                                                    color="text.secondary"
                                                    noWrap
                                                    sx={{
                                                        fontSize: '0.75rem',
                                                        textDecoration: item.isCompleted ? 'line-through' : 'none',
                                                        opacity: item.isCompleted ? 0.6 : 1,
                                                    }}
                                                >
                                                    {item.isCompleted ? '☑' : '☐'} {item.title || 'Untitled'}
                                                </Typography>
                                            ))}
                                        </Box>
                                    )}
                                    <Typography variant="caption" color="text.secondary" sx={{ mt: 'auto' }}>
                                        {new Date(note.updatedAt).toLocaleDateString()}
                                    </Typography>
                                </Box>
                            </Paper>
                        </Grid>
                    ))}
                </Grid>
            )}

            {/* Tasks in this project */}
            <Box display="flex" alignItems="center" justifyContent="space-between">
                <Typography variant="h6" gutterBottom>
                    Tasks
                </Typography>
                <Button
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={handleAddTask}
                >
                    Add Task
                </Button>
            </Box>
            {projectTasks.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    No tasks in this project.
                </Typography>
            ) : (
                <>
                    {openProjectTasks.length > 0 && (
                        <List disablePadding sx={{ mb: 1 }}>
                            {openProjectTasks.map((task) => (
                                <ListItem key={task.recordID} disablePadding divider>
                                    <ListItemIcon sx={{ minWidth: 36, ml: 1 }}>
                                        <IconButton
                                            edge="start"
                                            size="small"
                                            onClick={() => handleCompleteTask(task.recordID)}
                                            aria-label="Complete task"
                                        >
                                            <RadioButtonUncheckedIcon color="action" />
                                        </IconButton>
                                    </ListItemIcon>
                                    <ListItemButton onClick={() => navigate(`/tasks/${task.recordID}`)}>
                                        <ListItemText
                                            primary={task.title}
                                            secondary={
                                                (task.dueDate || task.isRecurring)
                                                    ? (
                                                        <Box component="span" sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 0.5 }}>
                                                            {task.dueDate && (() => {
                                                                const { label, color } = formatDueDate(task.dueDate);
                                                                return (
                                                                    <Chip
                                                                        label={label}
                                                                        size="small"
                                                                        variant="outlined"
                                                                        color={color}
                                                                        sx={{ height: 20, fontSize: '0.75rem' }}
                                                                    />
                                                                );
                                                            })()}
                                                            {task.isRecurring && (
                                                                <Chip
                                                                    icon={<RepeatIcon sx={{ fontSize: '0.85rem' }} />}
                                                                    label="Recurring"
                                                                    size="small"
                                                                    variant="outlined"
                                                                    color="secondary"
                                                                    sx={{ height: 20, fontSize: '0.75rem' }}
                                                                />
                                                            )}
                                                        </Box>
                                                    )
                                                    : undefined
                                            }
                                            secondaryTypographyProps={{ component: 'div' }}
                                        />
                                    </ListItemButton>
                                </ListItem>
                            ))}
                        </List>
                    )}

                    {completedProjectTasks.length > 0 && (
                        <>
                            <Box
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    mt: openProjectTasks.length > 0 ? 1 : 0,
                                    mb: 1,
                                    px: 1,
                                    py: 0.5,
                                    borderRadius: 1,
                                }}
                            >
                                <Box
                                    onClick={() => setCompletedExpanded(!completedExpanded)}
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        cursor: 'pointer',
                                        flex: 1,
                                        '&:hover': { opacity: 0.7 },
                                    }}
                                >
                                    {completedExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                                    <Typography variant="body2" color="text.secondary" sx={{ ml: 0.5 }}>
                                        Completed ({completedProjectTasks.length})
                                    </Typography>
                                </Box>
                                <IconButton
                                    size="small"
                                    onClick={(e) => setCompletedMenuAnchor(e.currentTarget)}
                                    aria-label="Completed tasks options"
                                >
                                    <MoreVertIcon fontSize="small" />
                                </IconButton>
                                <Menu
                                    anchorEl={completedMenuAnchor}
                                    open={Boolean(completedMenuAnchor)}
                                    onClose={() => setCompletedMenuAnchor(null)}
                                >
                                    <MenuItem
                                        onClick={() => {
                                            setCompletedMenuAnchor(null);
                                            setDeleteCompletedDialogOpen(true);
                                        }}
                                    >
                                        <ListItemIcon><DeleteSweepIcon fontSize="small" color="error" /></ListItemIcon>
                                        <ListItemText sx={{ color: 'error.main' }}>Delete all completed</ListItemText>
                                    </MenuItem>
                                </Menu>
                            </Box>
                            <Collapse in={completedExpanded}>
                                <List disablePadding sx={{ mb: 2 }}>
                                    {completedProjectTasks.map((task) => (
                                        <ListItem key={task.recordID} disablePadding divider>
                                            <ListItemIcon sx={{ minWidth: 36, ml: 1 }}>
                                                <IconButton
                                                    edge="start"
                                                    size="small"
                                                    onClick={() => reopenTask(task.recordID)}
                                                    aria-label="Reopen task"
                                                >
                                                    <CheckCircleIcon color="success" />
                                                </IconButton>
                                            </ListItemIcon>
                                            <ListItemButton onClick={() => navigate(`/tasks/${task.recordID}`)}>
                                                <ListItemText
                                                    primary={task.title}
                                                    secondary={
                                                        (task.dueDate || task.isRecurring)
                                                            ? (
                                                                <Box component="span" sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 0.5 }}>
                                                                    {task.dueDate && (() => {
                                                                        const { label, color } = formatDueDate(task.dueDate);
                                                                        return (
                                                                            <Chip
                                                                                label={label}
                                                                                size="small"
                                                                                variant="outlined"
                                                                                color={color}
                                                                                sx={{ height: 20, fontSize: '0.75rem' }}
                                                                            />
                                                                        );
                                                                    })()}
                                                                    {task.isRecurring && (
                                                                        <Chip
                                                                            icon={<RepeatIcon sx={{ fontSize: '0.85rem' }} />}
                                                                            label="Recurring"
                                                                            size="small"
                                                                            variant="outlined"
                                                                            color="secondary"
                                                                            sx={{ height: 20, fontSize: '0.75rem' }}
                                                                        />
                                                                    )}
                                                                </Box>
                                                            )
                                                            : undefined
                                                    }
                                                    secondaryTypographyProps={{ component: 'div' }}
                                                    primaryTypographyProps={{
                                                        sx: {
                                                            textDecoration: 'line-through',
                                                            color: 'text.secondary',
                                                        },
                                                    }}
                                                />
                                            </ListItemButton>
                                        </ListItem>
                                    ))}
                                </List>
                            </Collapse>
                        </>
                    )}
                </>
            )}

            {/* Share dialog (creator only) */}
            {isCreator && (
                <Dialog open={shareDialogOpen} onClose={() => setShareDialogOpen(false)} fullWidth maxWidth="sm" slotProps={{ paper: dialogPaperStyles }}>
                    <Box sx={{ bgcolor: 'background.paper', height: '100%' }}>
                        <DialogTitle>Share Project</DialogTitle>
                        <DialogContent>
                            <TextField
                                size="small"
                                placeholder="Search by name or email"
                                value={shareEmail}
                                onChange={(e) => handleSearchUsers(e.target.value)}
                                fullWidth
                                sx={{ mt: 1, mb: 1 }}
                                slotProps={{
                                    input: {
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <SearchIcon fontSize="small" />
                                            </InputAdornment>
                                        ),
                                    },
                                }}
                            />

                            {/* Recent users (shown when not searching) */}
                            {!shareEmail.trim() && !pendingShareUser && (() => {
                                const sharedIDs = new Set(shares.map((s) => s.sharedToID));
                                const filtered = recentUsers.filter((u) => !sharedIDs.has(u.recordID));
                                if (filtered.length === 0) return null;
                                return (
                                    <>
                                        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                                            Recently shared with
                                        </Typography>
                                        <List dense sx={{ mb: 2, maxHeight: 200, overflow: 'auto' }}>
                                            {filtered.map((user) => (
                                                <ListItemButton
                                                    key={user.recordID}
                                                    onClick={() => setPendingShareUser(user)}
                                                >
                                                    <ListItemAvatar>
                                                        <Avatar
                                                            src={`https://api.dicebear.com/9.x/shapes/svg?seed=${user.recordID}`}
                                                            sx={{ width: 32, height: 32 }}
                                                        />
                                                    </ListItemAvatar>
                                                    <ListItemText
                                                        primary={user.fullName || 'Unnamed'}
                                                        secondary={user.email}
                                                    />
                                                </ListItemButton>
                                            ))}
                                        </List>
                                    </>
                                );
                            })()}

                            {/* Search results */}
                            {searchResults.length > 0 && !pendingShareUser && (
                                <List dense sx={{ mb: 2, maxHeight: 200, overflow: 'auto' }}>
                                    {searchResults.map((user) => (
                                        <ListItemButton
                                            key={user.recordID}
                                            onClick={() => setPendingShareUser(user)}
                                        >
                                            <ListItemAvatar>
                                                <Avatar
                                                    src={`https://api.dicebear.com/9.x/shapes/svg?seed=${user.recordID}`}
                                                    sx={{ width: 32, height: 32 }}
                                                />
                                            </ListItemAvatar>
                                            <ListItemText
                                                primary={user.fullName || 'Unnamed'}
                                                secondary={user.email}
                                            />
                                        </ListItemButton>
                                    ))}
                                </List>
                            )}
                            {searchLoading && <CircularProgress size={20} sx={{ display: 'block', mx: 'auto', mb: 2 }} />}

                            {/* Confirm share prompt */}
                            {pendingShareUser && (
                                <Box sx={{ mb: 2, p: 2, borderRadius: 2, bgcolor: 'action.hover' }}>
                                    <Typography variant="body2" sx={{ mb: 1.5 }}>
                                        Share this project with <strong>{pendingShareUser.fullName || pendingShareUser.email}</strong>?
                                    </Typography>
                                    <Box sx={{ display: 'flex', gap: 1 }}>
                                        <Button
                                            variant="contained"
                                            size="small"
                                            onClick={() => {
                                                handleShare(pendingShareUser.recordID);
                                                setPendingShareUser(null);
                                            }}
                                        >
                                            Confirm
                                        </Button>
                                        <Button
                                            size="small"
                                            onClick={() => setPendingShareUser(null)}
                                        >
                                            Cancel
                                        </Button>
                                    </Box>
                                </Box>
                            )}

                            {sharesLoading ? (
                                <CircularProgress size={20} sx={{ mb: 2 }} />
                            ) : shares.length > 0 ? (
                                <>
                                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                        Shared with:
                                    </Typography>
                                    <List dense sx={{ mb: 1 }}>
                                        {shares.map((share) => (
                                            <ListItem
                                                key={share.recordID}
                                                secondaryAction={
                                                    <IconButton
                                                        edge="end"
                                                        aria-label="remove share"
                                                        onClick={() => handleUnshare(share.sharedToID)}
                                                        size="small"
                                                    >
                                                        <PersonRemoveIcon fontSize="small" />
                                                    </IconButton>
                                                }
                                            >
                                                <ListItemAvatar>
                                                    <Avatar
                                                        src={`https://api.dicebear.com/9.x/shapes/svg?seed=${share.sharedToID}`}
                                                        sx={{ width: 32, height: 32 }}
                                                    />
                                                </ListItemAvatar>
                                                <ListItemText
                                                    primary={share.fullName || share.sharedToID}
                                                    secondary={share.email}
                                                />
                                            </ListItem>
                                        ))}
                                    </List>
                                </>
                            ) : (
                                <Typography variant="body2" color="text.secondary">
                                    Not shared with anyone.
                                </Typography>
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
                    <DialogTitle>Delete Project</DialogTitle>
                    <DialogContent>
                        <DialogContentText>
                            Are you sure you want to delete "{project.name}"? This will remove the project and unlink all associated notes and tasks (they will not be deleted, but will no longer belong to any project).
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

            {/* Delete all completed tasks in project dialog */}
            <Dialog open={deleteCompletedDialogOpen} onClose={() => setDeleteCompletedDialogOpen(false)}>
                <DialogTitle>Delete Completed Tasks</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Are you sure you want to delete {completedProjectTasks.length} completed task{completedProjectTasks.length !== 1 ? 's' : ''} in this project? This cannot be undone.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteCompletedDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleDeleteAllCompletedInProject} color="error" variant="contained" disabled={deletingCompleted}>
                        {deletingCompleted ? 'Deleting…' : 'Delete All'}
                    </Button>
                </DialogActions>
            </Dialog>

        </Box>
    );
}
