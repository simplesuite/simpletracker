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
 * Top offset for the sticky detail column. Keeps the detail pane pinned just
 * below the fixed top chrome (dense AppBar toolbar + the main element's top
 * padding) while the page scrolls normally.
 */
const STICKY_TOP = 'calc(80px + env(safe-area-inset-top, 0px))';

/**
 * Max height for the sticky detail column so, if the detail content is taller
 * than the viewport, it scrolls on its own rather than being cut off.
 */
const DETAIL_MAX_HEIGHT = 'calc(100vh - 96px - env(safe-area-inset-top, 0px))';

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

    // Large screen with a selection: list + detail side-by-side. The whole page
    // scrolls normally; the detail column is sticky so it stays pinned to the
    // top while the list scrolls past it. No inner scrollbars in the middle of
    // the page.
    return (
        <Box
            sx={{
                display: 'flex',
                gap: 3,
                alignItems: 'flex-start',
                justifyContent: 'center',
                width: '100%',
            }}
        >
            <Box
                sx={{
                    flex: 1,
                    minWidth: 0,
                    maxWidth: COLUMN_MAX_WIDTH,
                }}
            >
                <NotesPage />
            </Box>
            <Box
                sx={{
                    flex: 1,
                    minWidth: 0,
                    maxWidth: COLUMN_MAX_WIDTH,
                    position: 'sticky',
                    top: STICKY_TOP,
                    alignSelf: 'flex-start',
                    maxHeight: DETAIL_MAX_HEIGHT,
                    overflowY: 'auto',
                    overflowX: 'hidden',
                }}
            >
                <NoteDetailPage key={id} id={id} onBack={handleCloseDetail} />
            </Box>
        </Box>
    );
}
