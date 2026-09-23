import React from "react";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Fab from "@mui/material/Fab";
import AddIcon from "@mui/icons-material/Add";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import FolderOutlinedIcon from "@mui/icons-material/FolderOutlined";
import { useNavigate, useParams } from "react-router-dom";
import { useProjectStore } from '@simpletracker/core';
import { useNoteStore } from '@simpletracker/core';
import { useTaskStore } from '@simpletracker/core';
import { useGlobalStore } from "../store/globalStore";
import { useEntitlement } from "../lib/checkout";
import { supabase } from "../lib/supabase";
import Fade from "@mui/material/Fade";
import Paper from "@mui/material/Paper";

export default function ProjectsPage() {
  const projects = useProjectStore((s) => s.projects);
  const loading = useProjectStore((s) => s.loading);
  const error = useProjectStore((s) => s.error);
  const fetchProjects = useProjectStore((s) => s.fetchProjects);
  const createBlankProject = useProjectStore((s) => s.createBlankProject);
  const notes = useNoteStore((s) => s.notes);
  const sharedNotes = useNoteStore((s) => s.sharedNotes);
  const tasks = useTaskStore((s) => s.tasks);
  const currentUserID = useGlobalStore((s) => s.currentUser.recordID);
  const navigate = useNavigate();
  const { id: selectedProjectID } = useParams<{ id: string }>();

  const [sharedByMeProjectIDs, setSharedByMeProjectIDs] = React.useState<
    Set<string>
  >(() => {
    try {
      const raw = localStorage.getItem('cachedSharedByMeProjectIDs');
      if (raw) return new Set(JSON.parse(raw) as string[]);
    } catch { /* ignore */ }
    return new Set();
  });
  // Map projectID -> first sharedToID for showing the avatar
  const [sharedByMeProjectUserMap, setSharedByMeProjectUserMap] = React.useState<Map<string, string>>(() => {
    try {
      const raw = localStorage.getItem('cachedSharedByMeProjectUserMap');
      if (raw) return new Map(JSON.parse(raw) as [string, string][]);
    } catch { /* ignore */ }
    return new Map();
  });
  // Track whether the page is ready to display (initial fetch + shared info loaded)
  const [pageReady, setPageReady] = React.useState(false);
  const hasFetchedShared = React.useRef(
    (() => {
      try {
        return localStorage.getItem('cachedSharedByMeProjectIDs') !== null;
      } catch { return false; }
    })()
  );

  const { subscriptionState, loading: entitlementLoading } = useEntitlement();
  const hasPro = entitlementLoading || subscriptionState !== "free";
  const FREE_PROJECT_LIMIT = 3;
  const ownedProjects = projects.filter((p) => p.creatorID === currentUserID);
  const atProjectLimit = !hasPro && ownedProjects.length >= FREE_PROJECT_LIMIT;

  React.useEffect(() => {
    fetchProjects();
  }, []);

  // Fetch which of my projects are shared with others
  React.useEffect(() => {
    const fetchSharedByMe = async () => {
      const ownedProjectIDs = projects
        .filter((p) => p.creatorID === currentUserID)
        .map((p) => p.recordID);
      if (ownedProjectIDs.length === 0) {
        setSharedByMeProjectIDs(new Set());
        setSharedByMeProjectUserMap(new Map());
        try {
          localStorage.setItem('cachedSharedByMeProjectIDs', '[]');
          localStorage.setItem('cachedSharedByMeProjectUserMap', '[]');
        } catch { /* ignore */ }
        hasFetchedShared.current = true;
        if (!loading) setPageReady(true);
        return;
      }
      const { data } = await supabase
        .from("task_projects_shared")
        .select("projectID, sharedToID")
        .in("projectID", ownedProjectIDs);
      if (data) {
        const ids = new Set(data.map((r) => r.projectID));
        const userMap = new Map<string, string>();
        for (const r of data) {
          if (!userMap.has(r.projectID)) {
            userMap.set(r.projectID, r.sharedToID);
          }
        }
        setSharedByMeProjectIDs(ids);
        setSharedByMeProjectUserMap(userMap);
        try {
          localStorage.setItem('cachedSharedByMeProjectIDs', JSON.stringify([...ids]));
          localStorage.setItem('cachedSharedByMeProjectUserMap', JSON.stringify([...userMap.entries()]));
        } catch { /* ignore */ }
      }
      hasFetchedShared.current = true;
      if (!loading) setPageReady(true);
    };
    fetchSharedByMe();
  }, [projects, currentUserID]);

  // Mark page ready once loading finishes and shared data has been fetched at least once
  React.useEffect(() => {
    if (!loading && hasFetchedShared.current) {
      setPageReady(true);
    }
  }, [loading]);

  // Sort projects by total associated objects (notes + tasks) descending
  const sortedProjects = React.useMemo(() => {
    const allNotes = [...notes, ...sharedNotes];
    return [...projects].sort((a, b) => {
      const aCount =
        allNotes.filter((n) => n.projectID === a.recordID).length +
        tasks.filter((t) => t.projectID === a.recordID).length;
      const bCount =
        allNotes.filter((n) => n.projectID === b.recordID).length +
        tasks.filter((t) => t.projectID === b.recordID).length;
      return bCount - aCount;
    });
  }, [projects, notes, sharedNotes, tasks]);

  const handleCreateProject = async () => {
    if (atProjectLimit) return;
    const project = await createBlankProject();
    navigate(`/projects/${project.recordID}`, { state: { editing: true } });
  };

  return (
    <Box sx={{ maxWidth: 600, mx: "auto" }}>
      {!pageReady && (
        <Box display="flex" justifyContent="center" sx={{ mt: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {pageReady && error && (
        <Typography color="error" variant="body2" sx={{ mt: 1 }}>
          {error}
        </Typography>
      )}

      {pageReady && sortedProjects.length === 0 && (
        <Typography variant="body1" color="text.secondary" sx={{ mt: 2 }}>
          No projects yet. Create one to get started.
        </Typography>
      )}

      {pageReady && sortedProjects.length > 0 && (
        <Fade in timeout={300}>
          <Box sx={{ pt: 0.5 }}>
            <Box sx={{ px: 0.5, pb: 1.5 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Your projects
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {projects.length} {projects.length === 1 ? "project" : "projects"} · Organized by activity
              </Typography>
            </Box>

            <Stack spacing={1.25}>
              {sortedProjects.map((project) => {
                const allNotes = [...notes, ...sharedNotes];
                const noteCount = allNotes.filter(
                  (n) => n.projectID === project.recordID,
                ).length;
                const taskCount = tasks.filter(
                  (t) => t.projectID === project.recordID,
                ).length;
                const completedTaskCount = tasks.filter(
                  (t) =>
                    t.projectID === project.recordID && t.status === "completed",
                ).length;
                const overdueTaskCount = (() => {
                  const now = new Date();
                  const todayStart = new Date(
                    now.getFullYear(),
                    now.getMonth(),
                    now.getDate(),
                  ).getTime();
                  return tasks.filter(
                    (t) =>
                      t.projectID === project.recordID &&
                      t.status === "open" &&
                      t.dueDate != null &&
                      t.dueDate < todayStart,
                  ).length;
                })();
                const isSharedToMe = currentUserID ? project.creatorID !== currentUserID : false;
                const isSharedByMe = sharedByMeProjectIDs.has(project.recordID);
                const selected = project.recordID === selectedProjectID;

                return (
                  <Paper
                    key={project.recordID}
                    aria-current={selected ? "true" : undefined}
                    sx={{
                      position: "relative",
                      borderRadius: "20px",
                      border: "1px solid",
                      borderColor: selected
                        ? "primary.main"
                        : isSharedToMe || isSharedByMe
                          ? "info.main"
                          : "divider",
                      boxShadow: selected
                        ? (theme) => `0 0 0 1px ${theme.palette.primary.main}`
                        : "none",
                      cursor: "pointer",
                      overflow: "hidden",
                      transition: "background-color 0.15s ease, box-shadow 0.15s ease",
                      bgcolor: selected ? "action.selected" : undefined,
                      "&:hover": { bgcolor: selected ? "action.selected" : "action.hover" },
                      // Sliding accent bar on the left edge of the selected item.
                      "&::before": {
                        content: '""',
                        position: "absolute",
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: 4,
                        bgcolor: "primary.main",
                        borderTopLeftRadius: "20px",
                        borderBottomLeftRadius: "20px",
                        transform: selected ? "scaleX(1)" : "scaleX(0)",
                        transformOrigin: "left center",
                        opacity: selected ? 1 : 0,
                        transition: "transform 0.2s ease, opacity 0.2s ease",
                      },
                    }}
                    onClick={() => navigate(`/projects/${project.recordID}`)}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", px: 2, py: 1.5, gap: 1.5 }}>
                      <Box
                        sx={{
                          flexShrink: 0,
                          width: 44,
                          height: 44,
                          borderRadius: "15px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          bgcolor: "action.selected",
                          color: "primary.main",
                        }}
                      >
                        <FolderOutlinedIcon fontSize="small" />
                      </Box>

                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
                          <Typography
                            variant="subtitle2"
                            noWrap
                            sx={{ fontWeight: 600, minWidth: 0 }}
                          >
                            {project.name || "(untitled)"}
                          </Typography>
                          {isSharedToMe && (
                            <Tooltip title="Shared with you">
                              <Avatar
                                src={`https://api.dicebear.com/9.x/shapes/svg?seed=${project.creatorID}`}
                                sx={{ width: 18, height: 18 }}
                              />
                            </Tooltip>
                          )}
                          {isSharedByMe && (
                            <Tooltip title="Shared with others">
                              <Avatar
                                src={`https://api.dicebear.com/9.x/shapes/svg?seed=${sharedByMeProjectUserMap.get(project.recordID) || ''}`}
                                sx={{ width: 18, height: 18 }}
                              />
                            </Tooltip>
                          )}
                        </Box>
                        <Typography variant="body2" color="text.secondary" noWrap>
                          {project.description?.trim() || "No description yet"}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {noteCount} {noteCount === 1 ? "note" : "notes"} · {completedTaskCount}/{taskCount} tasks complete
                        </Typography>
                      </Box>

                      {overdueTaskCount > 0 && (
                        <Typography
                          variant="caption"
                          color="error"
                          sx={{ flexShrink: 0, fontWeight: 600, textAlign: "right" }}
                        >
                          {overdueTaskCount} overdue
                        </Typography>
                      )}
                    </Box>
                  </Paper>
                );
              })}
            </Stack>
          </Box>
        </Fade>
      )}

      {atProjectLimit && (
        <Alert severity="info" sx={{ mt: 2, maxWidth: 600, mx: "auto" }}>
          Free plan is limited to {FREE_PROJECT_LIMIT} projects. Upgrade to Pro
          for unlimited projects.
        </Alert>
      )}

      <Fab
        color="primary"
        aria-label="Create project"
        onClick={handleCreateProject}
        disabled={atProjectLimit}
        sx={{
          position: "fixed",
          bottom: 88,
          right: 24,
        }}
      >
        <AddIcon />
      </Fab>
    </Box>
  );
}
