import React, { useEffect, useRef, useState } from 'react';
import { EditorView, ViewPlugin, ViewUpdate, Decoration, DecorationSet, WidgetType, keymap, placeholder as cmPlaceholder } from '@codemirror/view';
import { EditorState, StateField, StateEffect } from '@codemirror/state';
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

// ─── Table Preview Plugin ────────────────────────────────────────────────────

/** Check if a line looks like a markdown table row */
function isTableRow(text: string): boolean {
    const trimmed = text.trim();
    // Must start with | or have at least 2 pipe characters (cells)
    return trimmed.startsWith('|') || (trimmed.split('|').length >= 3);
}

/** Check if a line is the separator row (e.g. |---|---|) */
function isSeparatorRow(text: string): boolean {
    return /^\|?[\s|:\-]+\|?$/.test(text.trim()) && text.includes('-');
}

/** Parse cell contents from a pipe-delimited row */
function parseTableCells(text: string): string[] {
    let inner = text.trim();
    if (inner.startsWith('|')) inner = inner.slice(1);
    if (inner.endsWith('|')) inner = inner.slice(0, -1);
    return inner.split('|').map(c => c.trim());
}

class TableWidget extends WidgetType {
    constructor(private rows: string[][], private hasSeparator: boolean) {
        super();
    }

    eq(other: TableWidget) {
        return JSON.stringify(this.rows) === JSON.stringify(other.rows) &&
            this.hasSeparator === other.hasSeparator;
    }

    toDOM() {
        const wrapper = document.createElement('div');
        wrapper.className = 'cm-preview-table-wrapper';
        const table = document.createElement('table');
        table.className = 'cm-preview-table';

        // Filter out the separator row placeholder
        const dataRows = this.rows.filter(r => r.length > 0);

        dataRows.forEach((cells, rowIdx) => {
            const isHeader = this.hasSeparator && rowIdx === 0;
            const section = isHeader
                ? (table.tHead || table.createTHead())
                : (table.tBodies[0] || table.createTBody());
            const tr = section.insertRow();
            cells.forEach(cell => {
                const el = document.createElement(isHeader ? 'th' : 'td');
                el.textContent = cell;
                tr.appendChild(el);
            });
        });

        wrapper.appendChild(table);
        return wrapper;
    }

    ignoreEvent() { return false; }

    get estimatedHeight() { return -1; }
}

// ─── Focus tracking for StateField-based decorations ─────────────────────────

const editorFocusEffect = StateEffect.define<boolean>();

const editorFocusField = StateField.define<boolean>({
    create() { return false; },
    update(focused, tr) {
        for (const e of tr.effects) {
            if (e.is(editorFocusEffect)) return e.value;
        }
        return focused;
    },
});

function buildTableDecos(state: EditorState): DecorationSet {
    const editorFocused = state.field(editorFocusField, false) ?? true;
    const cursorLine = editorFocused
        ? state.doc.lineAt(state.selection.main.head).number
        : -1;
    const decos: Array<{ from: number; to: number; value: Decoration }> = [];

    let i = 1;
    while (i <= state.doc.lines) {
        const lineText = state.doc.line(i).text;
        if (isTableRow(lineText)) {
            const startLine = i;
            while (i <= state.doc.lines && isTableRow(state.doc.line(i).text)) {
                i++;
            }
            const endLine = i - 1;

            // Need at least 2 lines to be a valid table
            if (endLine - startLine < 1) continue;

            // If cursor is anywhere in this table block, show raw markdown
            if (cursorLine >= startLine && cursorLine <= endLine) continue;

            // Parse table rows
            const rows: string[][] = [];
            let hasSeparator = false;
            for (let ln = startLine; ln <= endLine; ln++) {
                const lt = state.doc.line(ln).text;
                if (isSeparatorRow(lt)) {
                    hasSeparator = true;
                    rows.push([]); // placeholder
                } else {
                    rows.push(parseTableCells(lt));
                }
            }

            const from = state.doc.line(startLine).from;
            const to = state.doc.line(endLine).to;

            decos.push({
                from,
                to,
                value: Decoration.replace({ widget: new TableWidget(rows, hasSeparator), block: true }),
            });
        } else {
            i++;
        }
    }

    if (decos.length === 0) return Decoration.none;
    return Decoration.set(decos.map(d => d.value.range(d.from, d.to)), true);
}

