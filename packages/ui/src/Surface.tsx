import type { PropsWithChildren } from 'react';
import { View, type ViewProps } from 'react-native';

type SurfaceProps = PropsWithChildren<ViewProps & { className?: string }>;

export function Surface({ className = '', children, ...props }: SurfaceProps) {
    return (
        <View
            {...props}
            className={`rounded-3xl border border-outline-variant bg-surface dark:border-outline-variant-dark dark:bg-surface-dark ${className}`}
        >
            {children}
        </View>
    );
}
