import React from 'react';
import { View, StyleSheet, Text, TextStyle } from 'react-native';
import Markdown from 'react-native-markdown-display';

interface MarkdownPreviewProps {
    content: string;
    style?: TextStyle | TextStyle[];
}

export function MarkdownPreview({ content, style }: MarkdownPreviewProps) {
    if (!content.trim()) {
        return null;
    }

    const renderers = {
        paragraph: (node: any, children: React.ReactNode, parent: any, styles: any) => {
            return <Text key={node.key} style={[styles.base, styles.paragraph]}>{children}</Text>;
        },
        text: (node: any, children: React.ReactNode, parent: any, styles: any) => {
            return <Text key={node.key} style={styles.base}>{children}</Text>;
        },
    };

    return (
        <View style={styles.container}>
            <Markdown
                style={{
                    base: {
                        color: '#333',
                        fontSize: 16,
                        lineHeight: 24,
                    },
                    paragraph: {
                        marginBottom: 12,
                    },
                    strong: {
                        fontWeight: 'bold',
                    },
                    em: {
                        fontStyle: 'italic',
                    },
                    code_inline: {
                        backgroundColor: '#f4f4f4',
                        padding: 2,
                        borderRadius: 4,
                        fontFamily: 'monospace',
                    },
                    blockcode: {
                        backgroundColor: '#f4f4f4',
                        padding: 12,
                        borderRadius: 8,
                        fontFamily: 'monospace',
                        marginVertical: 8,
                    },
                    hr: {
                        height: 1,
                        backgroundColor: '#ccc',
                        marginVertical: 16,
                    },
                    heading1: {
                        fontSize: 24,
                        fontWeight: 'bold',
                        marginBottom: 12,
                    },
                    heading2: {
                        fontSize: 20,
                        fontWeight: 'bold',
                        marginBottom: 10,
                    },
                    heading3: {
                        fontSize: 18,
                        fontWeight: 'bold',
                        marginBottom: 8,
                    },
                    list: {
                        marginLeft: 16,
                    },
                   ListItem: {
                        flexDirection: 'row',
                        alignItems: 'flex-start',
                        marginBottom: 4,
                    },
                    listIcon: {
                        marginRight: 8,
                    },
                    link: {
                        color: '#1976d2',
                        textDecorationLine: 'underline',
                    },
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginTop: 8,
    },
});
