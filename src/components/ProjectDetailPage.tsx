import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemButton from '@mui/material/ListItemButton';
import Divider from '@mui/material/Divider';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import DeleteIcon from '@mui/icons-material/Delete';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import NotesIcon from '@mui/icons-material/Notes';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import ShareIcon from '@mui/icons-material/Share';
import AddIcon from '@mui/icons-material/Add';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import Chip from '@mui/material/Chip';
import { useProjectStore } from '../store/projectStore';
import { useNoteStore } from '../store/noteStore';
import { useTaskStore } from '../store/taskStore';
import { dialogPaperStyles, useGlobalStore } from '../store/globalStore';
import { validateProjectName } from '../lib/validation';
import { supabase } from '../lib/supabase';
import type { ProjectShared } from '../types/index';

export default function ProjectDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const projects = useProjectStore((s) => s.projects);
    const updateProject = useProjectStore((s) => s.updateProject);
    const deleteProject = useProjectStore((s) => s.deleteProject);
    const shareProject = useProjectStore((s) => s.shareProject);
    const unshareProject = useProjectStore((s) => s.unshareProject);
    const getSharesForProject = useProjectStore((s) => s.getSharesForProject);
    const storeError = useProjectStore((s) => s.error);

    const notes = useNoteStore((s) => s.notes);
    const sharedNotes = useNoteStore((s) => s.sharedNotes);
    const createNote = useNoteStore((s) => s.createNote);
    const tasks = useTaskStore((s) => s.tasks);
    const createTask = useTaskStore((s) => s.createTask);
    const completeTask = useTaskStore((s) => s.completeTask);
    const reopenTask = useTaskStore((s) => s.reopenTask);
    const currentUserID = useGlobalStore((s) => s.currentUser.recordID);

    const project = projects.find((p) => p.recordID === id);
    const isCreator = project?.creatorID === currentUserID;

    // Local state
    const [name, setName] = useState(project?.name || '');
    const [description, setDescription] = useState(project?.description || '');
    const [nameError, setNameError] = useState('');
    const [shareEmail, setShareEmail] = useState('');
    const [shares, setShares] = useState<(ProjectShared & { email?: string })[]>([]);
    const [sharesLoading, setSharesLoading] = useState(false);
    const [error, setError] = useState('');
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
    const menuOpen = Boolean(menuAnchorEl);
    const [shareDialogOpen, setShareDialogOpen] = useState(false);
    const [taskDialogOpen, setTaskDialogOpen] = useState(false);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [taskTitleError, setTaskTitleError] = useState('');

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
        // Fetch emails for each shared user
        const sharesWithEmails: (ProjectShared & { email?: string })[] = [];
        for (const share of shareRecords) {
            const { data } = await supabase
                .from('users')
                .select('email')
                .eq('recordID', share.sharedToID)
                .single();
            sharesWithEmails.push({ ...share, email: data?.email || share.sharedToID });
        }
        setShares(sharesWithEmails);
        setSharesLoading(false);
    }, [id, isCreator, getSharesForProject]);

    useEffect(() => {
        loadShares();
    }, [loadShares]);

    // Clear error when store error changes
    useEffect(() => {
        if (storeError) {
            setError(storeError);
        }
    }, [storeError]);

    // Filter notes and tasks belonging to this project
    const projectNotes = [...notes, ...sharedNotes].filter((n) => n.projectID === id);
    const projectTasks = tasks.filter((t) => t.projectID === id);

    if (!project) {
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

    const handleDescriptionBlur = async () => {
        if (description === project.description) return;
        setError('');
        const success = await updateProject(project.recordID, { description });
        if (!success) {
            setError('Failed to update project description');
        }
    };

    const handleShare = async () => {
        const trimmedEmail = shareEmail.trim();
        if (!trimmedEmail) return;
        setError('');
        const success = await shareProject(project.recordID, trimmedEmail);
        if (success) {
            setShareEmail('');
            await loadShares();
        }
        // Error is set by the store if it fails
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
        const trimmed = newTaskTitle.trim();
        if (trimmed.length === 0) {
            setTaskTitleError('Title is required');
            return;
        }
        if (trimmed.length > 255) {
            setTaskTitleError('Title must be 255 characters or less');
            return;
        }
        const task = await createTask(trimmed, project.recordID);
        if (task) {
            setTaskDialogOpen(false);
            setNewTaskTitle('');
            setTaskTitleError('');
            navigate(`/tasks/${task.recordID}`);
        }
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
            <Box display="flex" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                <IconButton onClick={() => navigate('/projects')} aria-label="Back to projects">
                    <ArrowBackIcon />
                </IconButton>
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
                            <MenuItem onClick={() => { setMenuAnchorEl(null); setShareDialogOpen(true); }}>
                                <ListItemIcon><ShareIcon fontSize="small" /></ListItemIcon>
                                <ListItemText>Share</ListItemText>
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

            {/* Project Name */}
            <TextField
                fullWidth
                label="Project Name"
                value={name}
                onChange={(e) => {
                    setName(e.target.value);
                    if (nameError) {
                        const validation = validateProjectName(e.target.value);
                        if (validation.valid) setNameError('');
                    }
                }}
                onBlur={handleNameBlur}
                disabled={!isCreator}
                error={!!nameError}
                helperText={nameError}
                inputProps={{ maxLength: 100 }}
                sx={{ mb: 2 }}
            />

            {/* Project Description */}
            <TextField
                fullWidth
                label="Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={handleDescriptionBlur}
                disabled={!isCreator}
                multiline
                minRows={2}
                maxRows={6}
                sx={{ mb: 3 }}
            />

            <Divider sx={{ mb: 2 }} />

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
                <List dense sx={{ mb: 2 }}>
                    {projectNotes.map((note) => (
                        <ListItem
                            key={note.recordID}
                            component="div"
                            onClick={() => navigate(`/notes/${note.recordID}`)}
                            sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' }, borderRadius: 1 }}
                        >
                            <ListItemIcon>
                                <NotesIcon fontSize="small" />
                            </ListItemIcon>
                            <ListItemText
                                primary={note.title || 'Untitled'}
                                secondary={new Date(note.updatedAt).toLocaleDateString()}
                            />
                        </ListItem>
                    ))}
                </List>
            )}

            <Divider sx={{ mb: 2 }} />

            {/* Tasks in this project */}
            <Box display="flex" alignItems="center" justifyContent="space-between">
                <Typography variant="h6" gutterBottom>
                    Tasks
                </Typography>
                <Button
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={() => { setNewTaskTitle(''); setTaskTitleError(''); setTaskDialogOpen(true); }}
                >
                    Add Task
                </Button>
            </Box>
            {projectTasks.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    No tasks in this project.
                </Typography>
            ) : (
                <List disablePadding sx={{ mb: 2 }}>
                    {projectTasks.map((task) => (
                        <ListItem key={task.recordID} disablePadding divider>
                            <ListItemIcon sx={{ minWidth: 36, ml: 1 }}>
                                <IconButton
                                    edge="start"
                                    size="small"
                                    onClick={() => task.status === 'completed' ? reopenTask(task.recordID) : completeTask(task.recordID)}
                                    aria-label={task.status === 'completed' ? 'Reopen task' : 'Complete task'}
                                >
                                    {task.status === 'completed' ? (
                                        <CheckCircleIcon color="success" />
                                    ) : (
                                        <RadioButtonUncheckedIcon color="action" />
                                    )}
                                </IconButton>
                            </ListItemIcon>
                            <ListItemButton onClick={() => navigate(`/tasks/${task.recordID}`)}>
                                <ListItemText
                                    primary={task.title}
                                    secondary={
                                        task.status === 'completed'
                                            ? 'Completed'
                                            : task.dueDate
                                                ? (() => {
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
                                                })()
                                                : 'Open'
                                    }
                                    primaryTypographyProps={{
                                        sx: {
                                            textDecoration: task.status === 'completed' ? 'line-through' : 'none',
                                            color: task.status === 'completed' ? 'text.secondary' : 'text.primary',
                                        },
                                    }}
                                />
                            </ListItemButton>
                        </ListItem>
                    ))}
                </List>
            )}

            {/* Share dialog (creator only) */}
            {isCreator && (
                <Dialog open={shareDialogOpen} onClose={() => setShareDialogOpen(false)} fullWidth maxWidth="sm" slotProps={{ paper: dialogPaperStyles }}>
                    <Box sx={{ bgcolor: 'background.paper', height: '100%' }}>
                        <DialogTitle>Share Project</DialogTitle>
                        <DialogContent>
                            <Box sx={{ display: 'flex', gap: 1, mt: 1, mb: 2 }}>
                                <TextField
                                    size="small"
                                    label="Email address"
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
                                    disabled={!shareEmail.trim()}
                                >
                                    Share
                                </Button>
                            </Box>

                            {sharesLoading ? (
                                <CircularProgress size={20} sx={{ mb: 2 }} />
                            ) : shares.length > 0 ? (
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
                                            <ListItemText primary={share.email} />
                                        </ListItem>
                                    ))}
                                </List>
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

            {/* New Task dialog */}
            <Dialog open={taskDialogOpen} onClose={() => setTaskDialogOpen(false)} fullWidth maxWidth="sm" slotProps={{ paper: dialogPaperStyles }}>
                <Box sx={{ bgcolor: 'background.paper', height: '100%' }}>
                    <DialogTitle>New Task</DialogTitle>
                    <DialogContent>
                        <TextField
                            autoFocus
                            margin="dense"
                            label="Task title"
                            fullWidth
                            variant="outlined"
                            value={newTaskTitle}
                            onChange={(e) => {
                                setNewTaskTitle(e.target.value);
                                if (taskTitleError) setTaskTitleError('');
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleAddTask();
                                }
                            }}
                            error={!!taskTitleError}
                            helperText={taskTitleError}
                            inputProps={{ maxLength: 255 }}
                        />
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setTaskDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleAddTask} variant="contained">
                            Create
                        </Button>
                    </DialogActions>
                </Box>
            </Dialog>
        </Box>
    );
}
