import React, { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Checkbox from "@mui/material/Checkbox";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import Alert from "@mui/material/Alert";
import Divider from "@mui/material/Divider";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogActions from "@mui/material/DialogActions";
import CircularProgress from "@mui/material/CircularProgress";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import DeleteIcon from "@mui/icons-material/Delete";
import CloseIcon from "@mui/icons-material/Close";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import AddIcon from "@mui/icons-material/Add";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ReplayIcon from "@mui/icons-material/Replay";
import Grid from "@mui/material/Grid";
import Menu from "@mui/material/Menu";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";

import { useTaskStore } from "../store/taskStore";
import { useProjectStore } from "../store/projectStore";
import { dialogPaperStyles, useGlobalStore } from "../store/globalStore";
import { useOfflineStore } from "../store/offlineStore";
import { validateTaskTitle } from "../lib/validation";
import { isSharedItem } from "../lib/sharing";
import { supabase } from "../lib/supabase";
import type { Task, Subtask, ProjectShared, NoteShared } from "../types";

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const tasks = useTaskStore((s) => s.tasks);
  const subtasks = useTaskStore((s) => s.subtasks);
  const updateTask = useTaskStore((s) => s.updateTask);
  const completeTask = useTaskStore((s) => s.completeTask);
  const reopenTask = useTaskStore((s) => s.reopenTask);
  const deleteTask = useTaskStore((s) => s.deleteTask);
  const fetchSubtasks = useTaskStore((s) => s.fetchSubtasks);
  const addSubtask = useTaskStore((s) => s.addSubtask);
  const toggleSubtask = useTaskStore((s) => s.toggleSubtask);
  const deleteSubtask = useTaskStore((s) => s.deleteSubtask);
  const updateSubtaskTitle = useTaskStore((s) => s.updateSubtaskTitle);
  const storeError = useTaskStore((s) => s.error);

  const projects = useProjectStore((s) => s.projects);
  const currentUser = useGlobalStore((s) => s.currentUser);
  const setSnackText = useGlobalStore((s) => s.setSnackBarText);
  const setSnackSev = useGlobalStore((s) => s.setSnackBarSeverity);
  const setSnackOpen = useGlobalStore((s) => s.setSnackBarOpen);
  const isOnline = useOfflineStore((s) => s.isOnline);

  const [task, setTask] = useState<Task | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [dueDate, setDueDate] = useState<dayjs.Dayjs | null>(null);
  const [projectID, setProjectID] = useState<string | null>(null);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceInterval, setRecurrenceInterval] = useState<number>(1);
  const [recurrenceUnit, setRecurrenceUnit] = useState<
    "days" | "weeks" | "months"
  >("days");
  const [recurrenceAnchor, setRecurrenceAnchor] = useState<
    "due_date" | "completed_date"
  >("due_date");

  const [titleError, setTitleError] = useState<string | null>(null);
  const [subtaskError, setSubtaskError] = useState<string | null>(null);
  const [focusedSubtaskId, setFocusedSubtaskId] = useState<string | null>(null);
  const [selectedSubtaskId, setSelectedSubtaskId] = useState<string | null>(
    null,
  );
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [abandonDialogOpen, setAbandonDialogOpen] = useState(false);
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const menuOpen = Boolean(menuAnchorEl);
  const [loading, setLoading] = useState(true);
  const [isShared, setIsShared] = useState(false);
  const [offlineMessage, setOfflineMessage] = useState<string | null>(null);

  const isCreator = task?.creatorID === currentUser.recordID;
  const taskSubtasks = id ? subtasks[id] || [] : [];

  // Load task data
  useEffect(() => {
    if (!id) return;

    // Read latest store state directly to avoid stale closure from render
    const storeState = useTaskStore.getState();
    const foundTask = storeState.tasks.find((t) => t.recordID === id);
    if (foundTask) {
      loadTaskData(foundTask);
      setLoading(false);
    } else {
      // Task not in local state, try fetching from server
      fetchTaskFromServer(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Fetch subtasks when task is loaded
  useEffect(() => {
    if (id) {
      fetchSubtasks(id);
    }
  }, [id]);

  // Check if item is shared
  useEffect(() => {
    if (!task) return;
    checkIfShared(task);
  }, [task, currentUser.recordID]);

  const checkIfShared = async (t: Task) => {
    try {
      // Fetch project shares to determine if item is shared
      let projectShares: ProjectShared[] = [];
      if (t.projectID) {
        const { data } = await supabase
          .from("task_projects_shared")
          .select("*")
          .eq("projectID", t.projectID);
        projectShares = (data || []) as ProjectShared[];
      }

      const noteShares: NoteShared[] = []; // Tasks don't have direct note shares
      const shared = isSharedItem(
        t,
        currentUser.recordID,
        noteShares,
        projectShares,
      );
      setIsShared(shared);

      // If shared and offline, show message
      if (shared && !isOnline) {
        setOfflineMessage(
          "Shared items require an internet connection to view and edit.",
        );
      } else {
        setOfflineMessage(null);
      }
    } catch {
      // If we can't check, assume not shared
      setIsShared(false);
    }
  };

  const fetchTaskFromServer = async (taskId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("recordID", taskId)
        .single();

      if (error || !data) {
        setNetworkError("Task not found");
        setLoading(false);
        return;
      }

      const fetchedTask = data as Task;
      loadTaskData(fetchedTask);
    } catch (err: any) {
      setNetworkError(err.message || "Failed to load task");
    } finally {
      setLoading(false);
    }
  };

  const loadTaskData = (t: Task) => {
    setTask(t);
    setTitle(t.title);
    setBody(t.body);
    setDueDate(t.dueDate ? dayjs(t.dueDate) : null);
    setProjectID(t.projectID);
    setIsRecurring(t.isRecurring);
    setRecurrenceInterval(t.recurrenceInterval || 1);
    setRecurrenceUnit(t.recurrenceUnit || "days");
    setRecurrenceAnchor(t.recurrenceAnchor || "due_date");
  };

  // Debounced save for title
  const saveTitle = useCallback(
    async (newTitle: string) => {
      if (!id) return;
      // Allow empty title (for new blank tasks) — just skip validation
      if (newTitle.trim().length === 0) {
        setTitleError(null);
        return;
      }
      const validation = validateTaskTitle(newTitle);
      if (!validation.valid) {
        setTitleError(validation.error || "Invalid title");
        return;
      }
      setTitleError(null);
      const success = await updateTask(id, { title: newTitle });
      if (!success) {
        setNetworkError("Failed to save title");
      } else {
        setNetworkError(null);
      }
    },
    [id, updateTask],
  );

  // Debounced save for body
  const saveBody = useCallback(
    async (newBody: string) => {
      if (!id) return;
      const success = await updateTask(id, { body: newBody });
      if (!success) {
        setNetworkError("Failed to save body");
      } else {
        setNetworkError(null);
      }
    },
    [id, updateTask],
  );

  // Use debounce effect for title
  useEffect(() => {
    if (!task || title === task.title) return;
    const timer = setTimeout(() => saveTitle(title), 1200);
    return () => clearTimeout(timer);
  }, [title, task?.title]);

  // Use debounce effect for body
  useEffect(() => {
    if (!task || body === task.body) return;
    const timer = setTimeout(() => saveBody(body), 1200);
    return () => clearTimeout(timer);
  }, [body, task?.body]);

  // Refs to hold latest values for flush without causing effect re-runs
  const titleRef = useRef(title);
  const bodyRef = useRef(body);
  const taskRef = useRef(task);
  titleRef.current = title;
  bodyRef.current = body;
  taskRef.current = task;

  // Flush any pending title/body saves immediately (on unmount or back navigation)
  const flushPendingSaves = useCallback(async () => {
    if (!id || !taskRef.current) return;
    if (
      titleRef.current !== taskRef.current.title &&
      titleRef.current.trim().length > 0
    ) {
      await saveTitle(titleRef.current);
    }
    if (bodyRef.current !== taskRef.current.body) {
      await saveBody(bodyRef.current);
    }
  }, [id, saveTitle, saveBody]);

  // Flush on unmount only
  useEffect(() => {
    return () => {
      flushPendingSaves();
    };
  }, [flushPendingSaves]);

  const handleDueDateChange = async (newDate: dayjs.Dayjs | null) => {
    if (!id) return;
    setDueDate(newDate);
    const dueDateValue = newDate ? newDate.valueOf() : null;
    const success = await updateTask(id, { dueDate: dueDateValue });
    if (!success) {
      setNetworkError("Failed to save due date");
    } else {
      setNetworkError(null);
    }
  };

  const handleProjectChange = async (newProjectID: string) => {
    if (!id) return;
    const value = newProjectID === "" ? null : newProjectID;
    setProjectID(value);
    const success = await updateTask(id, { projectID: value });
    if (!success) {
      setNetworkError("Failed to save project assignment");
    } else {
      setNetworkError(null);
    }
  };

  const handleCompleteReopen = async () => {
    if (!id || !task) return;
    let success: boolean;
    if (task.status === "open") {
      success = await completeTask(id);
    } else {
      success = await reopenTask(id);
    }
    if (!success) {
      setNetworkError("Failed to update task status");
    } else {
      setNetworkError(null);
      if (task.status === "open") {
        navigate(-1);
      } else {
        setTask({
          ...task,
          status: "open",
        });
      }
    }
  };

  const handleRecurrenceToggle = async (checked: boolean) => {
    if (!id) return;
    setIsRecurring(checked);
    const success = await updateTask(id, {
      isRecurring: checked,
      recurrenceInterval: checked ? recurrenceInterval : null,
      recurrenceUnit: checked ? recurrenceUnit : null,
      recurrenceAnchor: checked ? recurrenceAnchor : "due_date",
    });
    if (!success) {
      setNetworkError("Failed to save recurrence settings");
    } else {
      setNetworkError(null);
    }
  };

  const handleRecurrenceIntervalChange = async (value: string) => {
    if (!id) return;
    const num = parseInt(value, 10);
    if (isNaN(num) || num < 1 || num > 365) return;
    setRecurrenceInterval(num);
    const success = await updateTask(id, { recurrenceInterval: num });
    if (!success) {
      setNetworkError("Failed to save recurrence interval");
    } else {
      setNetworkError(null);
    }
  };

  const handleRecurrenceUnitChange = async (
    value: "days" | "weeks" | "months",
  ) => {
    if (!id) return;
    setRecurrenceUnit(value);
    const success = await updateTask(id, { recurrenceUnit: value });
    if (!success) {
      setNetworkError("Failed to save recurrence unit");
    } else {
      setNetworkError(null);
    }
  };

  const handleRecurrenceAnchorChange = async (
    value: "due_date" | "completed_date",
  ) => {
    if (!id) return;
    setRecurrenceAnchor(value);
    const success = await updateTask(id, { recurrenceAnchor: value });
    if (!success) {
      setNetworkError("Failed to save recurrence anchor");
    } else {
      setNetworkError(null);
    }
  };

  const handleAddSubtask = async () => {
    if (!id) return;
    setSubtaskError(null);
    const result = await addSubtask(id, "");
    if (result) {
      setFocusedSubtaskId(result.recordID);
    } else {
      setSubtaskError(storeError || "Failed to add subtask");
    }
  };

  const handleToggleSubtask = async (subtaskID: string) => {
    const success = await toggleSubtask(subtaskID);
    if (!success) {
      setNetworkError("Failed to toggle subtask");
    }
  };

  const handleDeleteSubtask = async (subtaskID: string) => {
    const success = await deleteSubtask(subtaskID);
    if (!success) {
      setNetworkError("Failed to delete subtask");
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    setDeleteDialogOpen(false);
    const success = await deleteTask(id);
    if (success) {
      navigate(-1);
    } else {
      setNetworkError("Failed to delete task");
    }
  };

  const isTaskBlank = () => {
    return title.trim().length === 0 && body.trim().length === 0;
  };

  const handleBack = async () => {
    await flushPendingSaves();
    if (isTaskBlank()) {
      handleAbandonDelete();
    } else {
      navigate(-1);
    }
  };

  const handleAbandonDelete = () => {
    if (!id) return;
    // Navigate immediately to avoid glitch where the task briefly appears on the list
    setSnackText('Empty task discarded');
    setSnackSev('info');
    setSnackOpen(true);
    navigate(-1);
    // Fire-and-forget: store already removes the task optimistically
    deleteTask(id);
  };

  // Show loading state — return null to avoid flashing UI for the common case
  // where the task is found in the local store within a single frame.
  if (loading) {
    return null;
  }

  // Show offline message for shared items
  if (offlineMessage) {
    return (
      <Box sx={{ p: 2 }}>
        <IconButton
          onClick={() => navigate(-1)}
          aria-label="Back"
          sx={{ mb: 1 }}
        >
          <ArrowBackIcon />
        </IconButton>
        <Alert severity="warning">{offlineMessage}</Alert>
      </Box>
    );
  }

  // Task not found
  if (!task && !loading) {
    return (
      <Box sx={{ p: 2 }}>
        <IconButton
          onClick={() => navigate(-1)}
          aria-label="Back"
          sx={{ mb: 1 }}
        >
          <ArrowBackIcon />
        </IconButton>
        <Alert severity="error">{networkError || "Task not found"}</Alert>
      </Box>
    );
  }

  if (!task) return null;

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box sx={{ pb: 10, maxWidth: 600, mx: "auto" }}>
        {/* Header with back button and menu */}
        <Box
          display="flex"
          alignItems="flex-start"
          justifyContent="space-between"
          sx={{ mb: 1 }}
        >
          <IconButton onClick={handleBack} aria-label="Back">
            <ArrowBackIcon />
          </IconButton>
          {/* Project assignment */}
          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel>Project</InputLabel>
            <Select
              value={projectID || ""}
              onChange={(e) => handleProjectChange(e.target.value)}
              label="Project"
              disabled={isShared && !isOnline}
            >
              <MenuItem value="">
                <em>None</em>
              </MenuItem>
              {projects.map((p) => (
                <MenuItem key={p.recordID} value={p.recordID}>
                  {p.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {isCreator && (
            <>
              <IconButton
                onClick={(e) => setMenuAnchorEl(e.currentTarget)}
                aria-label="More options"
                aria-controls={menuOpen ? "task-actions-menu" : undefined}
                aria-haspopup="true"
                aria-expanded={menuOpen ? "true" : undefined}
              >
                <MoreVertIcon />
              </IconButton>
              <Menu
                id="task-actions-menu"
                anchorEl={menuAnchorEl}
                open={menuOpen}
                onClose={() => setMenuAnchorEl(null)}
              >
                <MenuItem
                  onClick={() => {
                    setMenuAnchorEl(null);
                    setDeleteDialogOpen(true);
                  }}
                >
                  <ListItemIcon>
                    <DeleteIcon fontSize="small" color="error" />
                  </ListItemIcon>
                  <ListItemText sx={{ color: "error.main" }}>
                    Delete
                  </ListItemText>
                </MenuItem>
              </Menu>
            </>
          )}
        </Box>

        {/* Error messages */}
        {networkError && (
          <Alert
            severity="error"
            sx={{ mb: 2 }}
            onClose={() => setNetworkError(null)}
          >
            {networkError}
          </Alert>
        )}
        {storeError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {storeError}
          </Alert>
        )}

        {/* Title input */}
        <TextField
          fullWidth
          multiline
          variant="standard"
          placeholder="Untitled"
          value={title}
          onChange={(e) => {
            const val = e.target.value;
            if (val.length <= 255) {
              setTitle(val);
              const validation = validateTaskTitle(val);
              setTitleError(validation.valid ? null : validation.error || null);
            }
          }}
          autoFocus={task.title.trim().length === 0}
          error={!!titleError}
          helperText={titleError || `${title.trim().length}/255`}
          sx={{
            mb: 2,
            "& .MuiInput-input": { fontSize: "1.5rem", fontWeight: 500 },
          }}
          disabled={isShared && !isOnline}
        />

        {/* Body textarea */}
        <TextField
          fullWidth
          label="Description"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          multiline
          minRows={3}
          maxRows={10}
          sx={{ mb: 2 }}
          disabled={isShared && !isOnline}
        />

        {/* Due date picker and Complete/Reopen button */}
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <DatePicker
              label="Due Date"
              value={dueDate}
              onChange={handleDueDateChange}
              slotProps={{
                textField: { fullWidth: true },
                field: { clearable: true },
                actionBar: { actions: ['today', 'clear'] },
              }}
              disabled={isShared && !isOnline}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Button
              fullWidth
              variant="contained"
              color={task.status === "open" ? "success" : "warning"}
              onClick={handleCompleteReopen}
              sx={{ height: "100%" }}
              disabled={isShared && !isOnline}
              startIcon={
                task.status === "open" ? <CheckCircleIcon /> : <ReplayIcon />
              }
            >
              {task.status === "open" ? "Complete" : "Reopen Task"}
            </Button>
          </Grid>
        </Grid>

        <Divider sx={{ my: 2 }} />

        {/* Recurrence settings */}
        <FormControlLabel
          control={
            <Switch
              checked={isRecurring}
              onChange={(e) => handleRecurrenceToggle(e.target.checked)}
              disabled={isShared && !isOnline}
            />
          }
          label="Recurring"
          sx={{ mb: 1, display: "block" }}
        />

        {isRecurring && (
          <Box sx={{ pl: 2, mb: 2 }}>
            <Grid container spacing={2} alignItems="center">
              {/* Interval with up/down buttons */}
              <Grid size={{ xs: 12, sm: 4 }}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ mb: 0.5, display: "block" }}
                >
                  Interval
                </Typography>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <IconButton
                    size="small"
                    onClick={() => {
                      if (recurrenceInterval > 1) {
                        handleRecurrenceIntervalChange(
                          String(recurrenceInterval - 1),
                        );
                      }
                    }}
                    disabled={
                      (isShared && !isOnline) || recurrenceInterval <= 1
                    }
                    aria-label="Decrease interval"
                  >
                    <KeyboardArrowDownIcon />
                  </IconButton>
                  <Typography
                    variant="h6"
                    sx={{ minWidth: 32, textAlign: "center" }}
                  >
                    {recurrenceInterval}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={() => {
                      if (recurrenceInterval < 365) {
                        handleRecurrenceIntervalChange(
                          String(recurrenceInterval + 1),
                        );
                      }
                    }}
                    disabled={
                      (isShared && !isOnline) || recurrenceInterval >= 365
                    }
                    aria-label="Increase interval"
                  >
                    <KeyboardArrowUpIcon />
                  </IconButton>
                </Box>
              </Grid>
              {/* Unit as button group */}
              <Grid size={{ xs: 12, sm: 4 }}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ mb: 0.5, display: "block" }}
                >
                  Unit
                </Typography>
                <ToggleButtonGroup
                  value={recurrenceUnit}
                  exclusive
                  onChange={(_, val) => {
                    if (val) handleRecurrenceUnitChange(val);
                  }}
                  size="small"
                  fullWidth
                  disabled={isShared && !isOnline}
                >
                  <ToggleButton value="days">Days</ToggleButton>
                  <ToggleButton value="weeks">Weeks</ToggleButton>
                  <ToggleButton value="months">Months</ToggleButton>
                </ToggleButtonGroup>
              </Grid>
              {/* Anchor as button group */}
              <Grid size={{ xs: 12, sm: 4 }}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ mb: 0.5, display: "block" }}
                >
                  Repeated from
                </Typography>
                <ToggleButtonGroup
                  value={recurrenceAnchor}
                  exclusive
                  onChange={(_, val) => {
                    if (val) handleRecurrenceAnchorChange(val);
                  }}
                  size="small"
                  fullWidth
                  disabled={isShared && !isOnline}
                >
                  <ToggleButton value="due_date">Due Date</ToggleButton>
                  <ToggleButton value="completed_date">Completed</ToggleButton>
                </ToggleButtonGroup>
              </Grid>
            </Grid>
          </Box>
        )}

        <Divider sx={{ my: 2 }} />

        {/* Subtasks section */}
        <Typography variant="h6">Subtasks</Typography>
        <Typography variant="caption" gutterBottom color="textSecondary">
          ({taskSubtasks.length}/50)
        </Typography>

        <List dense>
          {taskSubtasks.map((st: Subtask) => (
            <ListItem
              key={st.recordID}
              disablePadding
              sx={{ display: "flex", alignItems: "center" }}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>
                <Checkbox
                  edge="start"
                  checked={st.isCompleted}
                  onChange={() => handleToggleSubtask(st.recordID)}
                  disabled={isShared && !isOnline}
                />
              </ListItemIcon>
              <TextField
                variant="standard"
                fullWidth
                autoFocus={st.recordID === focusedSubtaskId}
                onFocus={() => {
                  if (st.recordID === focusedSubtaskId)
                    setFocusedSubtaskId(null);
                  setSelectedSubtaskId(st.recordID);
                }}
                onBlur={() => {
                  if (selectedSubtaskId === st.recordID)
                    setSelectedSubtaskId(null);
                }}
                value={st.title}
                onChange={(e) =>
                  updateSubtaskTitle(st.recordID, e.target.value)
                }
                disabled={isShared && !isOnline}
                inputProps={{ maxLength: 255 }}
                sx={{
                  flex: 1,
                  minWidth: 0,
                  "& .MuiInput-input": {
                    py: 0.5,
                    textDecoration: st.isCompleted ? "line-through" : "none",
                    opacity: st.isCompleted ? 0.6 : 1,
                  },
                }}
              />
              {isCreator && selectedSubtaskId === st.recordID && (
                <IconButton
                  aria-label="delete subtask"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleDeleteSubtask(st.recordID)}
                  size="small"
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              )}
            </ListItem>
          ))}
        </List>

        {/* Add subtask */}
        {taskSubtasks.length < 50 && (
          <Button
            fullWidth
            size="small"
            startIcon={<AddIcon />}
            onClick={handleAddSubtask}
            disabled={isShared && !isOnline}
            sx={{ mt: 1, ml: 1, textTransform: "none" }}
          >
            Add Subtask
          </Button>
        )}

        {/* Delete confirmation dialog */}
        <Dialog
          open={deleteDialogOpen}
          onClose={() => setDeleteDialogOpen(false)}
          slotProps={{ paper: dialogPaperStyles }}
        >
          <Box sx={{ bgcolor: "background.paper", height: "100%" }}>
            <DialogTitle>Delete Task</DialogTitle>
            <DialogContent>
              <DialogContentText>
                Are you sure you want to delete this task? This action cannot be
                undone. All subtasks will also be removed.
              </DialogContentText>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleDelete} color="error" variant="contained">
                Delete
              </Button>
            </DialogActions>
          </Box>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
}
