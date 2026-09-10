import type { PropsWithChildren, ReactNode } from 'react';
import { Pressable, Text } from 'react-native';
import type { PressableProps } from 'react-native';

type PillProps = PropsWithChildren<{
    className?: string;
    onPress?: PressableProps['onPress'];
    onClose?: () => void;
    selected?: boolean;
    disabled?: boolean;
    compact?: boolean;
    icon?: ReactNode;
}>;

export function Pill({ className = '', children, onPress, onClose, selected = false, disabled = false, compact = false, icon }: PillProps) {
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected, disabled }}
            disabled={disabled}
            onPress={onPress}
            className={`min-h-10 flex-row items-center justify-center rounded-full border px-4 active:opacity-70 disabled:opacity-50 ${compact ? 'min-h-9 px-3' : ''} ${selected
                ? 'border-indigo-600 bg-indigo-600 dark:border-indigo-400 dark:bg-indigo-400'
                : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'
            } ${className}`}
        >
            {icon ? <>{icon}<Text className="mr-1" /></> : null}
            <Text className={`text-sm font-semibold ${selected ? 'text-white dark:text-slate-950' : 'text-slate-700 dark:text-slate-200'}`}>
                {children}
            </Text>
            {onClose ? <Pressable accessibilityRole="button" accessibilityLabel="Remove" onPress={onClose} className="ml-2"><Text className="text-sm font-bold text-slate-500">×</Text></Pressable> : null}
        </Pressable>
    );
}
