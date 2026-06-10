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
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { useNavigate } from 'react-router-dom';
import { useTaskStore } from '../store/taskStore';
import { useProjectStore } from '../store/projectStore';
import IconButton from '@mui/material/IconButton';
import type { Task } from '../types';

export default function TasksPage() {
    const tasks = useTaskStore((s) => s.tasks);
    const createBlankTask = useTaskStore((s) => s.createBlankTask);
    const completeTask = useTaskStore((s) => s.completeTask);
    const reopenTask = useTaskStore((s) => s.reopenTask);
    const deleteTask = useTaskStore((s) => s.deleteTask);
    const fetchTasks = useTaskStore((s) => s.fetchTasks);
    const projects = useProjectStore((s) => s.projects);
    const navigate = useNavigate();

    // Fetch fresh tasks from server on mount
    React.useEffect(() => {
        fetchTasks();
    }, [fetchTasks]);

    // Re-fetch tasks when the app returns to the foreground (e.g., switching back on mobile)
    React.useEffect(() => {
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                fetchTasks();
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);
        return () => document.removeEventListener('visibilitychange', handleVisibility);
    }, [fetchTasks]);

    const [completedExpanded, setCompletedExpanded] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [completedMenuAnchor, setCompletedMenuAnchor] = useState<null | HTMLElement>(null);
    const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);

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

    const handleFabClick = async () => {
        const task = await createBlankTask();
        navigate(`/tasks/${task.recordID}`);
    };

    const handleDeleteAllCompleted = async () => {
        setDeleteAllDialogOpen(false);
        setDeleting(true);
        for (const task of completedTasks) {
            await deleteTask(task.recordID);
        }
        setDeleting(false);
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

            {openTasks.length === 0 && completedTasks.length === 0 ? (
                <Typography variant="body1" color="text.secondary" sx={{ mt: 2 }}>
                    {searchQuery.trim()
                        ? 'No tasks match your search.'
                        : 'No tasks yet.'}
                </Typography>
            ) : (
                <>
                    {openTasks.length > 0 && (
                        <List disablePadding>
                            {openTasks.map((task) => (
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
                                                    {task.projectID && projectNameMap.has(task.projectID) && (
                                                        <Chip
                                                            label={projectNameMap.get(task.projectID)}
                                                            size="small"                                                 
                                                            variant="outlined"
                                                            sx={{ height: 20, fontSize: '0.75rem' }}
                                                        />
                                                    )}
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
                                            secondaryTypographyProps={{ component: 'div' }}
                                        />
                                    </ListItemButton>
                                </ListItem>
                            ))}
                        </List>
                    )}

                    {completedTasks.length > 0 && (
                        <>
                            <Box
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    mt: openTasks.length > 0 ? 2 : 0,
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
                                        Completed ({completedTasks.length})
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
                                            setDeleteAllDialogOpen(true);
                                        }}
                                    >
                                        <ListItemIcon><DeleteSweepIcon fontSize="small" color="error" /></ListItemIcon>
                                        <ListItemText sx={{ color: 'error.main' }}>Delete all completed</ListItemText>
                                    </MenuItem>
                                </Menu>
                            </Box>
                            <Collapse in={completedExpanded}>
                                <List disablePadding>
                                    {completedTasks.map((task) => (
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

            <Dialog open={deleteAllDialogOpen} onClose={() => setDeleteAllDialogOpen(false)}>
                <DialogTitle>Delete All Completed Tasks</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Are you sure you want to delete {completedTasks.length} completed task{completedTasks.length !== 1 ? 's' : ''}? This cannot be undone.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteAllDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleDeleteAllCompleted} color="error" variant="contained" disabled={deleting}>
                        {deleting ? 'Deleting…' : 'Delete All'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
