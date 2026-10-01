import { Linking, StyleSheet, Text, View } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { getUiTheme } from '@simpletracker/ui';
import { useThemeStore } from '../store/themeStore';

interface MarkdownPreviewProps {
    content: string;
    /** Message shown when there is no content to render. */
    emptyText?: string;
    style?: any;
}

export function MarkdownPreview({ content, emptyText = 'Nothing to preview yet.', style: _style }: MarkdownPreviewProps) {
    const { effectiveTheme } = useThemeStore();
    const theme = getUiTheme(effectiveTheme);

    if (!content.trim()) {
        return (
            <View style={styles.container}>
                <Text style={{ color: theme.onSurfaceVariant, fontSize: 15, fontStyle: 'italic' }}>{emptyText}</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Markdown
                onLinkPress={(url) => { void Linking.openURL(url); return false; }}
                style={{
                    body: { color: theme.onSurface, fontSize: 16, lineHeight: 24 },
                    paragraph: { marginTop: 0, marginBottom: 12, color: theme.onSurface },
                    strong: { fontWeight: 'bold' },
                    em: { fontStyle: 'italic' },
                    s: { textDecorationLine: 'line-through' },
                    code_inline: { backgroundColor: theme.surfaceVariant, color: theme.onSurface, paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4, fontFamily: 'monospace' },
                    code_block: { backgroundColor: theme.surfaceVariant, color: theme.onSurface, padding: 12, borderRadius: 8, fontFamily: 'monospace', marginVertical: 8 },
                    fence: { backgroundColor: theme.surfaceVariant, color: theme.onSurface, padding: 12, borderRadius: 8, fontFamily: 'monospace', marginVertical: 8 },
                    hr: { height: 1, backgroundColor: theme.outlineVariant, marginVertical: 16 },
                    heading1: { fontSize: 26, fontWeight: 'bold', marginTop: 4, marginBottom: 12, color: theme.onSurface },
                    heading2: { fontSize: 22, fontWeight: 'bold', marginTop: 4, marginBottom: 10, color: theme.onSurface },
                    heading3: { fontSize: 18, fontWeight: 'bold', marginTop: 4, marginBottom: 8, color: theme.onSurface },
                    bullet_list: { marginBottom: 8 },
                    ordered_list: { marginBottom: 8 },
                    list_item: { flexDirection: 'row', justifyContent: 'flex-start', marginBottom: 4 },
                    blockquote: { backgroundColor: theme.surfaceVariant, borderLeftWidth: 4, borderLeftColor: theme.primary, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 4, marginVertical: 8 },
                    table: { borderWidth: 1, borderColor: theme.outlineVariant, borderRadius: 6, marginVertical: 8 },
                    th: { padding: 6, borderColor: theme.outlineVariant },
                    td: { padding: 6, borderColor: theme.outlineVariant },
                    link: { color: theme.primary, textDecorationLine: 'underline' },
                }}
            >
                {content}
            </Markdown>
        </View>
    );
}

const styles = StyleSheet.create({ container: { marginTop: 4 } });
