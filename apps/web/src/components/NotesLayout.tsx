import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import NotesPage from './NotesPage';
import NoteDetailPage from './NoteDetailPage';

/** Max width of each column in the side-by-side view (matches the old single-column cap). */
const COLUMN_MAX_WIDTH = 600;

/**
 * Height of the split-view container so each column scrolls on its own.
 * Subtracts the fixed top chrome (dense AppBar toolbar + the main element's top
 * padding) and safe-area insets from the viewport height.
 */
const SPLIT_VIEW_HEIGHT = 'calc(100vh - 96px - env(safe-area-inset-top, 0px))';

/**
 * Responsive layout for Notes.
 *
 * Split-view only kicks in on large screens (md+) AND when a note is selected.
 * In that case the list and the selected note's detail sit side-by-side, each
 * capped at ~600px so neither column stretches too wide. The detail pane is
 * rendered in "embedded" mode (id + onBack passed as props).
 *
 * When no note is selected — or on small screens — the list renders exactly as
 * before (full width, centered). On small screens a selected note opens the
 * full-screen detail route as before.
 */
export default function NotesLayout() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const theme = useTheme();
    const isLargeScreen = useMediaQuery(theme.breakpoints.up('md'));

    const handleCloseDetail = React.useCallback(() => {
        navigate('/notes');
    }, [navigate]);

    // Small screens: render one page at a time (original behavior). The detail
    // page reads the id from the route param and navigates back itself.
    if (!isLargeScreen) {
        return id ? <NoteDetailPage /> : <NotesPage />;
    }

    // Large screen, nothing selected: show the list exactly as before.
    if (!id) {
        return <NotesPage />;
    }

    // Large screen with a selection: list + detail side-by-side, each capped and
    // scrolling independently within its own column.
    return (
        <Box
            sx={{
                display: 'flex',
                gap: 3,
                alignItems: 'flex-start',
                justifyContent: 'center',
                width: '100%',
                height: SPLIT_VIEW_HEIGHT,
            }}
        >
            <Box
                sx={{
                    flex: 1,
                    minWidth: 0,
                    maxWidth: COLUMN_MAX_WIDTH,
                    height: '100%',
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    pb: '96px',
                }}
            >
                <NotesPage />
            </Box>
            <Box
                sx={{
                    flex: 1,
                    minWidth: 0,
                    maxWidth: COLUMN_MAX_WIDTH,
                    height: '100%',
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    pb: '96px',
                }}
            >
                <NoteDetailPage key={id} id={id} onBack={handleCloseDetail} />
            </Box>
        </Box>
    );
}
