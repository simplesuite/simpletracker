import { useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, SectionList, Text as NativeText, TextInput, View } from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useColorScheme } from 'nativewind';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { refreshAllData, useNoteStore, useProjectStore } from '@simpletracker/core';
import type { NotesStackParamList } from '../navigation/types';
import { useThemeStore } from '../store/themeStore';
import { Pill, Surface } from '@simpletracker/ui';

type Nav = NativeStackNavigationProp<NotesStackParamList, 'NotesList'>;

type NoteSection = {
    title: string;
    data: ReturnType<typeof useNoteStore.getState>['notes'];
};

function formatUpdatedAt(updatedAt: number) {
    return new Date(updatedAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
    });
}

export function NotesListScreen() {
    const tabBarHeight = useBottomTabBarHeight();
    const navigation = useNavigation<Nav>();
    const notes = useNoteStore((s) => s.notes);
    const archivedNotes = useNoteStore((s) => s.archivedNotes);
    const createNote = useNoteStore((s) => s.createNote);
    const projects = useProjectStore((s) => s.projects);
    const { effectiveTheme } = useThemeStore();
    const { setColorScheme } = useColorScheme();

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedProjectIDs, setSelectedProjectIDs] = useState<Set<string>>(new Set());
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        setColorScheme(effectiveTheme);
    }, [effectiveTheme, setColorScheme]);

    const onRefresh = async () => {
        setRefreshing(true);
        try {
            await refreshAllData();
        } catch (error) {
            console.warn('Failed to refresh notes:', error);
        } finally {
            setRefreshing(false);
        }
    };

    const onAdd = async () => {
        const note = await createNote();
        if (note) navigation.navigate('NoteDetail', { id: note.recordID });
    };

    const matchesFilters = (note: (typeof notes)[number]) => {
        const query = searchQuery.trim().toLowerCase();
        const matchesSearch = !query || note.title.toLowerCase().includes(query) || note.body.toLowerCase().includes(query);
        const matchesProject = selectedProjectIDs.size === 0 || (
            typeof note.projectID === 'string' && selectedProjectIDs.has(note.projectID)
        );
        return matchesSearch && matchesProject;
    };

    const filteredNotes = notes.filter(matchesFilters);
    const filteredArchivedNotes = archivedNotes.filter(matchesFilters);

    const sortedProjects = [...projects].sort((a, b) => {
        const aCount = notes.filter((note) => note.projectID === a.recordID).length;
        const bCount = notes.filter((note) => note.projectID === b.recordID).length;
        return bCount - aCount;
    });

    const sections: NoteSection[] = [
        ...(filteredNotes.length > 0 ? [{ title: 'Recent', data: filteredNotes }] : []),
        ...(filteredArchivedNotes.length > 0
            ? [{ title: `Archived · ${filteredArchivedNotes.length}`, data: filteredArchivedNotes }]
            : []),
    ];

    const hasFilters = searchQuery.trim().length > 0 || selectedProjectIDs.size > 0;
    const placeholderColor = effectiveTheme === 'dark' ? '#94a3b8' : '#64748b';

    const toggleProjectFilter = (projectID: string) => {
        setSelectedProjectIDs((previous) => {
            const next = new Set(previous);
            if (next.has(projectID)) next.delete(projectID);
            else next.add(projectID);
            return next;
        });
    };

    return (
        <View className="flex-1 bg-slate-50 dark:bg-slate-950">
            <View className="px-4 pb-1 pt-4">
                <View className="relative">
                    <MaterialCommunityIcons name="magnify" size={21} color={placeholderColor} style={{ position: 'absolute', left: 16, top: 16, zIndex: 1 }} />
                    <TextInput
                        placeholder="Search your notes"
                        placeholderTextColor={placeholderColor}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        autoCapitalize="none"
                        className="h-14 rounded-2xl border border-slate-200 bg-white pl-12 pr-12 text-base text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-50"
                    />
                    {searchQuery.length > 0 && (
                        <Pressable
                            accessibilityLabel="Clear note search"
                            onPress={() => setSearchQuery('')}
                            className="absolute right-3 top-3 h-9 w-9 items-center justify-center rounded-full active:bg-slate-100 dark:active:bg-slate-800"
                        >
                            <MaterialCommunityIcons name="close" size={18} color={placeholderColor} />
                        </Pressable>
                    )}
                </View>
                <View className="flex-row items-center justify-between py-4">
                    <View>
                        <NativeText className="text-lg font-bold text-slate-950 dark:text-slate-50">Your notes</NativeText>
                        <NativeText className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            {filteredNotes.length} active · {filteredArchivedNotes.length} archived
                        </NativeText>
                    </View>
                    {hasFilters && (
                        <Pressable
                            accessibilityLabel="Clear note filters"
                            onPress={() => {
                                setSearchQuery('');
                                setSelectedProjectIDs(new Set());
                            }}
                            className="flex-row items-center rounded-full border border-slate-200 bg-white px-3 py-2 active:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:active:bg-slate-800"
                        >
                            <MaterialCommunityIcons name="close" size={14} color={placeholderColor} />
                            <NativeText className="ml-1 text-xs font-semibold text-slate-700 dark:text-slate-200">Clear filters</NativeText>
                        </Pressable>
                    )}
                </View>
            </View>

            {sortedProjects.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingVertical: 10 }}>
                    <Pill selected={selectedProjectIDs.size === 0} onPress={() => setSelectedProjectIDs(new Set())}>
                        All notes
                    </Pill>
                    {sortedProjects.map((project) => (
                        <Pill
                            key={project.recordID}
                            selected={selectedProjectIDs.has(project.recordID)}
                            onPress={() => toggleProjectFilter(project.recordID)}
                        >
                            {project.name} · {notes.filter((note) => note.projectID === project.recordID).length}
                        </Pill>
                    ))}
                </ScrollView>
            )}

            <SectionList
                sections={sections}
                keyExtractor={(item) => item.recordID}
                contentContainerStyle={{ paddingTop: 4, paddingBottom: tabBarHeight + 96, ...(sections.length === 0 ? { flexGrow: 1 } : {}) }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                ListEmptyComponent={
                    <View className="flex-1 items-center justify-center px-8 pt-16">
                        <View className="mb-4 h-16 w-16 items-center justify-center rounded-3xl bg-indigo-100 dark:bg-indigo-950">
                            <MaterialCommunityIcons name={hasFilters ? 'magnify' : 'note-plus-outline'} size={30} color={effectiveTheme === 'dark' ? '#a5b4fc' : '#4f46e5'} />
                        </View>
                        <NativeText className="text-center text-lg font-bold text-slate-950 dark:text-slate-50">
                            {hasFilters ? 'No notes found' : 'No notes yet'}
                        </NativeText>
                        <NativeText className="mt-2 text-center text-sm leading-5 text-slate-500 dark:text-slate-400">
                            {hasFilters ? 'Try a different search or clear your filters.' : 'Capture an idea, reminder, or checklist to get started.'}
                        </NativeText>
                    </View>
                }
                renderSectionHeader={({ section }) => (
                    <View className="px-5 pb-2 pt-4">
                        <NativeText className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                            {section.title}
                        </NativeText>
                    </View>
                )}
                renderItem={({ item }) => {
                    const projectName = item.projectID
                        ? projects.find((project) => project.recordID === item.projectID)?.name
                        : undefined;
                    const isChecklist = item.noteType === 'list';
                    const description = isChecklist ? 'Checklist' : item.body.trim() || 'No content yet';

                    return (
                        <Surface className={`mx-4 mb-3 overflow-hidden ${item.archived ? 'opacity-60' : ''}`}>
                            <Pressable onPress={() => navigation.navigate('NoteDetail', { id: item.recordID })} className="active:opacity-70">
                                <View className="flex-row items-center px-4 py-3">
                                    <View className={`h-11 w-11 items-center justify-center rounded-2xl ${isChecklist ? 'bg-violet-100 dark:bg-violet-950' : 'bg-indigo-100 dark:bg-indigo-950'}`}>
                                        <MaterialCommunityIcons
                                            name={isChecklist ? 'format-list-checks' : 'note-text-outline'}
                                            size={22}
                                            color={isChecklist ? '#7c3aed' : '#4f46e5'}
                                        />
                                    </View>
                                    <View className="min-w-0 flex-1 pl-3">
                                        <View className="flex-row items-center">
                                            <NativeText numberOfLines={1} className="min-w-0 flex-1 text-base font-semibold text-slate-900 dark:text-slate-50">
                                                {item.title || '(untitled)'}
                                            </NativeText>
                                            {item.pinned && <MaterialCommunityIcons name="pin" size={15} color={effectiveTheme === 'dark' ? '#c4b5fd' : '#6366f1'} />}
                                        </View>
                                        <NativeText numberOfLines={1} className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                            {description}
                                        </NativeText>
                                        <View className="mt-2 flex-row items-center">
                                            <NativeText className="text-xs text-slate-500 dark:text-slate-400">
                                                Updated {formatUpdatedAt(item.updatedAt)}
                                            </NativeText>
                                            {projectName && (
                                                <NativeText numberOfLines={1} className="ml-2 max-w-[48%] text-xs font-medium text-indigo-600 dark:text-indigo-300">
                                                    {projectName}
                                                </NativeText>
                                            )}
                                        </View>
                                    </View>
                                </View>
                            </Pressable>
                        </Surface>
                    );
                }}
            />

            <Pressable
                accessibilityLabel="New note"
                accessibilityRole="button"
                onPress={onAdd}
                className="absolute right-4 items-center justify-center rounded-2xl bg-indigo-600 px-5 py-4 shadow-lg active:bg-indigo-700 dark:bg-indigo-400 dark:active:bg-indigo-300"
                style={{ bottom: tabBarHeight + 24 }}
            >
                <View className="flex-row items-center gap-2">
                    <MaterialCommunityIcons name="plus" size={20} color={effectiveTheme === 'dark' ? '#0f172a' : '#ffffff'} />
                    <NativeText className="font-bold text-white dark:text-slate-950">New note</NativeText>
                </View>
            </Pressable>
        </View>
    );
}