const tableField = StateField.define<DecorationSet>({
    create(state) {
        return buildTableDecos(state);
    },
    update(decos, tr) {
        if (tr.docChanged || tr.selection || tr.effects.some(e => e.is(editorFocusEffect))) {
            return buildTableDecos(tr.state);
        }
        return decos;
    },
    provide(field) {
        return EditorView.decorations.from(field);
    },
});

// ─── Conceal Plugin ──────────────────────────────────────────────────────────

const concealPlugin = ViewPlugin.fromClass(
    class {
        decorations: DecorationSet;
        constructor(view: EditorView) {
            this.decorations = this.build(view);
        }
        build(view: EditorView): DecorationSet {
            const state = view.state;
            // When editor is not focused, render all lines fully (no line is "active")
            const cursorLine = view.hasFocus
                ? state.doc.lineAt(state.selection.main.head).number
                : -1;
            const decos: Array<{ from: number; to: number; value: Decoration }> = [];

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
            if (update.docChanged || update.selectionSet || update.focusChanged) {
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
    '.cm-preview-table-wrapper': {
        padding: '4px 0',
        overflow: 'auto',
    },
    '.cm-preview-table': {
        borderCollapse: 'collapse',
        margin: '4px 0',
        width: 'auto',
        fontSize: '0.95em',
    },
    '.cm-preview-table th, .cm-preview-table td': {
        border: '1px solid #ddd',
        padding: '6px 12px',
        textAlign: 'left',
    },
    '.cm-preview-table th': {
        backgroundColor: 'rgba(0,0,0,0.04)',
        fontWeight: '600',
    },
    '.cm-preview-table tr:nth-child(even) td': {
        backgroundColor: 'rgba(0,0,0,0.02)',
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
    '.cm-preview-table-wrapper': {
        padding: '4px 0',
        overflow: 'auto',
    },
    '.cm-preview-table': {
        borderCollapse: 'collapse',
        margin: '4px 0',
        width: 'auto',
        fontSize: '0.95em',
    },
    '.cm-preview-table th, .cm-preview-table td': {
        border: '1px solid #444',
        padding: '6px 12px',
        textAlign: 'left',
    },
    '.cm-preview-table th': {
        backgroundColor: 'rgba(255,255,255,0.06)',
        fontWeight: '600',
    },
    '.cm-preview-table tr:nth-child(even) td': {
        backgroundColor: 'rgba(255,255,255,0.03)',
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

    // Track whether the last doc change originated from the editor (user typing)
    // vs an external prop update. This prevents the sync effect from overwriting
    // text the user just typed.
    const isLocalChangeRef = useRef(false);

    // Track editor focus for mobile toolbar visibility
    const [editorFocused, setEditorFocused] = useState(false);
    const [toolbarBottom, setToolbarBottom] = useState(0);
    const toolbarRef = useRef<HTMLDivElement>(null);

    // Detect mobile (touch device with narrow viewport)
    const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 600px) and (pointer: coarse)').matches;

    // Bottom nav height (56px) + safe area inset
    const BOTTOM_NAV_HEIGHT = 56;
    const TOOLBAR_HEIGHT = 48;

    // Add bottom padding to CM content area so text doesn't hide behind the fixed toolbar
    useEffect(() => {
        if (!isMobile) return;
        const view = viewRef.current;
        if (!view) return;
        const contentEl = view.contentDOM;
        if (editorFocused) {
            contentEl.style.paddingBottom = `${TOOLBAR_HEIGHT}px`;
        } else {
            contentEl.style.paddingBottom = '';
        }
    }, [isMobile, editorFocused]);

    // Position toolbar above the virtual keyboard using visualViewport
    useEffect(() => {
        if (!isMobile || !editorFocused) return;

        const viewport = window.visualViewport;
        if (!viewport) return;

        // Parse safe-area-inset-bottom from CSS env
        const getSafeAreaBottom = () => {
            const div = document.createElement('div');
            div.style.position = 'fixed';
            div.style.bottom = '0';
            div.style.paddingBottom = 'env(safe-area-inset-bottom, 0px)';
            document.body.appendChild(div);
            const safeArea = parseInt(getComputedStyle(div).paddingBottom, 10) || 0;
            document.body.removeChild(div);
            return safeArea;
        };

        const minBottom = BOTTOM_NAV_HEIGHT + getSafeAreaBottom();

        const updatePosition = () => {
            // The visual viewport height shrinks when the keyboard is open.
            // Position the toolbar at the bottom of the visible area.
            const offsetTop = viewport.offsetTop;
            const bottom = window.innerHeight - (viewport.height + offsetTop);
            setToolbarBottom(Math.max(bottom, minBottom));
        };

        updatePosition();
        viewport.addEventListener('resize', updatePosition);
        viewport.addEventListener('scroll', updatePosition);

        return () => {
            viewport.removeEventListener('resize', updatePosition);
            viewport.removeEventListener('scroll', updatePosition);
        };
    }, [isMobile, editorFocused]);

    // Create editor on mount
    useEffect(() => {
        if (!containerRef.current) return;

        const updateListener = EditorView.updateListener.of((update: ViewUpdate) => {
            if (update.docChanged) {
                isLocalChangeRef.current = true;
                onChangeRef.current(update.state.doc.toString());
            }
            if (update.focusChanged) {
                setEditorFocused(update.view.hasFocus);
                update.view.dispatch({
                    effects: editorFocusEffect.of(update.view.hasFocus),
                });
            }
        });

        const state = EditorState.create({
            doc: value,
            extensions: [
                markdown({ base: markdownLanguage }),
                editorFocusField,
                concealPlugin,
                tableField,
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

        // If this value update was triggered by the editor's own onChange,
        // skip the sync — the editor already has the correct content.
        // This prevents a race where React's batched state update delivers
        // a stale value back to the editor, overwriting text the user just typed.
        if (isLocalChangeRef.current) {
            isLocalChangeRef.current = false;
            return;
        }

        const currentDoc = view.state.doc.toString();
        if (currentDoc !== value) {
            view.dispatch({
                changes: { from: 0, to: currentDoc.length, insert: value },
            });
        }
    }, [value]);

    // ─── Toolbar helpers ─────────────────────────────────────────────────

    /** Expand to word boundaries if cursor is inside a word with no selection */
    const getWordRange = (view: EditorView, from: number, to: number): { from: number; to: number } => {
        if (from !== to) return { from, to }; // already has a selection
        const doc = view.state.doc;
        const line = doc.lineAt(from);
        const lineText = line.text;
        const offset = from - line.from;

        // Find word boundaries (letters, digits, underscores, hyphens)
        let start = offset;
        let end = offset;
        while (start > 0 && /\w/.test(lineText[start - 1])) start--;
        while (end < lineText.length && /\w/.test(lineText[end])) end++;

        // Only expand if cursor is actually inside a word
        if (start === end) return { from, to };
        return { from: line.from + start, to: line.from + end };
    };

    /** Wrap selection (or current word, or insert placeholder) with prefix/suffix */
    const wrapSelection = (prefix: string, suffix: string, placeholder: string = '') => {
        const view = viewRef.current;
        if (!view || disabled) return;
        const { from: rawFrom, to: rawTo } = view.state.selection.main;
        const { from, to } = getWordRange(view, rawFrom, rawTo);
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
            {/* Toolbar — on mobile, only show when keyboard is up (editor focused), positioned above keyboard */}
            <Box
                ref={toolbarRef}
                sx={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 0.5,
                    p: 0.5,
                    borderBottom: isMobile ? 'none' : '1px solid',
                    borderTop: isMobile ? '1px solid' : 'none',
                    borderColor: 'divider',
                    bgcolor: 'background.paper',
                    alignItems: 'center',
                    // Mobile: fixed above keyboard, only shown when focused
                    ...(isMobile
                        ? {
                            position: 'fixed',
                            left: 0,
                            right: 0,
                            bottom: `${toolbarBottom}px`,
                            zIndex: 1300,
                            display: editorFocused ? 'flex' : 'none',
                            boxShadow: '0 -2px 8px rgba(0,0,0,0.15)',
                        }
                        : {}),
                }}
            >
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
                style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: 0,
                }}
            />
        </>
    );
}
