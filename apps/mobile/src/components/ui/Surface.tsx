import type { PropsWithChildren } from 'react';
import { View, type ViewProps } from 'react-native';

type SurfaceProps = PropsWithChildren<ViewProps & { className?: string }>;

export function Surface({ className = '', children, ...props }: SurfaceProps) {
    return (
        <View
            {...props}
            className={`rounded-3xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 ${className}`}
        >
            {children}
        </View>
    );
}
