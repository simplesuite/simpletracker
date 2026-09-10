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
                ? 'border-primary bg-primary dark:border-primary dark:bg-primary'
                : 'border-outline-variant bg-surface dark:border-outline-variant-dark dark:bg-surface-dark'
            } ${className}`}
        >
            {icon ? <>{icon}<Text className="mr-1" /></> : null}
            <Text className={`text-sm font-semibold ${selected ? 'text-on-primary dark:text-on-primary-dark' : 'text-on-surface-variant dark:text-on-surface-variant-dark'}`}>
                {children}
            </Text>
            {onClose ? <Pressable accessibilityRole="button" accessibilityLabel="Remove" onPress={onClose} className="ml-2"><Text className="text-sm font-bold text-on-surface-variant">×</Text></Pressable> : null}
        </Pressable>
    );
}
