/** Navigation param lists shared across the mobile app. */

export type NotesStackParamList = {
    NotesList: undefined;
    NoteDetail: { id: string };
};

export type TasksStackParamList = {
    TasksList: undefined;
    TaskDetail: { id: string };
};

export type ProjectsStackParamList = {
    ProjectsList: undefined;
    ProjectDetail: { id: string };
};

export type RootTabParamList = {
    Notes: undefined;
    Tasks: undefined;
    Projects: undefined;
    Settings: undefined;
};
