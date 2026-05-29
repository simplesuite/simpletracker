import React, { useMemo, useState } from 'react';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Fab from '@mui/material/Fab';
import AddIcon from '@mui/icons-material/Add';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import { useNavigate } from 'react-router-dom';
import { useTaskStore } from '../store/taskStore';
import { useProjectStore } from '../store/projectStore';

export default function TasksPage() {
    const tasks = useTaskStore((s) => s.tasks);
    const statusFilter = useTaskStore((s) => s.statusFilter);
    const setStatusFilter = useTaskStore((s) => s.setStatusFilter);
    const createTask = useTaskStore((s) => s.createTask);
    const projects = useProjectStore((s) => s.projects);
    const navigate = useNavigate();

    const [dialogOpen, setDialogOpen] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [titleError, setTitleError] = useState('');

    // Build a map of projectID -> project name for quick lookup
    const projectNameMap = useMemo(() => {
        const map = new Map<string, string>();
        for (const p of projects) {
            map.set(p.recordID, p.name);
        }
        return map;
    }, [projects]);

    // Filter tasks based on statusFilter
    const filteredTasks = useMemo(() => {
        if (statusFilter === 'all') return tasks;
        return tasks.filter((t) => t.status === statusFilter);
    }, [tasks, statusFilter]);

    const handleTabChange = (_event: React.SyntheticEvent, newValue: string) => {
        setStatusFilter(newValue as 'open' | 'completed' | 'all');
    };

    const handleFabClick = () => {
        setNewTitle('');
        setTitleError('');
        setDialogOpen(true);
    };

    const handleDialogClose = () => {
        setDialogOpen(false);
        setNewTitle('');
        setTitleError('');
    };

    const handleCreateTask = async () => {
        const trimmed = newTitle.trim();
        if (trimmed.length === 0) {
            setTitleError('Title is required');
            return;
        }
        if (trimmed.length > 255) {
            setTitleError('Title must be 255 characters or less');
            return;
        }

        const task = await createTask(trimmed);
        if (task) {
            setDialogOpen(false);
            setNewTitle('');
            setTitleError('');
            navigate(`/tasks/${task.recordID}`);
        }
    };

    const formatDueDate = (dueDate: number) => {
        const date = new Date(dueDate);
        return date.toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
        });
    };

    return (
        <Box>
            <Typography variant="h5" gutterBottom>
                Tasks
            </Typography>

            <Tabs
                value={statusFilter}
                onChange={handleTabChange}
                sx={{ mb: 2 }}
                variant="fullWidth"
            >
                <Tab label="Open" value="open" />
                <Tab label="Completed" value="completed" />
                <Tab label="All" value="all" />
            </Tabs>

            {filteredTasks.length === 0 ? (
                <Typography variant="body1" color="text.secondary" sx={{ mt: 2 }}>
                    {statusFilter === 'open' && 'No open tasks.'}
                    {statusFilter === 'completed' && 'No completed tasks.'}
                    {statusFilter === 'all' && 'No tasks yet.'}
                </Typography>
            ) : (
                <List disablePadding>
                    {filteredTasks.map((task) => (
                        <ListItem key={task.recordID} disablePadding>
                            <ListItemButton onClick={() => navigate(`/tasks/${task.recordID}`)}>
                                <ListItemIcon sx={{ minWidth: 36 }}>
                                    {task.status === 'completed' ? (
                                        <CheckCircleIcon color="success" />
                                    ) : (
                                        <RadioButtonUncheckedIcon color="action" />
                                    )}
                                </ListItemIcon>
                                <ListItemText
                                    primary={task.title}
                                    secondary={
                                        <Box component="span" sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 0.5 }}>
                                            {task.dueDate && (
                                                <Chip
                                                    label={formatDueDate(task.dueDate)}
                                                    size="small"
                                                    variant="outlined"
                                                    sx={{ height: 20, fontSize: '0.75rem' }}
                                                />
                                            )}
                                            {task.projectID && projectNameMap.has(task.projectID) && (
                                                <Chip
                                                    label={projectNameMap.get(task.projectID)}
                                                    size="small"
                                                    color="primary"
                                                    variant="outlined"
                                                    sx={{ height: 20, fontSize: '0.75rem' }}
                                                />
                                            )}
                                        </Box>
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

            <Fab
                color="primary"
                aria-label="Create task"
                onClick={handleFabClick}
                sx={{ position: 'fixed', bottom: 80, right: 24 }}
            >
                <AddIcon />
            </Fab>

            <Dialog open={dialogOpen} onClose={handleDialogClose} fullWidth maxWidth="sm">
                <DialogTitle>New Task</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        label="Task title"
                        fullWidth
                        variant="outlined"
                        value={newTitle}
                        onChange={(e) => {
                            setNewTitle(e.target.value);
                            if (titleError) setTitleError('');
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                handleCreateTask();
                            }
                        }}
                        error={!!titleError}
                        helperText={titleError}
                        inputProps={{ maxLength: 255 }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleDialogClose}>Cancel</Button>
                    <Button onClick={handleCreateTask} variant="contained">
                        Create
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
