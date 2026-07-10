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
import { TransitionGroup } from 'react-transition-group';
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
import Paper from "@mui/material/Paper";

export default function TasksPage() {
    const tasks = useTaskStore((s) => s.tasks);
    const createBlankTask = useTaskStore((s) => s.createBlankTask);
    const completeTask = useTaskStore((s) => s.completeTask);
    const reopenTask = useTaskStore((s) => s.reopenTask);
    const deleteTask = useTaskStore((s) => s.deleteTask);
    const updateTask = useTaskStore((s) => s.updateTask);
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

    const [completedExpanded, setCompletedExpanded] = useState(() => {
        try { return localStorage.getItem('tasksCompletedExpanded') === 'true'; } catch { return false; }
    });
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedProjectIDs, setSelectedProjectIDs] = useState<Set<string>>(new Set());
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

    // Sort projects by most tasks descending
    const sortedProjects = useMemo(() => {
        return [...projects].sort((a, b) => {
            const aCount = tasks.filter((t) => t.projectID === a.recordID).length;
            const bCount = tasks.filter((t) => t.projectID === b.recordID).length;
            return bCount - aCount;
        });
    }, [projects, tasks]);

    const toggleProjectFilter = (projectID: string) => {
        setSelectedProjectIDs((prev) => {
            const next = new Set(prev);
            if (next.has(projectID)) {
                next.delete(projectID);
            } else {
                next.add(projectID);
            }
            return next;
        });
    };

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

    // Filter tasks by search query and selected projects
    const filteredBySearch = useMemo(() => {
        let filtered = tasks;
        if (selectedProjectIDs.size > 0) {
            filtered = filtered.filter((t) => t.projectID && selectedProjectIDs.has(t.projectID));
        }
        if (!searchQuery.trim()) return filtered;
        const q = searchQuery.toLowerCase();
        return filtered.filter(
            (t) => t.title.toLowerCase().includes(q) || t.body.toLowerCase().includes(q)
        );
    }, [tasks, searchQuery, selectedProjectIDs]);

    // Split and sort tasks
    const { openTasks, completedTasks } = useMemo(() => {
        const open = filteredBySearch.filter((t) => t.status === 'open').sort(sortByDueDate);
        const completed = filteredBySearch.filter((t) => t.status === 'completed').sort(sortByDueDate);
        return { openTasks: open, completedTasks: completed };
    }, [filteredBySearch]);

    // Group open tasks into due date categories
    const { overdueTasks, dueTodayTasks, upcomingTasks, noDueDateTasks } = useMemo(() => {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const todayEnd = todayStart + 24 * 60 * 60 * 1000 - 1;

        const overdue: Task[] = [];
        const dueToday: Task[] = [];
        const upcoming: Task[] = [];
        const noDueDate: Task[] = [];

        for (const task of openTasks) {
            if (task.dueDate == null) {
                noDueDate.push(task);
            } else if (task.dueDate < todayStart) {
                overdue.push(task);
            } else if (task.dueDate <= todayEnd) {
                dueToday.push(task);
            } else {
                upcoming.push(task);
            }
        }

        return { overdueTasks: overdue, dueTodayTasks: dueToday, upcomingTasks: upcoming, noDueDateTasks: noDueDate };
    }, [openTasks]);

    const [overdueExpanded, setOverdueExpanded] = useState(() => {
        try { return localStorage.getItem('tasksOverdueExpanded') !== 'false'; } catch { return true; }
    });
    const [dueTodayExpanded, setDueTodayExpanded] = useState(() => {
        try { return localStorage.getItem('tasksDueTodayExpanded') !== 'false'; } catch { return true; }
    });
    const [upcomingExpanded, setUpcomingExpanded] = useState(() => {
        try { return localStorage.getItem('tasksUpcomingExpanded') !== 'false'; } catch { return true; }
    });
    const [noDueDateExpanded, setNoDueDateExpanded] = useState(() => {
        try { return localStorage.getItem('tasksNoDueDateExpanded') !== 'false'; } catch { return true; }
    });
    const [overdueMenuAnchor, setOverdueMenuAnchor] = useState<null | HTMLElement>(null);
    const [rescheduling, setRescheduling] = useState(false);

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

    const handleRescheduleOverdueToToday = async () => {
        setOverdueMenuAnchor(null);
        setRescheduling(true);
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayTimestamp = todayStart.getTime();
        for (const task of overdueTasks) {
            await updateTask(task.recordID, { dueDate: todayTimestamp });
        }
        setRescheduling(false);
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

            {/* Project filter chips */}
            {sortedProjects.length > 0 && (
                <Box
                    sx={{
                        display: 'flex',
                        gap: 1,
                        overflowX: 'auto',
                        pb: 1,
                        mb: 1.5,
                        '&::-webkit-scrollbar': { display: 'none' },
                        scrollbarWidth: 'none',
                    }}
                >
                    {sortedProjects.map((project) => {
                        const count = tasks.filter((t) => t.projectID === project.recordID).length;
                        return (
                        <Chip
                            key={project.recordID}
                            label={`${project.name} (${count})`}
                            variant={selectedProjectIDs.has(project.recordID) ? 'filled' : 'outlined'}
                            color={selectedProjectIDs.has(project.recordID) ? 'primary' : 'default'}
                            onClick={() => toggleProjectFilter(project.recordID)}
                            sx={{ flexShrink: 0 }}
                        />
                        );
                    })}
                </Box>
            )}

            {openTasks.length === 0 && completedTasks.length === 0 ? (
                <Typography variant="body1" color="text.secondary" sx={{ mt: 2 }}>
                    {searchQuery.trim()
                        ? 'No tasks match your search.'
                        : 'No tasks yet.'}
                </Typography>
            ) : (
                <>
                    {openTasks.length > 0 && (
                        <>
                            {overdueTasks.length > 0 && (
                                <Box sx={{ mb: 2 }}>
                                    <Box
                                        sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            mb: 0.5,
                                            px: 1,
                                            py: 0.5,
                                            borderRadius: 1,
                                        }}
                                    >
                                        <Box
                                            onClick={() => { const next = !overdueExpanded; setOverdueExpanded(next); try { localStorage.setItem('tasksOverdueExpanded', String(next)); } catch {} }}
                                            sx={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                cursor: 'pointer',
                                                flex: 1,
                                                '&:hover': { opacity: 0.7 },
                                            }}
                                        >
                                            {overdueExpanded ? <ExpandLessIcon fontSize="small" color="error" /> : <ExpandMoreIcon fontSize="small" color="error" />}
                                            <Typography variant="body2" color="error" sx={{ ml: 0.5, fontWeight: 600 }}>
                                                Overdue ({overdueTasks.length})
                                            </Typography>
                                        </Box>
                                        <IconButton
                                            size="small"
                                            onClick={(e) => setOverdueMenuAnchor(e.currentTarget)}
                                            aria-label="Overdue tasks options"
                                            disabled={rescheduling}
                                        >
                                            <MoreVertIcon fontSize="small" />
                                        </IconButton>
                                        <Menu
                                            anchorEl={overdueMenuAnchor}
                                            open={Boolean(overdueMenuAnchor)}
                                            onClose={() => setOverdueMenuAnchor(null)}
                                        >
                                            <MenuItem onClick={handleRescheduleOverdueToToday} disabled={rescheduling}>
                                                Reschedule all to today
                                            </MenuItem>
                                        </Menu>
                                    </Box>
                                    <Collapse in={overdueExpanded}>
                                        <Paper elevation={4} sx={{ width: '100%', borderRadius: 3 }}>
                                            <TransitionGroup component={List} disablePadding dense>
                                                {overdueTasks.map((task, index) => (
                                                    <Collapse key={task.recordID}>
                                                    <ListItem disablePadding divider={index < overdueTasks.length - 1}>
                                                        <ListItemIcon sx={{ minWidth: 36, ml: 1 }}>
                                                            <IconButton edge="start" size="small" onClick={() => completeTask(task.recordID)} aria-label="Complete task">
                                                                <RadioButtonUncheckedIcon color="action" />
                                                            </IconButton>
                                                        </ListItemIcon>
                                                        <ListItemButton onClick={() => navigate(`/tasks/${task.recordID}`)}>
                                                            <ListItemText
                                                                primary={task.title}
                                                                secondary={
                                                                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 0.5, justifyContent: 'space-between' }}>
                                                                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap'}}>
                                                                        {task.dueDate && (() => {
                                                                            const { label, color } = formatDueDate(task.dueDate);
                                                                            return <Chip label={label} size="small" variant="outlined" color={color} sx={{ height: 20, fontSize: '0.75rem' }} />;
                                                                        })()}
                                                                        {task.isRecurring && (
                                                                            <Chip icon={<RepeatIcon sx={{ fontSize: '0.85rem' }} />} label="Recurring" size="small" variant="outlined" color="secondary" sx={{ height: 20, fontSize: '0.75rem' }} />
                                                                        )}
                                                                        </Box>
                                                                        {task.projectID && projectNameMap.has(task.projectID) && (
                                                                            <Chip label={projectNameMap.get(task.projectID)} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.75rem' }} />
                                                                        )}
                                                                    </Box>
                                                                }
                                                                secondaryTypographyProps={{ component: 'div' }}
                                                            />
                                                        </ListItemButton>
                                                    </ListItem>
                                                    </Collapse>
                                                ))}
                                            </TransitionGroup>
                                        </Paper>
                                    </Collapse>
                                </Box>
                            )}

                            {dueTodayTasks.length > 0 && (
                                <Box sx={{ mb: 2 }}>
                                    <Box
                                        onClick={() => { const next = !dueTodayExpanded; setDueTodayExpanded(next); try { localStorage.setItem('tasksDueTodayExpanded', String(next)); } catch {} }}
                                        sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            cursor: 'pointer',
                                            mb: 0.5,
                                            px: 1,
                                            py: 0.5,
                                            borderRadius: 1,
                                            '&:hover': { opacity: 0.7 },
                                        }}
                                    >
                                        {dueTodayExpanded ? <ExpandLessIcon fontSize="small" color="warning" /> : <ExpandMoreIcon fontSize="small" color="warning" />}
                                        <Typography variant="body2" color="warning.main" sx={{ ml: 0.5, fontWeight: 600 }}>
                                            Due Today ({dueTodayTasks.length})
                                        </Typography>
                                    </Box>
                                    <Collapse in={dueTodayExpanded}>
                                        <Paper elevation={4} sx={{ width: '100%', borderRadius: 3 }}>
                                            <TransitionGroup component={List} disablePadding dense>
                                                {dueTodayTasks.map((task, index) => (
                                                    <Collapse key={task.recordID}>
                                                    <ListItem disablePadding divider={index < dueTodayTasks.length - 1}>
                                                        <ListItemIcon sx={{ minWidth: 36, ml: 1 }}>
                                                            <IconButton edge="start" size="small" onClick={() => completeTask(task.recordID)} aria-label="Complete task">
                                                                <RadioButtonUncheckedIcon color="action" />
                                                            </IconButton>
                                                        </ListItemIcon>
                                                        <ListItemButton onClick={() => navigate(`/tasks/${task.recordID}`)}>
                                                            <ListItemText
                                                                primary={task.title}
                                                                secondary={
                                                                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 0.5, justifyContent: 'space-between' }}>
                                                                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap'}}>
                                                                        {task.dueDate && (() => {
                                                                            const { label, color } = formatDueDate(task.dueDate);
                                                                            return <Chip label={label} size="small" variant="outlined" color={color} sx={{ height: 20, fontSize: '0.75rem' }} />;
                                                                        })()}
                                                                        {task.isRecurring && (
                                                                            <Chip icon={<RepeatIcon sx={{ fontSize: '0.85rem' }} />} label="Recurring" size="small" variant="outlined" color="secondary" sx={{ height: 20, fontSize: '0.75rem' }} />
                                                                        )}
                                                                        </Box>
                                                                        {task.projectID && projectNameMap.has(task.projectID) && (
                                                                            <Chip label={projectNameMap.get(task.projectID)} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.75rem' }} />
                                                                        )}
                                                                    </Box>
                                                                }
                                                                secondaryTypographyProps={{ component: 'div' }}
                                                            />
                                                        </ListItemButton>
                                                    </ListItem>
                                                    </Collapse>
                                                ))}
                                            </TransitionGroup>
                                        </Paper>
                                    </Collapse>
                                </Box>
                            )}

                            {upcomingTasks.length > 0 && (
                                <Box sx={{ mb: 2 }}>
                                    <Box
                                        onClick={() => { const next = !upcomingExpanded; setUpcomingExpanded(next); try { localStorage.setItem('tasksUpcomingExpanded', String(next)); } catch {} }}
                                        sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            cursor: 'pointer',
                                            mb: 0.5,
                                            px: 1,
                                            py: 0.5,
                                            borderRadius: 1,
                                            '&:hover': { opacity: 0.7 },
                                        }}
                                    >
                                        {upcomingExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                                        <Typography variant="body2" color="text.secondary" sx={{ ml: 0.5, fontWeight: 600 }}>
                                            Upcoming ({upcomingTasks.length})
                                        </Typography>
                                    </Box>
                                    <Collapse in={upcomingExpanded}>
                                        <Paper elevation={4} sx={{ width: '100%', borderRadius: 3 }}>
                                            <TransitionGroup component={List} disablePadding dense>
                                                {upcomingTasks.map((task, index) => (
                                                    <Collapse key={task.recordID}>
                                                    <ListItem disablePadding divider={index < upcomingTasks.length - 1}>
                                                        <ListItemIcon sx={{ minWidth: 36, ml: 1 }}>
                                                            <IconButton edge="start" size="small" onClick={() => completeTask(task.recordID)} aria-label="Complete task">
                                                                <RadioButtonUncheckedIcon color="action" />
                                                            </IconButton>
                                                        </ListItemIcon>
                                                        <ListItemButton onClick={() => navigate(`/tasks/${task.recordID}`)}>
                                                            <ListItemText
                                                                primary={task.title}
                                                                secondary={
                                                                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 0.5, justifyContent: 'space-between' }}>
                                                                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap'}}>
                                                                        {task.dueDate && (() => {
                                                                            const { label, color } = formatDueDate(task.dueDate);
                                                                            return <Chip label={label} size="small" variant="outlined" color={color} sx={{ height: 20, fontSize: '0.75rem' }} />;
                                                                        })()}
                                                                        {task.isRecurring && (
                                                                            <Chip icon={<RepeatIcon sx={{ fontSize: '0.85rem' }} />} label="Recurring" size="small" variant="outlined" color="secondary" sx={{ height: 20, fontSize: '0.75rem' }} />
                                                                        )}
                                                                        </Box>
                                                                        {task.projectID && projectNameMap.has(task.projectID) && (
                                                                            <Chip label={projectNameMap.get(task.projectID)} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.75rem' }} />
                                                                        )}
                                                                    </Box>
                                                                }
                                                                secondaryTypographyProps={{ component: 'div' }}
                                                            />
                                                        </ListItemButton>
                                                    </ListItem>
                                                    </Collapse>
                                                ))}
                                            </TransitionGroup>
                                        </Paper>
                                    </Collapse>
                                </Box>
                            )}

                            {noDueDateTasks.length > 0 && (
                                <Box sx={{ mb: 2 }}>
                                    <Box
                                        onClick={() => { const next = !noDueDateExpanded; setNoDueDateExpanded(next); try { localStorage.setItem('tasksNoDueDateExpanded', String(next)); } catch {} }}
                                        sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            cursor: 'pointer',
                                            mb: 0.5,
                                            px: 1,
                                            py: 0.5,
                                            borderRadius: 1,
                                            '&:hover': { opacity: 0.7 },
                                        }}
                                    >
                                        {noDueDateExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                                        <Typography variant="body2" color="text.secondary" sx={{ ml: 0.5, fontWeight: 600 }}>
                                            No Due Date ({noDueDateTasks.length})
                                        </Typography>
                                    </Box>
                                    <Collapse in={noDueDateExpanded}>
                                        <Paper elevation={4} sx={{ width: '100%', borderRadius: 3 }}>
                                            <TransitionGroup component={List} disablePadding dense>
                                                {noDueDateTasks.map((task, index) => (
                                                    <Collapse key={task.recordID}>
                                                    <ListItem disablePadding divider={index < noDueDateTasks.length - 1}>
                                                        <ListItemIcon sx={{ minWidth: 36, ml: 1 }}>
                                                            <IconButton edge="start" size="small" onClick={() => completeTask(task.recordID)} aria-label="Complete task">
                                                                <RadioButtonUncheckedIcon color="action" />
                                                            </IconButton>
                                                        </ListItemIcon>
                                                        <ListItemButton onClick={() => navigate(`/tasks/${task.recordID}`)}>
                                                            <ListItemText
                                                                primary={task.title}
                                                                secondary={
                                                                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 0.5, justifyContent: 'space-between' }}>
                                                                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap'}}>
                                                                        {task.isRecurring && (
                                                                            <Chip icon={<RepeatIcon sx={{ fontSize: '0.85rem' }} />} label="Recurring" size="small" variant="outlined" color="secondary" sx={{ height: 20, fontSize: '0.75rem' }} />
                                                                        )}
                                                                        </Box>
                                                                        {task.projectID && projectNameMap.has(task.projectID) && (
                                                                            <Chip label={projectNameMap.get(task.projectID)} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.75rem' }} />
                                                                        )}
                                                                    </Box>
                                                                }
                                                                secondaryTypographyProps={{ component: 'div' }}
                                                            />
                                                        </ListItemButton>
                                                    </ListItem>
                                                    </Collapse>
                                                ))}
                                            </TransitionGroup>
                                        </Paper>
                                    </Collapse>
                                </Box>
                            )}
                        </>
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
                                    onClick={() => { const next = !completedExpanded; setCompletedExpanded(next); try { localStorage.setItem('tasksCompletedExpanded', String(next)); } catch {} }}
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
                            <Collapse in={completedExpanded} sx={{mb:7}}>
                            <Paper elevation={4} sx={{ width: '100%', borderRadius: 3 }}>
                                <TransitionGroup component={List} disablePadding dense>
                                    {completedTasks.map((task, index) => (
                                        <Collapse key={task.recordID}>
                                        <ListItem disablePadding divider={index < completedTasks.length - 1}>
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
                                                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 0.5, justifyContent: 'space-between' }}>
                                                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap'}}>
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
                                                            {task.projectID && projectNameMap.has(task.projectID) && (
                                                                <Chip
                                                                    label={projectNameMap.get(task.projectID)}
                                                                    size="small"
                                                                    variant="outlined"
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
                                        </Collapse>
                                    ))}
                                </TransitionGroup>
                                </Paper>
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
