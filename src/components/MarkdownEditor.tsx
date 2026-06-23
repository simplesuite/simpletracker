import React, { useEffect, useRef } from 'react';
import { EditorView, ViewPlugin, ViewUpdate, Decoration, DecorationSet, keymap, placeholder as cmPlaceholder } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { defaultKeymap, indentWithTab, history, historyKeymap } from '@codemirror/commands';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Divider from '@mui/material/Divider';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import TitleIcon from '@mui/icons-material/Title';
import CodeIcon from '@mui/icons-material/Code';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import LinkIcon from '@mui/icons-material/Link';
import StrikethroughSIcon from '@mui/icons-material/StrikethroughS';
import { useGlobalStore } from '../store/globalStore';

/**
 * Obsidian-style live-preview markdown editor.
 * Lines without the cursor render formatted markdown (hiding syntax characters).
 * The active cursor line shows raw markdown for editing.
 */

// ─── Conceal Plugin ──────────────────────────────────────────────────────────

const concealPlugin = ViewPlugin.fromClass(
    class {
        decorations: DecorationSet;
        constructor(view: EditorView) {
            this.decorations = this.build(view);
        }
        build(view: EditorView): DecorationSet {
            const state = view.state;
            const cursorLine = state.doc.lineAt(state.selection.main.head).number;
            const decos: Array<{from: number; to: number; value: Decoration}> = [];

            for (let i = 1; i <= state.doc.lines; i++) {
                const isFocused = i === cursorLine;
                const line = state.doc.line(i);
                const text = line.text;

                // Headings: lines starting with #
                if (text.startsWith('# ')) {
                    decos.push({ from: line.from, to: line.to, value: Decoration.mark({ class: 'cm-preview-h1' }) });
                    if (!isFocused) decos.push({ from: line.from, to: line.from + 2, value: Decoration.mark({ class: 'cm-hidden' }) });
                } else if (text.startsWith('## ')) {
                    decos.push({ from: line.from, to: line.to, value: Decoration.mark({ class: 'cm-preview-h2' }) });
                    if (!isFocused) decos.push({ from: line.from, to: line.from + 3, value: Decoration.mark({ class: 'cm-hidden' }) });
                } else if (text.startsWith('### ')) {
                    decos.push({ from: line.from, to: line.to, value: Decoration.mark({ class: 'cm-preview-h3' }) });
                    if (!isFocused) decos.push({ from: line.from, to: line.from + 4, value: Decoration.mark({ class: 'cm-hidden' }) });
                }

                // Bold: **text**
                const boldRegex = /\*\*(.+?)\*\*/g;
                let boldMatch: RegExpExecArray | null;
                while ((boldMatch = boldRegex.exec(text)) !== null) {
                    const start = line.from + boldMatch.index;
                    const end = start + boldMatch[0].length;
                    decos.push({ from: start, to: end, value: Decoration.mark({ class: 'cm-preview-bold' }) });
                    if (!isFocused) {
                        decos.push({ from: start, to: start + 2, value: Decoration.mark({ class: 'cm-hidden' }) });
                        decos.push({ from: end - 2, to: end, value: Decoration.mark({ class: 'cm-hidden' }) });
                    }
                }

                // Italic: *text* (but not **)
                const italicRegex = /(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g;
                let italicMatch: RegExpExecArray | null;
                while ((italicMatch = italicRegex.exec(text)) !== null) {
                    const start = line.from + italicMatch.index;
                    const end = start + italicMatch[0].length;
                    decos.push({ from: start, to: end, value: Decoration.mark({ class: 'cm-preview-italic' }) });
                    if (!isFocused) {
                        decos.push({ from: start, to: start + 1, value: Decoration.mark({ class: 'cm-hidden' }) });
                        decos.push({ from: end - 1, to: end, value: Decoration.mark({ class: 'cm-hidden' }) });
                    }
                }

                // Inline code: `text`
                const codeRegex = /`([^`]+)`/g;
                let codeMatch: RegExpExecArray | null;
                while ((codeMatch = codeRegex.exec(text)) !== null) {
                    const start = line.from + codeMatch.index;
                    const end = start + codeMatch[0].length;
                    decos.push({ from: start, to: end, value: Decoration.mark({ class: 'cm-preview-code' }) });
                    if (!isFocused) {
                        decos.push({ from: start, to: start + 1, value: Decoration.mark({ class: 'cm-hidden' }) });
                        decos.push({ from: end - 1, to: end, value: Decoration.mark({ class: 'cm-hidden' }) });
                    }
                }

                // Strikethrough: ~~text~~
                const strikeRegex = /~~(.+?)~~/g;
                let strikeMatch: RegExpExecArray | null;
                while ((strikeMatch = strikeRegex.exec(text)) !== null) {
                    const start = line.from + strikeMatch.index;
                    const end = start + strikeMatch[0].length;
                    decos.push({ from: start, to: end, value: Decoration.mark({ class: 'cm-preview-strikethrough' }) });
                    if (!isFocused) {
                        decos.push({ from: start, to: start + 2, value: Decoration.mark({ class: 'cm-hidden' }) });
                        decos.push({ from: end - 2, to: end, value: Decoration.mark({ class: 'cm-hidden' }) });
                    }
                }

                // Links: [text](url)
                const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
                let linkMatch: RegExpExecArray | null;
                while ((linkMatch = linkRegex.exec(text)) !== null) {
                    const start = line.from + linkMatch.index;
                    const end = start + linkMatch[0].length;
                    const textEnd = start + 1 + linkMatch[1].length;
                    decos.push({ from: start + 1, to: textEnd, value: Decoration.mark({ class: 'cm-preview-link' }) });
                    if (!isFocused) {
                        decos.push({ from: start, to: start + 1, value: Decoration.mark({ class: 'cm-hidden' }) });
                        decos.push({ from: textEnd, to: end, value: Decoration.mark({ class: 'cm-hidden' }) });
                    }
                }

                // Blockquote: lines starting with >
                if (text.startsWith('> ')) {
                    decos.push({ from: line.from, to: line.to, value: Decoration.mark({ class: 'cm-preview-blockquote' }) });
                    if (!isFocused) decos.push({ from: line.from, to: line.from + 2, value: Decoration.mark({ class: 'cm-hidden' }) });
                }

                // List items: lines starting with - or *
                if (/^[-*+] /.test(text)) {
                    decos.push({ from: line.from, to: line.from + 2, value: Decoration.mark({ class: 'cm-preview-list-mark' }) });
                }
            }

            if (decos.length === 0) return Decoration.none;
            return Decoration.set(decos.map(d => d.value.range(d.from, d.to)), true);
        }
        update(update: ViewUpdate) {
            if (update.docChanged || update.selectionSet) {
                this.decorations = this.build(update.view);
            }
        }
    },
    { decorations: (v) => v.decorations }
);

// ─── Theme ───────────────────────────────────────────────────────────────────

const lightTheme = EditorView.theme({
    '&': {
        fontSize: '1rem',
        fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
        fontWeight: '400',
        letterSpacing: '0.00938em',
        lineHeight: '1.5',
    },
    '.cm-content': {
        padding: '12px 16px',
        caretColor: '#1976d2',
        fontFamily: 'inherit',
        fontSize: 'inherit',
        fontWeight: 'inherit',
        letterSpacing: 'inherit',
        lineHeight: 'inherit',
    },
    '.cm-line': {
        padding: '2px 0',
        fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif !important',
    },
    '&.cm-focused .cm-cursor': {
        borderLeftColor: '#1976d2',
    },
    '&.cm-focused': {
        outline: 'none',
    },
    '.cm-scroller': {
        overflow: 'auto',
    },
    '.cm-preview-h1': { fontSize: '1.8em', fontWeight: '700', lineHeight: '1.3' },
    '.cm-preview-h2': { fontSize: '1.5em', fontWeight: '600', lineHeight: '1.3' },
    '.cm-preview-h3': { fontSize: '1.25em', fontWeight: '600', lineHeight: '1.3' },
    '.cm-preview-h4': { fontSize: '1.1em', fontWeight: '600', lineHeight: '1.3' },
    '.cm-preview-h5': { fontSize: '1em', fontWeight: '600', lineHeight: '1.3' },
    '.cm-preview-h6': { fontSize: '0.9em', fontWeight: '600', lineHeight: '1.3' },
    '.cm-preview-bold': { fontWeight: '700' },
    '.cm-preview-italic': { fontStyle: 'italic' },
    '.cm-preview-strikethrough': { textDecoration: 'line-through' },
    '.cm-preview-code': {
        backgroundColor: 'rgba(0,0,0,0.06)',
        borderRadius: '3px',
        padding: '1px 4px',
        fontFamily: '"Fira Code", "JetBrains Mono", monospace',
        fontSize: '0.9em',
    },
    '.cm-preview-link': {
        color: '#1976d2',
        textDecoration: 'underline',
    },
    '.cm-preview-quote-mark': {
        color: '#9e9e9e',
    },
    '.cm-preview-blockquote': {
        borderLeft: '3px solid #e0e0e0',
        paddingLeft: '12px',
        color: '#666',
    },
    '.cm-preview-list-mark': {
        color: '#1976d2',
        fontWeight: '700',
    },
    '.cm-preview-hr': {
        display: 'block',
        textAlign: 'center',
        color: '#ccc',
    },
    '.cm-placeholder': {
        color: '#aaa',
    },
    '.cm-hidden': {
        fontSize: '0px',
        display: 'inline',
        width: '0',
        overflow: 'hidden',
        color: 'transparent',
    },
});

const darkTheme = EditorView.theme({
    '&': {
        fontSize: '1rem',
        fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
        fontWeight: '400',
        letterSpacing: '0.00938em',
        lineHeight: '1.5',
    },
    '.cm-content': {
        padding: '12px 16px',
        caretColor: '#90caf9',
        fontFamily: 'inherit',
        fontSize: 'inherit',
        fontWeight: 'inherit',
        letterSpacing: 'inherit',
        lineHeight: 'inherit',
    },
    '.cm-line': {
        padding: '2px 0',
        fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif !important',
    },
    '&.cm-focused .cm-cursor': {
        borderLeftColor: '#90caf9',
    },
    '&.cm-focused': {
        outline: 'none',
    },
    '.cm-scroller': {
        overflow: 'auto',
    },
    '.cm-preview-h1': { fontSize: '1.8em', fontWeight: '700', lineHeight: '1.3' },
    '.cm-preview-h2': { fontSize: '1.5em', fontWeight: '600', lineHeight: '1.3' },
    '.cm-preview-h3': { fontSize: '1.25em', fontWeight: '600', lineHeight: '1.3' },
    '.cm-preview-h4': { fontSize: '1.1em', fontWeight: '600', lineHeight: '1.3' },
    '.cm-preview-h5': { fontSize: '1em', fontWeight: '600', lineHeight: '1.3' },
    '.cm-preview-h6': { fontSize: '0.9em', fontWeight: '600', lineHeight: '1.3' },
    '.cm-preview-bold': { fontWeight: '700' },
    '.cm-preview-italic': { fontStyle: 'italic' },
    '.cm-preview-strikethrough': { textDecoration: 'line-through' },
    '.cm-preview-code': {
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: '3px',
        padding: '1px 4px',
        fontFamily: '"Fira Code", "JetBrains Mono", monospace',
        fontSize: '0.9em',
    },
    '.cm-preview-link': {
        color: '#90caf9',
        textDecoration: 'underline',
    },
    '.cm-preview-quote-mark': {
        color: '#666',
    },
    '.cm-preview-blockquote': {
        borderLeft: '3px solid #444',
        paddingLeft: '12px',
        color: '#aaa',
    },
    '.cm-preview-list-mark': {
        color: '#90caf9',
        fontWeight: '700',
    },
    '.cm-preview-hr': {
        display: 'block',
        textAlign: 'center',
        color: '#555',
    },
    '.cm-placeholder': {
        color: '#666',
    },
    '.cm-hidden': {
        fontSize: '0px',
        display: 'inline',
        width: '0',
        overflow: 'hidden',
        color: 'transparent',
    },
}, { dark: true });

// ─── Component ───────────────────────────────────────────────────────────────

interface MarkdownEditorProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
}

export default function MarkdownEditor({ value, onChange, placeholder, disabled }: MarkdownEditorProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;
    const currentTheme = useGlobalStore((s) => s.themeAtom);

    // Create editor on mount
    useEffect(() => {
        if (!containerRef.current) return;

        const updateListener = EditorView.updateListener.of((update: ViewUpdate) => {
            if (update.docChanged) {
                onChangeRef.current(update.state.doc.toString());
            }
        });

        const state = EditorState.create({
            doc: value,
            extensions: [
                markdown({ base: markdownLanguage }),
                concealPlugin,
                currentTheme === 'dark' ? darkTheme : lightTheme,
                updateListener,
                keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
                history(),
                EditorView.lineWrapping,
                EditorState.readOnly.of(disabled ?? false),
                placeholder ? cmPlaceholder(placeholder) : [],
            ],
        });

        const view = new EditorView({
            state,
            parent: containerRef.current,
        });

        viewRef.current = view;

        // Force decoration rebuild after initial parse completes
        setTimeout(() => {
            if (viewRef.current) {
                // Trigger a no-op selection set to force plugin update
                const pos = viewRef.current.state.selection.main.head;
                viewRef.current.dispatch({ selection: { anchor: pos } });
            }
        }, 50);

        return () => {
            view.destroy();
            viewRef.current = null;
        };
    }, [currentTheme, disabled]);

    // Sync external value changes (e.g. from loading a different note)
    useEffect(() => {
        const view = viewRef.current;
        if (!view) return;
        const currentDoc = view.state.doc.toString();
        if (currentDoc !== value) {
            view.dispatch({
                changes: { from: 0, to: currentDoc.length, insert: value },
            });
        }
    }, [value]);

    // ─── Toolbar helpers ─────────────────────────────────────────────────

    /** Wrap selection (or insert placeholder) with prefix/suffix */
    const wrapSelection = (prefix: string, suffix: string, placeholder: string = '') => {
        const view = viewRef.current;
        if (!view || disabled) return;
        const { from, to } = view.state.selection.main;
        const selected = view.state.sliceDoc(from, to);
        const insert = selected || placeholder;
        view.dispatch({
            changes: { from, to, insert: prefix + insert + suffix },
            selection: { anchor: from + prefix.length, head: from + prefix.length + insert.length },
        });
        view.focus();
    };

    /** Insert a prefix at the beginning of the current line */
    const insertLinePrefix = (prefix: string) => {
        const view = viewRef.current;
        if (!view || disabled) return;
        const line = view.state.doc.lineAt(view.state.selection.main.head);
        view.dispatch({
            changes: { from: line.from, to: line.from, insert: prefix },
            selection: { anchor: view.state.selection.main.head + prefix.length },
        });
        view.focus();
    };

    return (
        <>
            {/* Toolbar */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, p: 0.5, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'action.hover', alignItems: 'center' }}>
                <Tooltip title="Heading">
                    <IconButton size="small" onClick={() => insertLinePrefix('## ')} disabled={disabled}>
                        <TitleIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
                <Tooltip title="Bold">
                    <IconButton size="small" onClick={() => wrapSelection('**', '**', 'bold')} disabled={disabled}>
                        <FormatBoldIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
                <Tooltip title="Italic">
                    <IconButton size="small" onClick={() => wrapSelection('*', '*', 'italic')} disabled={disabled}>
                        <FormatItalicIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
                <Tooltip title="Strikethrough">
                    <IconButton size="small" onClick={() => wrapSelection('~~', '~~', 'text')} disabled={disabled}>
                        <StrikethroughSIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
                <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
                <Tooltip title="Bullet list">
                    <IconButton size="small" onClick={() => insertLinePrefix('- ')} disabled={disabled}>
                        <FormatListBulletedIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
                <Tooltip title="Code">
                    <IconButton size="small" onClick={() => wrapSelection('`', '`', 'code')} disabled={disabled}>
                        <CodeIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
                <Tooltip title="Quote">
                    <IconButton size="small" onClick={() => insertLinePrefix('> ')} disabled={disabled}>
                        <FormatQuoteIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
                <Tooltip title="Link">
                    <IconButton size="small" onClick={() => wrapSelection('[', '](url)', 'link text')} disabled={disabled}>
                        <LinkIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
            </Box>

            {/* Editor */}
            <div
                ref={containerRef}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}
            />
        </>
    );
}
