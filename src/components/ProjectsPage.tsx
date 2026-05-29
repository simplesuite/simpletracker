import React from 'react';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
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
import PeopleIcon from '@mui/icons-material/People';
import NotesIcon from '@mui/icons-material/Notes';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import { useNavigate } from 'react-router-dom';
import { useProjectStore } from '../store/projectStore';
import { useNoteStore } from '../store/noteStore';
import { useTaskStore } from '../store/taskStore';
import { useGlobalStore } from '../store/globalStore';
import { validateProjectName } from '../lib/validation';
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
        <Box display="flex" flexDirection="column" alignItems="center">
            <Box sx={{ maxWidth: 600, width: '100%' }}>
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
                    <Paper elevation={4} sx={{ width: '100%', borderRadius: 3, mt: 2 }}>
                        <List disablePadding>
                            {sortedProjects.map((project) => {
                                const noteCount = [...notes, ...sharedNotes].filter(n => n.projectID === project.recordID).length;
                                const taskCount = tasks.filter(t => t.projectID === project.recordID).length;
                                const isSharedToMe = project.creatorID !== currentUserID;
                                const isSharedByMe = sharedByMeProjectIDs.has(project.recordID);

                                return (
                                    <React.Fragment key={project.recordID}>
                                        <ListItem disablePadding divider>
                                            <ListItemButton onClick={() => navigate(`/projects/${project.recordID}`)}>
                                                <ListItemText
                                                    primary={
                                                        <Box display="flex" alignItems="center" gap={1}>
                                                            <Typography variant="body1" noWrap sx={{ flex: 1 }}>
                                                                {project.name}
                                                            </Typography>
                                                            {isSharedToMe && (
                                                                <Tooltip title="Shared with you">
                                                                    <PeopleIcon fontSize="small" color="info" />
                                                                </Tooltip>
                                                            )}
                                                            {isSharedByMe && (
                                                                <Tooltip title="Shared with others">
                                                                    <PeopleIcon fontSize="small" color="action" />
                                                                </Tooltip>
                                                            )}
                                                        </Box>
                                                    }
                                                    secondary={
                                                        <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                                                            <Chip
                                                                icon={<NotesIcon sx={{ fontSize: 16 }} />}
                                                                label={noteCount}
                                                                size="small"
                                                                variant="outlined"
                                                                sx={{ height: 22, '& .MuiChip-label': { px: 0.5 } }}
                                                            />
                                                            <Chip
                                                                icon={<TaskAltIcon sx={{ fontSize: 16 }} />}
                                                                label={taskCount}
                                                                size="small"
                                                                variant="outlined"
                                                                sx={{ height: 22, '& .MuiChip-label': { px: 0.5 } }}
                                                            />
                                                            {project.description && (
                                                                <Typography variant="caption" color="text.secondary" noWrap sx={{ ml: 1 }}>
                                                                    {project.description.length > 60
                                                                        ? project.description.substring(0, 60) + '…'
                                                                        : project.description}
                                                                </Typography>
                                                            )}
                                                        </Stack>
                                                    }
                                                    disableTypography
                                                />
                                            </ListItemButton>
                                        </ListItem>
                                    </React.Fragment>
                                );
                            })}
                        </List>
                    </Paper>
                )}
            </Box>

            <Fab
                color="primary"
                aria-label="Create project"
                onClick={handleOpenDialog}
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
