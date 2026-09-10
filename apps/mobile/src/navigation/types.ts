/** Navigation param lists shared across the mobile app. */

import type { NavigatorScreenParams } from '@react-navigation/native';

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

export type SettingsStackParamList = {
    SettingsHome: undefined;
};

export type AuthStackParamList = {
    SignIn: undefined;
    SignUp: undefined;
    ForgotPassword: undefined;
    ResetPassword: undefined;
};

export type RootTabParamList = {
    Notes: NavigatorScreenParams<NotesStackParamList>;
    Tasks: NavigatorScreenParams<TasksStackParamList>;
    Projects: NavigatorScreenParams<ProjectsStackParamList>;
    Settings: NavigatorScreenParams<SettingsStackParamList>;
};
