import * as React from 'react';
import Box from '@mui/material/Box';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import NotesIcon from '@mui/icons-material/Notes';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import FolderIcon from '@mui/icons-material/Folder';
import SettingsIcon from '@mui/icons-material/Settings';

type TabDef = {
    label: string;
    to: string;
    match: RegExp;
    icon: React.ReactNode;
};

const tabs: TabDef[] = [
    { label: 'Notes', to: '/notes', match: /^\/notes/, icon: <NotesIcon sx={{ fontSize: 22 }} /> },
    { label: 'Tasks', to: '/tasks', match: /^\/tasks/, icon: <TaskAltIcon sx={{ fontSize: 22 }} /> },
    { label: 'Projects', to: '/projects', match: /^\/projects/, icon: <FolderIcon sx={{ fontSize: 22 }} /> },
    { label: 'Settings', to: '/settings', match: /^\/settings/, icon: <SettingsIcon sx={{ fontSize: 22 }} /> },
];

/**
 * Web counterpart to the mobile FloatingTabBar: an absolutely-positioned,
 * frosted, rounded pill bar. A single primary-container "pill" indicator
 * slides horizontally to the active tab. Icons/labels cross-fade between the
 * active (on-primary-container) and inactive (muted secondary) colors. Colors
 * come from the shared MUI theme.
 */
export default function FloatingTabBar() {
    const location = useLocation();

    const activeIndex = Math.max(
        0,
        tabs.findIndex((tab) => tab.match.test(location.pathname)),
    );
    const hasActive = tabs.some((tab) => tab.match.test(location.pathname));

    return (
        <Box
            sx={{
                position: 'fixed',
                left: 12,
                right: 12,
                bottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
                zIndex: (theme) => theme.zIndex.appBar,
                mx: 'auto',
                maxWidth: 600,
                borderRadius: '30px',
                border: '1px solid',
                borderColor: 'divider',
                p: 0.5,
                display: 'flex',
                gap: 0.5,
                backdropFilter: 'blur(12px)',
                backgroundColor: (theme) =>
                    theme.palette.mode === 'dark'
                        ? 'rgba(32, 32, 35, 0.82)'
                        : 'rgba(255, 255, 255, 0.9)',
                boxShadow: (theme) =>
                    theme.palette.mode === 'dark'
                        ? '0 4px 12px rgba(0, 0, 0, 0.24)'
                        : '0 4px 12px rgba(0, 0, 0, 0.08)',
            }}
        >
            {/* Sliding active-tab indicator. Positioned over one tab's width and
                translated horizontally to the active index. */}
            <Box
                aria-hidden
                sx={{
                    position: 'absolute',
                    top: 4,
                    bottom: 4,
                    left: 4,
                    width: `calc((100% - 8px - ${(tabs.length - 1) * 4}px) / ${tabs.length})`,
                    borderRadius: '30px',
                    bgcolor: 'primary.main',
                    opacity: hasActive ? 1 : 0,
                    transform: `translateX(calc(${activeIndex} * (100% + 4px)))`,
                    transition: 'transform 0.28s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.2s ease',
                    pointerEvents: 'none',
                }}
            />
            {tabs.map((tab) => {
                const active = tab.match.test(location.pathname);
                return (
                    <Box
                        key={tab.to}
                        component={RouterLink}
                        to={tab.to}
                        aria-label={tab.label}
                        aria-current={active ? 'page' : undefined}
                        sx={{
                            position: 'relative',
                            zIndex: 1,
                            flex: 1,
                            minHeight: 50,
                            borderRadius: '30px',
                            display: 'flex',
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 0.5,
                            px: 1,
                            textDecoration: 'none',
                            transition: 'color 0.28s ease',
                            color: active ? 'primary.contrastText' : 'text.secondary',
                            '&:hover': {
                                bgcolor: active ? 'transparent' : 'action.hover',
                            },
                        }}
                    >
                        {tab.icon}
                        <Box
                            component="span"
                            sx={{ fontSize: 11, fontWeight: 600, lineHeight: 1 }}
                        >
                            {tab.label}
                        </Box>
                    </Box>
                );
            })}
        </Box>
    );
}
