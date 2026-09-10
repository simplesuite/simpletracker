import { View, StyleSheet, Text } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { getUiTheme } from '@simpletracker/ui';
import { useThemeStore } from '../store/themeStore';

interface MarkdownPreviewProps {
    content: string;
    style?: any;
}

export function MarkdownPreview({ content, style: _style }: MarkdownPreviewProps) {
    const { effectiveTheme } = useThemeStore();
    const theme = getUiTheme(effectiveTheme);

    if (!content.trim()) return null;

    return (
        <View style={styles.container}>
            <Markdown
                style={{
                    base: { color: theme.onSurface, fontSize: 16, lineHeight: 24 },
                    paragraph: { marginBottom: 12 },
                    strong: { fontWeight: 'bold' },
                    em: { fontStyle: 'italic' },
                    code_inline: { backgroundColor: theme.surfaceVariant, padding: 2, borderRadius: 4, fontFamily: 'monospace' },
                    blockcode: { backgroundColor: theme.surfaceVariant, padding: 12, borderRadius: 8, fontFamily: 'monospace', marginVertical: 8 },
                    hr: { height: 1, backgroundColor: theme.outlineVariant, marginVertical: 16 },
                    heading1: { fontSize: 24, fontWeight: 'bold', marginBottom: 12 },
                    heading2: { fontSize: 20, fontWeight: 'bold', marginBottom: 10 },
                    heading3: { fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
                    list: { marginLeft: 16 },
                    ListItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 },
                    listIcon: { marginRight: 8 },
                    link: { color: theme.primary, textDecorationLine: 'underline' },
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({ container: { marginTop: 8 } });
