import React from 'react';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import Fab from '@mui/material/Fab';
import AddIcon from '@mui/icons-material/Add';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Alert from '@mui/material/Alert';
import PeopleIcon from '@mui/icons-material/People';
import NotesIcon from '@mui/icons-material/Notes';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import FolderIcon from '@mui/icons-material/Folder';
import { useNavigate } from 'react-router-dom';
import { useProjectStore } from '../store/projectStore';
import { useNoteStore } from '../store/noteStore';
import { useTaskStore } from '../store/taskStore';
import { useGlobalStore } from '../store/globalStore';
import { validateProjectName } from '../lib/validation';
import { useEntitlement } from '../lib/checkout';
import { supabase } from '../lib/supabase';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { dialogPaperStyles } from '../store/globalStore';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';

export default function ProjectsPage() {
    const projects = useProjectStore(s => s.projects);
    const loading = useProjectStore(s => s.loading);
    const error = useProjectStore(s => s.error);
    const fetchProjects = useProjectStore(s => s.fetchProjects);
    const createProject = useProjectStore(s => s.createProject);
    const notes = useNoteStore(s => s.notes);
    const sharedNotes = useNoteStore(s => s.sharedNotes);
    const tasks = useTaskStore(s => s.tasks);
    const currentUserID = useGlobalStore(s => s.currentUser.recordID);
    const navigate = useNavigate();
    const theme = useTheme();
    const bigger = useMediaQuery(theme.breakpoints.up('sm'));

    const [dialogOpen, setDialogOpen] = React.useState(false);
    const [projectName, setProjectName] = React.useState('');
    const [nameError, setNameError] = React.useState('');
    const [creating, setCreating] = React.useState(false);
    const [sharedByMeProjectIDs, setSharedByMeProjectIDs] = React.useState<Set<string>>(new Set());

    const { subscriptionState, loading: entitlementLoading } = useEntitlement();
    const hasPro = entitlementLoading || subscriptionState !== 'free';
    const FREE_PROJECT_LIMIT = 3;
    const ownedProjects = projects.filter(p => p.creatorID === currentUserID);
    const atProjectLimit = !hasPro && ownedProjects.length >= FREE_PROJECT_LIMIT;

    React.useEffect(() => {
        fetchProjects();
    }, []);

    // Fetch which of my projects are shared with others
    React.useEffect(() => {
        const fetchSharedByMe = async () => {
            const ownedProjectIDs = projects
                .filter(p => p.creatorID === currentUserID)
                .map(p => p.recordID);
            if (ownedProjectIDs.length === 0) {
                setSharedByMeProjectIDs(new Set());
                return;
            }
            const { data } = await supabase
                .from('task_projects_shared')
                .select('projectID')
                .in('projectID', ownedProjectIDs);
            if (data) {
                setSharedByMeProjectIDs(new Set(data.map(r => r.projectID)));
            }
        };
        fetchSharedByMe();
    }, [projects, currentUserID]);

    // Sort projects by total associated objects (notes + tasks) descending
    const sortedProjects = React.useMemo(() => {
        const allNotes = [...notes, ...sharedNotes];
        return [...projects].sort((a, b) => {
            const aCount = allNotes.filter(n => n.projectID === a.recordID).length
                + tasks.filter(t => t.projectID === a.recordID).length;
            const bCount = allNotes.filter(n => n.projectID === b.recordID).length
                + tasks.filter(t => t.projectID === b.recordID).length;
            return bCount - aCount;
        });
    }, [projects, notes, sharedNotes, tasks]);

    const handleOpenDialog = () => {
        if (atProjectLimit) return;
        setProjectName('');
        setNameError('');
        setDialogOpen(true);
    };

    const handleCloseDialog = () => {
        setDialogOpen(false);
        setProjectName('');
        setNameError('');
    };

    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setProjectName(value);
        if (nameError) {
            const validation = validateProjectName(value);
            if (validation.valid) {
                setNameError('');
            }
        }
    };

    const handleCreateProject = async (e: React.FormEvent) => {
        e.preventDefault();
        const validation = validateProjectName(projectName);
        if (!validation.valid) {
            setNameError(validation.error || 'Invalid project name');
            return;
        }

        setCreating(true);
        const project = await createProject(projectName.trim());
        setCreating(false);

        if (project) {
            handleCloseDialog();
            navigate(`/projects/${project.recordID}`);
        }
    };

    return (
        <Box sx={{ maxWidth: 600, mx: 'auto' }}>
            {loading && projects.length === 0 && (
                <Box display="flex" justifyContent="center" sx={{ mt: 4 }}>
                    <CircularProgress />
                </Box>
            )}

            {error && (
                <Typography color="error" variant="body2" sx={{ mt: 1 }}>
                    {error}
                </Typography>
            )}

            {!loading && sortedProjects.length === 0 && (
                <Typography variant="body1" color="text.secondary" sx={{ mt: 2 }}>
                    No projects yet. Create one to get started.
                </Typography>
            )}

            {sortedProjects.length > 0 && (
                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(2, 1fr)',
                        gap: 1.5,
                    }}
                >
                    {sortedProjects.map((project) => {
                        const allNotes = [...notes, ...sharedNotes];
                        const noteCount = allNotes.filter(n => n.projectID === project.recordID).length;
                        const taskCount = tasks.filter(t => t.projectID === project.recordID).length;
                        const isSharedToMe = project.creatorID !== currentUserID;
                        const isSharedByMe = sharedByMeProjectIDs.has(project.recordID);

                        return (
                            <Card
                                key={project.recordID}
                                variant="outlined"
                                sx={{
                                    borderRadius: 3,
                                    borderColor: (isSharedToMe || isSharedByMe) ? 'info.main' : 'divider',
                                }}
                            >
                                <CardActionArea
                                    onClick={() => navigate(`/projects/${project.recordID}`)}
                                    sx={{ height: '100%' }}
                                >
                                    <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                                            <Typography
                                                variant="subtitle2"
                                                noWrap
                                                sx={{ flex: 1 }}
                                            >
                                                {project.name}
                                            </Typography>
                                            {isSharedToMe && (
                                                <Tooltip title="Shared with you">
                                                    <PeopleIcon sx={{ fontSize: 16 }} color="info" />
                                                </Tooltip>
                                            )}
                                            {isSharedByMe && (
                                                <Tooltip title="Shared with others">
                                                    <PeopleIcon sx={{ fontSize: 16 }} color="action" />
                                                </Tooltip>
                                            )}
                                        </Box>

                                        {project.description && (
                                            <Typography
                                                variant="body2"
                                                color="text.secondary"
                                                sx={{
                                                    display: '-webkit-box',
                                                    WebkitLineClamp: 2,
                                                    WebkitBoxOrient: 'vertical',
                                                    overflow: 'hidden',
                                                    mb: 0.75,
                                                    fontSize: '0.75rem',
                                                }}
                                            >
                                                {project.description}
                                            </Typography>
                                        )}

                                        <Stack direction="row" spacing={0.75} sx={{ mt: 'auto' }}>
                                            <Chip
                                                icon={<NotesIcon sx={{ fontSize: 14 }} />}
                                                label={noteCount}
                                                size="small"
                                                variant="outlined"
                                                sx={{ height: 20, fontSize: '0.7rem', '& .MuiChip-label': { px: 0.5 } }}
                                            />
                                            <Chip
                                                icon={<TaskAltIcon sx={{ fontSize: 14 }} />}
                                                label={taskCount}
                                                size="small"
                                                variant="outlined"
                                                sx={{ height: 20, fontSize: '0.7rem', '& .MuiChip-label': { px: 0.5 } }}
                                            />
                                        </Stack>
                                    </CardContent>
                                </CardActionArea>
                            </Card>
                        );
                    })}
                </Box>
            )}

            {atProjectLimit && (
                <Alert severity="info" sx={{ mt: 2, maxWidth: 600, mx: 'auto' }}>
                    Free plan is limited to {FREE_PROJECT_LIMIT} projects. Upgrade to Pro for unlimited projects.
                </Alert>
            )}

            <Fab
                color="primary"
                aria-label="Create project"
                onClick={handleOpenDialog}
                disabled={atProjectLimit}
                sx={{
                    position: 'fixed',
                    bottom: 72,
                    right: 16,
                }}
            >
                <AddIcon />
            </Fab>

            <Dialog
                open={dialogOpen}
                onClose={handleCloseDialog}
                fullScreen={!bigger}
                slotProps={{ paper: bigger ? dialogPaperStyles : undefined }}
            >
                <Box
                    sx={{ bgcolor: 'background.paper', height: '100%' }}
                    component="form"
                    onSubmit={handleCreateProject}
                >
                    <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        New Project
                        <IconButton onClick={handleCloseDialog} aria-label="Close">
                            <CloseIcon />
                        </IconButton>
                    </DialogTitle>
                    <DialogContent>
                        <TextField
                            autoFocus
                            margin="dense"
                            label="Project Name"
                            fullWidth
                            variant="outlined"
                            value={projectName}
                            onChange={handleNameChange}
                            error={!!nameError}
                            helperText={nameError || `${projectName.trim().length}/100 characters`}
                            inputProps={{ maxLength: 100 }}
                        />
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={handleCloseDialog}>Cancel</Button>
                        <Button
                            type="submit"
                            variant="contained"
                            disabled={creating || projectName.trim().length === 0}
                        >
                            {creating ? 'Creating…' : 'Create'}
                        </Button>
                    </DialogActions>
                </Box>
            </Dialog>
        </Box>
    );
}
