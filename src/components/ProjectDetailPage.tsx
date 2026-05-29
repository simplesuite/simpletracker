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
import Divider from '@mui/material/Divider';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import DeleteIcon from '@mui/icons-material/Delete';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import NotesIcon from '@mui/icons-material/Notes';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import ShareIcon from '@mui/icons-material/Share';
import { useProjectStore } from '../store/projectStore';
import { useNoteStore } from '../store/noteStore';
import { useTaskStore } from '../store/taskStore';
import { useGlobalStore } from '../store/globalStore';
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
    const tasks = useTaskStore((s) => s.tasks);
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

    return (
        <Box sx={{ maxWidth: 700, mx: 'auto' }}>
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
            <Typography variant="h6" gutterBottom>
                Notes
            </Typography>
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
            <Typography variant="h6" gutterBottom>
                Tasks
            </Typography>
            {projectTasks.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    No tasks in this project.
                </Typography>
            ) : (
                <List dense sx={{ mb: 2 }}>
                    {projectTasks.map((task) => (
                        <ListItem
                            key={task.recordID}
                            component="div"
                            onClick={() => navigate(`/tasks/${task.recordID}`)}
                            sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' }, borderRadius: 1 }}
                        >
                            <ListItemIcon>
                                <TaskAltIcon
                                    fontSize="small"
                                    color={task.status === 'completed' ? 'success' : 'inherit'}
                                />
                            </ListItemIcon>
                            <ListItemText
                                primary={task.title}
                                secondary={task.status === 'completed' ? 'Completed' : (task.dueDate ? `Due: ${new Date(task.dueDate).toLocaleDateString()}` : 'Open')}
                            />
                        </ListItem>
                    ))}
                </List>
            )}

            {/* Sharing Management (creator only) */}
            {isCreator && (
                <>
                    <Divider sx={{ mb: 2 }} />
                    <Typography variant="h6" gutterBottom>
                        <ShareIcon fontSize="small" sx={{ mr: 1, verticalAlign: 'middle' }} />
                        Sharing
                    </Typography>

                    <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
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
                        <List dense sx={{ mb: 2 }}>
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
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            Not shared with anyone.
                        </Typography>
                    )}
                </>
            )}

            {/* Delete button (creator only) */}
            {isCreator && (
                <>
                    <Divider sx={{ mb: 2 }} />
                    <Button
                        variant="outlined"
                        color="error"
                        startIcon={<DeleteIcon />}
                        onClick={() => setDeleteDialogOpen(true)}
                        fullWidth
                    >
                        Delete Project
                    </Button>
                </>
            )}

            {/* Delete confirmation dialog */}
            <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
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
            </Dialog>
        </Box>
    );
}
