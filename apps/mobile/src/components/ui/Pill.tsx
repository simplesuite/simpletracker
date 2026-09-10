import type { PropsWithChildren } from 'react';
import { Pressable, Text } from 'react-native';

type PillProps = PropsWithChildren<{
    className?: string;
    onPress?: () => void;
    selected?: boolean;
}>;

export function Pill({ className = '', children, onPress, selected = false }: PillProps) {
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={onPress}
            className={`min-h-10 justify-center rounded-full border px-4 ${selected
                ? 'border-indigo-600 bg-indigo-600 dark:border-indigo-400 dark:bg-indigo-400'
                : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'
            } ${className}`}
        >
            <Text className={`text-sm font-semibold ${selected ? 'text-white dark:text-slate-950' : 'text-slate-700 dark:text-slate-200'}`}>
                {children}
            </Text>
        </Pressable>
    );
}
