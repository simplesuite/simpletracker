import React from "react";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Fab from "@mui/material/Fab";
import AddIcon from "@mui/icons-material/Add";
import Chip from "@mui/material/Chip";
import PeopleIcon from "@mui/icons-material/People";
import FolderIcon from "@mui/icons-material/Folder";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import PushPinIcon from "@mui/icons-material/PushPin";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ChecklistIcon from "@mui/icons-material/Checklist";
import CircularProgress from "@mui/material/CircularProgress";
import Collapse from "@mui/material/Collapse";
import Fade from "@mui/material/Fade";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import IconButton from "@mui/material/IconButton";
import Grid from "@mui/material/Grid";
import { useNavigate } from "react-router-dom";
import { useNoteStore } from "../store/noteStore";
import { useProjectStore } from "../store/projectStore";
import { useGlobalStore } from "../store/globalStore";
import { supabase } from "../lib/supabase";
import type { Note } from "../types/index";
import Avatar from "@mui/material/Avatar";

function formatTimestamp(ts: number): string {
  const date = new Date(ts);
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) {
    return date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  const isThisYear = date.getFullYear() === now.getFullYear();
  if (isThisYear) {
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function NotesPage() {
  const navigate = useNavigate();
  const notes = useNoteStore((s) => s.notes);
  const archivedNotes = useNoteStore((s) => s.archivedNotes);
  const sharedNotes = useNoteStore((s) => s.sharedNotes);
  const loading = useNoteStore((s) => s.loading);
  const fetchNotes = useNoteStore((s) => s.fetchNotes);
  const fetchArchivedNotes = useNoteStore((s) => s.fetchArchivedNotes);
  const createNote = useNoteStore((s) => s.createNote);
  const listItems = useNoteStore((s) => s.listItems);
  const fetchListItems = useNoteStore((s) => s.fetchListItems);
  const currentUserID = useGlobalStore((s) => s.currentUser.recordID);
  const projects = useProjectStore((s) => s.projects);

  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedProjectIDs, setSelectedProjectIDs] = React.useState<Set<string>>(new Set());
  const [archivedExpanded, setArchivedExpanded] = React.useState(false);
  const [sharedByMeNoteIDs, setSharedByMeNoteIDs] = React.useState<Set<string>>(
    () => {
      try {
        const cached = localStorage.getItem("sharedByMeNoteIDs");
        if (cached) return new Set(JSON.parse(cached) as string[]);
      } catch {}
      return new Set();
    },
  );

  // Fetch which of my notes are shared with others
  React.useEffect(() => {
    const fetchSharedByMe = async () => {
      const ownedNoteIDs = notes
        .filter((n) => n.creatorID === currentUserID)
        .map((n) => n.recordID);
      if (ownedNoteIDs.length === 0) {
        setSharedByMeNoteIDs(new Set());
        localStorage.setItem("sharedByMeNoteIDs", "[]");
        return;
      }
      const { data } = await supabase
        .from("notes_shared")
        .select("noteID")
        .in("noteID", ownedNoteIDs);
      if (data) {
        const ids = data.map((r) => r.noteID);
        setSharedByMeNoteIDs(new Set(ids));
        localStorage.setItem("sharedByMeNoteIDs", JSON.stringify(ids));
      }
    };
    fetchSharedByMe();
  }, [notes, currentUserID]);

  // Build a map of projectID -> project name for quick lookup
  const projectNameMap = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const p of projects) {
      map.set(p.recordID, p.name);
    }
    return map;
  }, [projects]);

  // Sort projects by most notes descending
  const sortedProjects = React.useMemo(() => {
    const allNotes = [...notes, ...sharedNotes];
    return [...projects].sort((a, b) => {
      const aCount = allNotes.filter((n) => n.projectID === a.recordID).length;
      const bCount = allNotes.filter((n) => n.projectID === b.recordID).length;
      return bCount - aCount;
    });
  }, [projects, notes, sharedNotes]);

  React.useEffect(() => {
    fetchNotes();
    fetchArchivedNotes();
  }, [fetchNotes, fetchArchivedNotes]);

  // Fetch list items for checklist-type notes (for card previews)
  React.useEffect(() => {
    const listNotes = [...notes, ...sharedNotes].filter((n) => n.noteType === "list");
    for (const note of listNotes) {
      if (!listItems[note.recordID]) {
        fetchListItems(note.recordID);
      }
    }
  }, [notes, sharedNotes]);

  const handleCreateNote = async () => {
    const newNote = await createNote();
    if (newNote) {
      navigate(`/notes/${newNote.recordID}`);
    }
  };

  // Combine own notes and shared notes for the active view, sorted by pinned first then updatedAt desc
  const activeNotes: Note[] = React.useMemo(() => {
    const combined = [...notes, ...sharedNotes];
    // Deduplicate by recordID (in case of overlap)
    const map = new Map<string, Note>();
    for (const note of combined) {
      map.set(note.recordID, note);
    }
    return Array.from(map.values()).sort((a, b) => {
      // Pinned notes come first
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      // Then sort by updatedAt desc
      return b.updatedAt - a.updatedAt;
    });
  }, [notes, sharedNotes]);

  // Filter active notes by search query and selected projects
  const filteredActiveNotes = React.useMemo(() => {
    let filtered = activeNotes;
    if (selectedProjectIDs.size > 0) {
      filtered = filtered.filter((n) => n.projectID && selectedProjectIDs.has(n.projectID));
    }
    if (!searchQuery.trim()) return filtered;
    const q = searchQuery.toLowerCase();
    return filtered.filter(
      (n) =>
        n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q),
    );
  }, [activeNotes, searchQuery, selectedProjectIDs]);

  // Filter archived notes by search query and selected projects
  const filteredArchivedNotes = React.useMemo(() => {
    let filtered = archivedNotes;
    if (selectedProjectIDs.size > 0) {
      filtered = filtered.filter((n) => n.projectID && selectedProjectIDs.has(n.projectID));
    }
    if (!searchQuery.trim()) return filtered;
    const q = searchQuery.toLowerCase();
    return filtered.filter(
      (n) =>
        n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q),
    );
  }, [archivedNotes, searchQuery, selectedProjectIDs]);

  const isSharedNote = (note: Note): boolean => {
    return note.creatorID !== currentUserID;
  };

  const renderNoteGrid = (noteList: Note[]) => (
    <Grid container spacing={1.5}>
      {noteList.map((note) => (
        <Grid size={6} key={note.recordID}>
        <Paper
          key={note.recordID}
          elevation={4}
          sx={{
            borderColor: note.pinned ? "primary.main" : "divider",
            borderRadius: 5,
            cursor: "pointer",
            height: "100%",
          }}
          onClick={() => navigate(`/notes/${note.recordID}`)}
        >
          <Box sx={{ p: 1, py: 1.5, display: "flex", flexDirection: "column", height: "100%" }}>
            <Box
              sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.5 }}
            >
              {note.pinned && (
                <PushPinIcon color="primary" sx={{ fontSize: 14 }} />
              )}
              {note.noteType === "list" && (
                <ChecklistIcon color="action" sx={{ fontSize: 14 }} />
              )}
              <Typography
                variant="subtitle2"
                noWrap
                sx={{
                  flex: 1,
                  fontStyle: note.title ? "normal" : "italic",
                  color: note.title ? "text.primary" : "text.secondary",
                }}
              >
                {note.title || "Untitled"}
              </Typography>
            </Box>
            {note.noteType !== "list" && note.body && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                  mb: 0.5,
                  fontSize: "0.75rem",
                }}
              >
                {note.body}
              </Typography>
            )}
            {note.noteType === "list" && listItems[note.recordID] && listItems[note.recordID].length > 0 && (
              <Box sx={{ mb: 0.5 }}>
                {listItems[note.recordID].slice(0, 2).map((item) => (
                  <Typography
                    key={item.recordID}
                    variant="body2"
                    color="text.secondary"
                    noWrap
                    sx={{
                      fontSize: "0.75rem",
                      textDecoration: item.isCompleted ? "line-through" : "none",
                      opacity: item.isCompleted ? 0.6 : 1,
                    }}
                  >
                    {item.isCompleted ? "☑" : "☐"} {item.title || "Untitled"}
                  </Typography>
                ))}
              </Box>
            )}
            <Box
              sx={{
                display: "flex",
                gap: 0.5,
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                mt: "auto",
              }}
            >
              <Typography variant="caption" color="text.secondary">
                {formatTimestamp(note.updatedAt)}
              </Typography>
              {isSharedNote(note) && (
                <Avatar sx={{ width: 30, height: 30, fontSize: "0.6rem" }}>
                  <PeopleIcon fontSize="small" />
                </Avatar>
              )}
              {!isSharedNote(note) && sharedByMeNoteIDs.has(note.recordID) && (
                <Avatar sx={{ width: 30, height: 30, fontSize: "0.6rem" }}>
                  <PeopleIcon fontSize="small" />
                </Avatar>
              )}
              {note.projectID && projectNameMap.has(note.projectID) && (
                <Chip
                  label={projectNameMap.get(note.projectID)}
                  size="small"
                  variant="outlined"
                  sx={{ height: 18, fontSize: "0.65rem" }}
                />
              )}
            </Box>
          </Box>
        </Paper>
        </Grid>
      ))}
    </Grid>
  );

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

  // Key that changes when project filter changes, triggering a crossfade
  const filterKey = React.useMemo(
    () => [...selectedProjectIDs].sort().join(",") || "all",
    [selectedProjectIDs]
  );

  return (
    <Box sx={{ maxWidth: 600, mx: "auto" }}>
      <TextField
        size="small"
        placeholder="Search notes..."
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
                <IconButton
                  size="small"
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear search"
                >
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
            display: "flex",
            gap: 1,
            overflowX: "auto",
            pb: 1,
            mb: 1.5,
            "&::-webkit-scrollbar": { display: "none" },
            scrollbarWidth: "none",
          }}
        >
          {sortedProjects.map((project) => {
            const count = activeNotes.filter((n) => n.projectID === project.recordID).length;
            return (
            <Chip
              key={project.recordID}
              label={`${project.name} (${count})`}
              variant={selectedProjectIDs.has(project.recordID) ? "filled" : "outlined"}
              color={selectedProjectIDs.has(project.recordID) ? "primary" : "default"}
              onClick={() => toggleProjectFilter(project.recordID)}
              sx={{ flexShrink: 0 }}
            />
            );
          })}
        </Box>
      )}

      {loading && filteredActiveNotes.length === 0 ? (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
          <CircularProgress />
        </Box>
      ) : filteredActiveNotes.length === 0 &&
        filteredArchivedNotes.length === 0 ? (
        <Typography variant="body1" color="text.secondary" sx={{ mt: 2 }}>
          {searchQuery.trim()
            ? "No notes match your search."
            : "No notes yet. Tap + to create one."}
        </Typography>
      ) : (
        <>
          {filteredActiveNotes.length > 0 && (
            <Fade key={filterKey} in timeout={300}>
              <div>{renderNoteGrid(filteredActiveNotes)}</div>
            </Fade>
          )}

          {filteredArchivedNotes.length > 0 && (
            <>
              <Box
                onClick={() => setArchivedExpanded(!archivedExpanded)}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  cursor: "pointer",
                  mt: filteredActiveNotes.length > 0 ? 2 : 0,
                  mb: 1,
                  px: 1,
                  py: 0.5,
                  borderRadius: 1,
                  "&:hover": { bgcolor: "action.hover" },
                }}
              >
                {archivedExpanded ? (
                  <ExpandLessIcon fontSize="small" />
                ) : (
                  <ExpandMoreIcon fontSize="small" />
                )}
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ ml: 0.5 }}
                >
                  Archived ({filteredArchivedNotes.length})
                </Typography>
              </Box>
              <Collapse in={archivedExpanded}>
                {renderNoteGrid(filteredArchivedNotes)}
              </Collapse>
            </>
          )}
        </>
      )}

      <Fab
        color="primary"
        aria-label="Create new note"
        onClick={handleCreateNote}
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
