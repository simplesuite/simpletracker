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
import { dialogPaperStyles } from '../store/globalStore';
import IconButton from '@mui/material/IconButton';

export default function TasksPage() {
    const tasks = useTaskStore((s) => s.tasks);
    const statusFilter = useTaskStore((s) => s.statusFilter);
    const setStatusFilter = useTaskStore((s) => s.setStatusFilter);
    const createTask = useTaskStore((s) => s.createTask);
    const completeTask = useTaskStore((s) => s.completeTask);
    const reopenTask = useTaskStore((s) => s.reopenTask);
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

    const handleSaveAndClose = async () => {
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
        }
    };

    const handleAddDetails = async () => {
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

    const formatDueDate = (dueDate: number): { label: string; color: 'default' | 'warning' | 'error' } => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const date = new Date(dueDate);
        const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const diffDays = Math.round((dateOnly.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
            // Overdue
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
            <Tabs
                value={statusFilter}
                onChange={handleTabChange}
                sx={{ mb: 2 }}
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
                                        <Box component="span" sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 0.5 }}>
                                            {task.projectID && projectNameMap.has(task.projectID) && (
                                                <Chip
                                                    label={projectNameMap.get(task.projectID)}
                                                    size="small"
                                                    color="primary"
                                                    variant="outlined"
                                                    sx={{ height: 20, fontSize: '0.75rem' }}
                                                />
                                            )}
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
                sx={{
                    position: 'fixed',
                    bottom: 72,
                    right: 16,
                }}
            >
                <AddIcon />
            </Fab>

            <Dialog open={dialogOpen} onClose={handleDialogClose} fullWidth maxWidth="sm" slotProps={{ paper: dialogPaperStyles }}>
                <Box sx={{ bgcolor: 'background.paper', height: '100%' }}>
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
                                    handleSaveAndClose();
                                }
                            }}
                            error={!!titleError}
                            helperText={titleError}
                            inputProps={{ maxLength: 255 }}
                        />
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={handleDialogClose}>Cancel</Button>
                        <Button onClick={handleSaveAndClose} variant="outlined">
                            Save + Close
                        </Button>
                        <Button onClick={handleAddDetails} variant="contained">
                            Add Details
                        </Button>
                    </DialogActions>
                </Box>
            </Dialog>
        </Box>
    );
}
