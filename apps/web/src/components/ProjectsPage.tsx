import React from "react";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Fab from "@mui/material/Fab";
import AddIcon from "@mui/icons-material/Add";
import CircularProgress from "@mui/material/CircularProgress";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Alert from "@mui/material/Alert";
import Badge from "@mui/material/Badge";
import Avatar from "@mui/material/Avatar";
import NotesIcon from "@mui/icons-material/Notes";
import TaskAltIcon from "@mui/icons-material/TaskAlt";
import { useNavigate } from "react-router-dom";
import { useProjectStore } from "../store/projectStore";
import { useNoteStore } from "../store/noteStore";
import { useTaskStore } from "../store/taskStore";
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
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: 1.5,
              pt: 0.5,
              pb: 1,
              px: 1,
            }}
          >
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

              return (
                <Badge
                  badgeContent={overdueTaskCount}
                  color="error"
                  key={project.recordID}
                  sx={{
                    display: "block",
                    width: "100%",
                    minWidth: 0,
                    "& .MuiBadge-badge": {
                      top: 6,
                      right: 6,
                    },
                  }}
                >
                  <Paper
                    elevation={4}
                    sx={{
                      borderRadius: 5,
                      width: "100%",
                      height: 120,
                      cursor: "pointer",
                      textAlign: "center",
                      overflow: "hidden",
                      borderColor:
                        isSharedToMe || isSharedByMe ? "info.main" : "divider",
                    }}
                    onClick={() => navigate(`/projects/${project.recordID}`)}
                  >
                    <Stack
                      sx={{
                        width: "100%",
                        height: "100%",
                        p: 1.5,
                        justifyContent: "space-between",
                        overflow: "hidden",
                      }}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 0.5,
                            mb: 1,
                            minWidth: 0,
                          }}
                        >
                          <Typography variant="subtitle2" noWrap sx={{ flex: 1, minWidth: 0 }}>
                            {project.name}
                          </Typography>
                          {isSharedToMe && (
                            <Tooltip title="Shared with you">
                              <Avatar
                                src={`https://api.dicebear.com/9.x/shapes/svg?seed=${project.creatorID}`}
                                sx={{ width: 20, height: 20 }}
                              />
                            </Tooltip>
                          )}
                          {isSharedByMe && (
                            <Tooltip title="Shared with others">
                              <Avatar
                                src={`https://api.dicebear.com/9.x/shapes/svg?seed=${sharedByMeProjectUserMap.get(project.recordID) || ''}`}
                                sx={{ width: 20, height: 20 }}
                              />
                            </Tooltip>
                          )}
                        </Box>

                        {project.description && (
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                              fontSize: "0.75rem",
                            }}
                          >
                            {project.description}
                          </Typography>
                        )}
                      </Box>
                      <Stack
                        direction="row"
                        spacing={0.75}
                        justifyContent="center"
                      >
                        <Chip
                          icon={<NotesIcon />}
                          label={noteCount}
                          size="small"
                          variant="outlined"
                        />
                        <Chip
                          icon={<TaskAltIcon />}
                          label={`${completedTaskCount}/${taskCount}`}
                          size="small"
                          variant="outlined"
                        />
                      </Stack>
                    </Stack>
                  </Paper>
                </Badge>
              );
            })}
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
          bottom: 72,
          right: 16,
        }}
      >
        <AddIcon />
      </Fab>
    </Box>
  );
}
