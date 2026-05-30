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
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import RepeatIcon from '@mui/icons-material/Repeat';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Button from '@mui/material/Button';
import { useNavigate } from 'react-router-dom';
import { useTaskStore } from '../store/taskStore';
import { useProjectStore } from '../store/projectStore';
import { dialogPaperStyles } from '../store/globalStore';
import IconButton from '@mui/material/IconButton';
import type { Task } from '../types';

export default function TasksPage() {
    const tasks = useTaskStore((s) => s.tasks);
    const statusFilter = useTaskStore((s) => s.statusFilter);
    const setStatusFilter = useTaskStore((s) => s.setStatusFilter);
    const createTask = useTaskStore((s) => s.createTask);
    const completeTask = useTaskStore((s) => s.completeTask);
    const reopenTask = useTaskStore((s) => s.reopenTask);
    const fetchTasks = useTaskStore((s) => s.fetchTasks);
    const projects = useProjectStore((s) => s.projects);
    const navigate = useNavigate();

    // Fetch fresh tasks from server on mount
    React.useEffect(() => {
        fetchTasks();
    }, [fetchTasks]);

    const [dialogOpen, setDialogOpen] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [titleError, setTitleError] = useState('');
    const [completedExpanded, setCompletedExpanded] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Build a map of projectID -> project name for quick lookup
    const projectNameMap = useMemo(() => {
        const map = new Map<string, string>();
        for (const p of projects) {
            map.set(p.recordID, p.name);
        }
        return map;
    }, [projects]);

    /**
     * Sort tasks by due date (earliest first), tasks without a due date go after
     * those with one. Within the same due-date status, sort by creation date.
     */
    const sortByDueDate = (a: Task, b: Task): number => {
        // Both have due dates — sort ascending
        if (a.dueDate != null && b.dueDate != null) return a.dueDate - b.dueDate;
        // Only one has a due date — it comes first
        if (a.dueDate != null) return -1;
        if (b.dueDate != null) return 1;
        // Neither has a due date — sort by creation date descending
        return b.createdAt - a.createdAt;
    };

    // Filter tasks by search query (title and body)
    const filteredBySearch = useMemo(() => {
        if (!searchQuery.trim()) return tasks;
        const q = searchQuery.toLowerCase();
        return tasks.filter(
            (t) => t.title.toLowerCase().includes(q) || t.body.toLowerCase().includes(q)
        );
    }, [tasks, searchQuery]);

    // Split and sort tasks
    const { openTasks, completedTasks } = useMemo(() => {
        const open = filteredBySearch.filter((t) => t.status === 'open').sort(sortByDueDate);
        const completed = filteredBySearch.filter((t) => t.status === 'completed').sort(sortByDueDate);
        return { openTasks: open, completedTasks: completed };
    }, [filteredBySearch]);

    // Determine what to show based on filter
    const visibleOpenTasks = useMemo(() => {
        if (statusFilter === 'completed') return [];
        return openTasks;
    }, [statusFilter, openTasks]);

    const visibleCompletedTasks = useMemo(() => {
        if (statusFilter === 'open') return [];
        return completedTasks;
    }, [statusFilter, completedTasks]);

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

            <TextField
                size="small"
                placeholder="Search tasks..."
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

            {visibleOpenTasks.length === 0 && visibleCompletedTasks.length === 0 ? (
                <Typography variant="body1" color="text.secondary" sx={{ mt: 2 }}>
                    {searchQuery.trim()
                        ? 'No tasks match your search.'
                        : statusFilter === 'open' ? 'No open tasks.'
                            : statusFilter === 'completed' ? 'No completed tasks.'
                                : 'No tasks yet.'}
                </Typography>
            ) : (
                <>
                    {visibleOpenTasks.length > 0 && (
                        <List disablePadding>
                            {visibleOpenTasks.map((task) => (
                                <ListItem key={task.recordID} disablePadding divider>
                                    <ListItemIcon sx={{ minWidth: 36, ml: 1 }}>
                                        <IconButton
                                            edge="start"
                                            size="small"
                                            onClick={() => completeTask(task.recordID)}
                                            aria-label="Complete task"
                                        >
                                            <RadioButtonUncheckedIcon color="action" />
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
                                            }
                                        />
                                    </ListItemButton>
                                </ListItem>
                            ))}
                        </List>
                    )}

                    {visibleCompletedTasks.length > 0 && (
                        <>
                            <Box
                                onClick={() => setCompletedExpanded(!completedExpanded)}
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    cursor: 'pointer',
                                    mt: visibleOpenTasks.length > 0 ? 2 : 0,
                                    mb: 1,
                                    px: 1,
                                    py: 0.5,
                                    borderRadius: 1,
                                    '&:hover': { bgcolor: 'action.hover' },
                                }}
                            >
                                {completedExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                                <Typography variant="body2" color="text.secondary" sx={{ ml: 0.5 }}>
                                    Completed ({visibleCompletedTasks.length})
                                </Typography>
                            </Box>
                            <Collapse in={completedExpanded}>
                                <List disablePadding>
                                    {visibleCompletedTasks.map((task) => (
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
                                                    }
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
