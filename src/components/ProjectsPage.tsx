import React from 'react';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Fab from '@mui/material/Fab';
import AddIcon from '@mui/icons-material/Add';
import CircularProgress from '@mui/material/CircularProgress';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Alert from '@mui/material/Alert';
import PeopleIcon from '@mui/icons-material/People';
import NotesIcon from '@mui/icons-material/Notes';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import { useNavigate } from 'react-router-dom';
import { useProjectStore } from '../store/projectStore';
import { useNoteStore } from '../store/noteStore';
import { useTaskStore } from '../store/taskStore';
import { useGlobalStore } from '../store/globalStore';
import { useEntitlement } from '../lib/checkout';
import { supabase } from '../lib/supabase';
import Paper from "@mui/material/Paper";

export default function ProjectsPage() {
    const projects = useProjectStore(s => s.projects);
    const loading = useProjectStore(s => s.loading);
    const error = useProjectStore(s => s.error);
    const fetchProjects = useProjectStore(s => s.fetchProjects);
    const createBlankProject = useProjectStore(s => s.createBlankProject);
    const notes = useNoteStore(s => s.notes);
    const sharedNotes = useNoteStore(s => s.sharedNotes);
    const tasks = useTaskStore(s => s.tasks);
    const currentUserID = useGlobalStore(s => s.currentUser.recordID);
    const navigate = useNavigate();

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

    const handleCreateProject = async () => {
        if (atProjectLimit) return;
        const project = await createBlankProject();
        navigate(`/projects/${project.recordID}`, { state: { editing: true } });
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
                        columns: 2,
                        columnGap: 1.5,
                        '& > *': {
                            breakInside: 'avoid',
                            mb: 1.5,
                        },
                    }}
                >
                    {sortedProjects.map((project) => {
                        const allNotes = [...notes, ...sharedNotes];
                        const noteCount = allNotes.filter(n => n.projectID === project.recordID).length;
                        const taskCount = tasks.filter(t => t.projectID === project.recordID).length;
                        const isSharedToMe = project.creatorID !== currentUserID;
                        const isSharedByMe = sharedByMeProjectIDs.has(project.recordID);

                        return (
                            <Paper 
                                elevation={4}
                                sx={{ 
                                    borderRadius: 5, 
                                    width: '100%',
                                    cursor: 'pointer',
                                    borderColor: (isSharedToMe || isSharedByMe) ? 'info.main' : 'divider'
                                }} 
                                    key={project.recordID}
                                    onClick={() => navigate(`/projects/${project.recordID}`)}
                                >
                                    <Stack sx={{ width: '100%', p:1, py: 1.5 }}>
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
                                        <Stack direction="row" spacing={0.75}>
                                            <Chip
                                                icon={<NotesIcon />}
                                                label={noteCount}
                                                size="small"
                                                variant="outlined"
                                            />
                                            <Chip
                                                icon={<TaskAltIcon />}
                                                label={taskCount}
                                                size="small"
                                                variant="outlined"
                                            />
                                        </Stack>
                                    </Stack>
                            </Paper>
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
                onClick={handleCreateProject}
                disabled={atProjectLimit}
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
