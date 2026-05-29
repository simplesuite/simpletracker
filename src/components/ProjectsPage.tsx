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
import { useNavigate } from 'react-router-dom';
import { useProjectStore } from '../store/projectStore';
import { validateProjectName } from '../lib/validation';
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
    const navigate = useNavigate();
    const theme = useTheme();
    const bigger = useMediaQuery(theme.breakpoints.up('sm'));

    const [dialogOpen, setDialogOpen] = React.useState(false);
    const [projectName, setProjectName] = React.useState('');
    const [nameError, setNameError] = React.useState('');
    const [creating, setCreating] = React.useState(false);

    React.useEffect(() => {
        fetchProjects();
    }, []);

    // Projects are already sorted by updatedAt desc from the store
    const sortedProjects = [...projects].sort((a, b) => b.updatedAt - a.updatedAt);

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
                <Typography sx={{ alignSelf: 'flex-start' }} color="text.secondary" variant="h6">
                    Projects
                </Typography>

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
                            {sortedProjects.map((project, index) => (
                                <React.Fragment key={project.recordID}>
                                    <ListItem disablePadding>
                                        <ListItemButton onClick={() => navigate(`/projects/${project.recordID}`)}>
                                            <ListItemText
                                                primary={project.name}
                                                secondary={
                                                    project.description
                                                        ? project.description.length > 80
                                                            ? project.description.substring(0, 80) + '…'
                                                            : project.description
                                                        : undefined
                                                }
                                            />
                                        </ListItemButton>
                                    </ListItem>
                                </React.Fragment>
                            ))}
                        </List>
                    </Paper>
                )}
            </Box>

            <Fab
                color="primary"
                aria-label="Create project"
                onClick={handleOpenDialog}
                sx={{ position: 'fixed', bottom: 80, right: 24 }}
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
