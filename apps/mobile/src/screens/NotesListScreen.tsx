import { useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, SectionList, Text as NativeText, TextInput, View } from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useColorScheme } from 'nativewind';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { refreshAllData, useNoteStore, useProjectStore } from '@simpletracker/core';
import type { NotesStackParamList } from '../navigation/types';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import { Pill, Surface, getUiTheme } from '@simpletracker/ui';

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
    const sharedNotes = useNoteStore((s) => s.sharedNotes);
    const archivedNotes = useNoteStore((s) => s.archivedNotes);
    const userId = useAuthStore((s) => s.userId);
    const createNote = useNoteStore((s) => s.createNote);
    const projects = useProjectStore((s) => s.projects);
    const listItems = useNoteStore((s) => s.listItems);
    const { effectiveTheme } = useThemeStore();
    const theme = getUiTheme(effectiveTheme);
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

    const activeNotes = Array.from(new Map([...notes, ...sharedNotes].map((note) => [note.recordID, note])).values())
        .sort((a, b) => (a.pinned === b.pinned ? b.updatedAt - a.updatedAt : a.pinned ? -1 : 1));

    const matchesFilters = (note: (typeof activeNotes)[number]) => {
        const query = searchQuery.trim().toLowerCase();
        const matchesSearch = !query || note.title.toLowerCase().includes(query) || note.body.toLowerCase().includes(query);
        const matchesProject = selectedProjectIDs.size === 0 || (
            typeof note.projectID === 'string' && selectedProjectIDs.has(note.projectID)
        );
        return matchesSearch && matchesProject;
    };

    const filteredNotes = activeNotes.filter(matchesFilters);
    const filteredArchivedNotes = archivedNotes.filter(matchesFilters);

    const sortedProjects = [...projects].sort((a, b) => {
        const aCount = activeNotes.filter((note) => note.projectID === a.recordID).length;
        const bCount = activeNotes.filter((note) => note.projectID === b.recordID).length;
        return bCount - aCount;
    });

    const sections: NoteSection[] = [
        ...(filteredNotes.length > 0 ? [{ title: 'Recent', data: filteredNotes }] : []),
        ...(filteredArchivedNotes.length > 0
            ? [{ title: `Archived · ${filteredArchivedNotes.length}`, data: filteredArchivedNotes }]
            : []),
    ];

    const hasFilters = searchQuery.trim().length > 0 || selectedProjectIDs.size > 0;
    const placeholderColor = theme.onSurfaceVariant;

    const toggleProjectFilter = (projectID: string) => {
        setSelectedProjectIDs((previous) => {
            const next = new Set(previous);
            if (next.has(projectID)) next.delete(projectID);
            else next.add(projectID);
            return next;
        });
    };

    return (
        <View className="flex-1 bg-background dark:bg-background-dark">
            <SectionList
                style={{ flex: 1 }}
                sections={sections}
                keyExtractor={(item) => item.recordID}
                ListHeaderComponent={(
                    <>
                        <View className="px-4 pb-1 pt-4">
                            <View className="relative">
                                <MaterialCommunityIcons name="magnify" size={21} color={placeholderColor} style={{ position: 'absolute', left: 16, top: 16, zIndex: 1 }} />
                                <TextInput
                                    placeholder="Search your notes"
                                    placeholderTextColor={placeholderColor}
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                    autoCapitalize="none"
                                    className="h-14 rounded-2xl border border-outline-variant bg-surface pl-12 pr-12 text-base text-on-surface dark:border-outline-variant-dark dark:bg-surface-dark dark:text-on-surface-dark"
                                />
                                {searchQuery.length > 0 && (
                                    <Pressable
                                        accessibilityLabel="Clear note search"
                                        onPress={() => setSearchQuery('')}
                                        className="absolute right-3 top-3 h-9 w-9 items-center justify-center rounded-full active:bg-surface-variant dark:active:bg-surface-variant-dark"
                                    >
                                        <MaterialCommunityIcons name="close" size={18} color={placeholderColor} />
                                    </Pressable>
                                )}
                            </View>
                        </View>
                        <View className="flex-row items-center justify-between px-4 py-4">
                            <View>
                                <NativeText className="text-lg font-bold text-on-surface dark:text-on-surface-dark">Your notes</NativeText>
                                <NativeText className="mt-1 text-sm text-on-surface-variant dark:text-on-surface-variant-dark">
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
                                    className="flex-row items-center rounded-full border border-outline-variant bg-surface px-3 py-2 active:bg-surface-variant dark:border-outline-dark dark:bg-surface-dark dark:active:bg-surface-variant-dark"
                                >
                                    <MaterialCommunityIcons name="close" size={14} color={placeholderColor} />
                                    <NativeText className="ml-1 text-xs font-semibold text-on-surface-variant dark:text-on-surface-dark">Clear filters</NativeText>
                                </Pressable>
                            )}
                        </View>
                        {sortedProjects.length > 0 && (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingBottom: 11 }}>
                                <Pill selected={selectedProjectIDs.size === 0} onPress={() => setSelectedProjectIDs(new Set())}>
                                    All notes
                                </Pill>
                                {sortedProjects.map((project) => (
                                    <Pill
                                        key={project.recordID}
                                        selected={selectedProjectIDs.has(project.recordID)}
                                        onPress={() => toggleProjectFilter(project.recordID)}
                                    >
                                        {project.name} · {activeNotes.filter((note) => note.projectID === project.recordID).length}
                                    </Pill>
                                ))}
                            </ScrollView>
                        )}
                    </>
                )}
                contentContainerStyle={{ paddingTop: 4, paddingBottom: tabBarHeight + 96, ...(sections.length === 0 ? { flexGrow: 1 } : {}) }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                ListEmptyComponent={
                    <View className="flex-1 items-center justify-center px-8 pt-16">
                        <View className="mb-4 h-16 w-16 items-center justify-center rounded-3xl bg-primary-container dark:bg-primary-container-dark">
                            <MaterialCommunityIcons name={hasFilters ? 'magnify' : 'note-plus-outline'} size={30} color={theme.primary} />
                        </View>
                        <NativeText className="text-center text-lg font-bold text-on-surface dark:text-on-surface-dark">
                            {hasFilters ? 'No notes found' : 'No notes yet'}
                        </NativeText>
                        <NativeText className="mt-2 text-center text-sm leading-5 text-on-surface-variant dark:text-on-surface-variant-dark">
                            {hasFilters ? 'Try a different search or clear your filters.' : 'Capture an idea, reminder, or checklist to get started.'}
                        </NativeText>
                    </View>
                }
                renderSectionHeader={({ section }) => (
                    <View className="px-5 pb-2 pt-4">
                        <NativeText className="text-xs font-bold uppercase tracking-widest text-on-surface-variant dark:text-on-surface-variant-dark">
                            {section.title}
                        </NativeText>
                    </View>
                )}
                renderItem={({ item }) => {
                    const projectName = item.projectID
                        ? projects.find((project) => project.recordID === item.projectID)?.name
                        : undefined;
                    const isChecklist = item.noteType === 'list';
                    const checklistPreview = (listItems[item.recordID] ?? []).slice(0, 2).map((listItem) => `${listItem.isCompleted ? '☑' : '☐'} ${listItem.title || '(untitled)'}`).join(' · ');
                    const description = isChecklist ? checklistPreview || 'Checklist' : item.body.trim() || 'No content yet';

                    return (
                        <Surface className={`mx-4 mb-3 overflow-hidden ${item.archived ? 'opacity-60' : ''}`}>
                            <Pressable onPress={() => navigation.navigate('NoteDetail', { id: item.recordID })} className="active:opacity-70">
                                <View className="flex-row items-center px-4 py-3">
                                    <View className={`h-11 w-11 items-center justify-center rounded-2xl ${isChecklist ? 'bg-secondary-container dark:bg-secondary-container-dark' : 'bg-primary-container dark:bg-primary-container-dark'}`}>
                                        <MaterialCommunityIcons
                                            name={isChecklist ? 'format-list-checks' : 'note-text-outline'}
                                            size={22}
                                            color={isChecklist ? theme.secondary : theme.primary}
                                        />
                                    </View>
                                    <View className="min-w-0 flex-1 pl-3">
                                        <View className="flex-row items-center">
                                            <NativeText numberOfLines={1} className="min-w-0 flex-1 text-base font-semibold text-on-surface dark:text-on-surface-dark">
                                                {item.title || '(untitled)'}
                                            </NativeText>
                                            {item.pinned && <MaterialCommunityIcons name="pin" size={15} color={theme.primary} />}
                                            {item.creatorID !== userId && <MaterialCommunityIcons name="account-multiple-outline" size={15} color={theme.secondary} />}
                                        </View>
                                        <NativeText numberOfLines={1} className="mt-1 text-sm text-on-surface-variant dark:text-on-surface-variant-dark">
                                            {description}
                                        </NativeText>
                                        <View className="mt-2 flex-row items-center">
                                            <NativeText className="text-xs text-on-surface-variant dark:text-on-surface-variant-dark">
                                                Updated {formatUpdatedAt(item.updatedAt)}
                                            </NativeText>
                                            {projectName && (
                                                <NativeText numberOfLines={1} className="ml-2 max-w-[48%] text-xs font-medium text-primary dark:text-primary">
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
                className="absolute right-4 items-center justify-center rounded-2xl bg-primary px-5 py-4 shadow-lg active:bg-primary-container dark:bg-primary dark:active:bg-primary-container-dark"
                style={{ bottom: tabBarHeight + 24 }}
            >
                <View className="flex-row items-center gap-2">
                    <MaterialCommunityIcons name="plus" size={20} color={theme.onPrimary} />
                    <NativeText className="font-bold text-on-primary dark:text-on-primary-dark">New note</NativeText>
                </View>
            </Pressable>
        </View>
    );
}
