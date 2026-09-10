import type { ReactNode } from 'react';
import {
    ActivityIndicator,
    Modal,
    Pressable,
    Switch as NativeSwitch,
    Text as NativeText,
    TextInput as NativeTextInput,
    View,
    type PressableProps,
    type StyleProp,
    type TextInputProps,
    type TextProps as NativeTextProps,
    type TextStyle,
    type ViewProps,
    type ViewStyle,
} from 'react-native';

type UiTextProps = NativeTextProps & {
    className?: string;
    variant?: 'body' | 'bodySmall' | 'bodyLarge' | 'label' | 'title' | 'titleLarge' | 'headline';
};

const textVariants: Record<NonNullable<UiTextProps['variant']>, string> = {
    body: 'text-base leading-6 text-slate-900 dark:text-slate-50',
    bodySmall: 'text-sm leading-5 text-slate-500 dark:text-slate-400',
    bodyLarge: 'text-lg leading-7 text-slate-900 dark:text-slate-50',
    label: 'text-sm font-semibold text-slate-700 dark:text-slate-200',
    title: 'text-lg font-bold text-slate-950 dark:text-slate-50',
    titleLarge: 'text-xl font-bold text-slate-950 dark:text-slate-50',
    headline: 'text-3xl font-bold tracking-tight text-slate-950 dark:text-slate-50',
};

export function Text({ variant = 'body', className = '', ...props }: UiTextProps) {
    return <NativeText {...props} className={`${textVariants[variant]} ${className}`} />;
}

type ButtonProps = Omit<PressableProps, 'children'> & {
    children?: ReactNode;
    className?: string;
    textClassName?: string;
    variant?: 'contained' | 'tonal' | 'outlined' | 'text' | 'danger';
    compact?: boolean;
    loading?: boolean;
    icon?: ReactNode;
};

const buttonVariants: Record<NonNullable<ButtonProps['variant']>, { container: string; text: string }> = {
    contained: {
        container: 'bg-indigo-600 dark:bg-indigo-400',
        text: 'text-white dark:text-slate-950',
    },
    tonal: {
        container: 'bg-indigo-100 dark:bg-indigo-950',
        text: 'text-indigo-700 dark:text-indigo-200',
    },
    outlined: {
        container: 'border border-slate-300 bg-transparent dark:border-slate-600',
        text: 'text-slate-800 dark:text-slate-100',
    },
    text: {
        container: 'bg-transparent',
        text: 'text-indigo-600 dark:text-indigo-300',
    },
    danger: {
        container: 'bg-transparent',
        text: 'text-red-600 dark:text-red-300',
    },
};

export function Button({
    children,
    className = '',
    textClassName = '',
    variant = 'contained',
    compact = false,
    loading = false,
    disabled = false,
    icon,
    ...props
}: ButtonProps) {
    const styles = buttonVariants[variant];
    const isDisabled = disabled || loading;

    return (
        <Pressable
            {...props}
            disabled={isDisabled}
            accessibilityState={{ ...props.accessibilityState, disabled: isDisabled }}
            className={`min-h-12 flex-row items-center justify-center rounded-2xl px-5 active:opacity-70 disabled:opacity-50 ${compact ? 'min-h-10 rounded-xl px-3' : ''} ${styles.container} ${className}`}
        >
            {loading ? <ActivityIndicator size="small" color={variant === 'contained' ? '#ffffff' : '#4f46e5'} /> : icon}
            {!loading && icon ? <View className="mr-2" /> : null}
            {children !== undefined && (
                <NativeText className={`text-center text-sm font-bold ${styles.text} ${textClassName}`}>
                    {children}
                </NativeText>
            )}
        </Pressable>
    );
}

type TextFieldProps = Omit<TextInputProps, 'style'> & {
    className?: string;
    inputClassName?: string;
    inputStyle?: StyleProp<TextStyle>;
    label?: string;
    error?: boolean;
    helperText?: string;
    leading?: ReactNode;
    trailing?: ReactNode;
};

export function TextField({
    className = '',
    inputClassName = '',
    inputStyle,
    label,
    error = false,
    helperText,
    leading,
    trailing,
    multiline,
    editable = true,
    placeholderTextColor,
    ...props
}: TextFieldProps) {
    return (
        <View className={`w-full ${className}`}>
            {label ? <NativeText className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">{label}</NativeText> : null}
            <View className={`min-h-14 flex-row items-center rounded-2xl border bg-white px-4 dark:bg-slate-900 ${error ? 'border-red-500 dark:border-red-400' : 'border-slate-300 dark:border-slate-700'} ${!editable ? 'opacity-70' : ''}`}>
                {leading ? <View className="mr-3">{leading}</View> : null}
                <NativeTextInput
                    {...props}
                    editable={editable}
                    multiline={multiline}
                    placeholderTextColor={placeholderTextColor ?? '#94a3b8'}
                    className={`min-w-0 flex-1 py-3 text-base text-slate-950 dark:text-slate-50 ${multiline ? 'min-h-28' : ''} ${inputClassName}`}
                    style={inputStyle}
                />
                {trailing ? <View className="ml-3">{trailing}</View> : null}
            </View>
            {helperText ? <NativeText className={`mt-1 text-sm ${error ? 'text-red-600 dark:text-red-300' : 'text-slate-500 dark:text-slate-400'}`}>{helperText}</NativeText> : null}
        </View>
    );
}

type CardProps = ViewProps & {
    className?: string;
    onPress?: PressableProps['onPress'];
    disabled?: boolean;
    children?: ReactNode;
};

export function Card({ className = '', onPress, disabled = false, children, ...props }: CardProps) {
    const classes = `rounded-3xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 ${disabled ? 'opacity-50' : ''} ${className}`;
    if (onPress) {
        return (
            <Pressable onPress={onPress} disabled={disabled} className={`${classes} active:opacity-70`}>
                {children}
            </Pressable>
        );
    }
    return <View {...props} className={classes}>{children}</View>;
}

type CheckboxProps = {
    status?: 'checked' | 'unchecked';
    onPress?: PressableProps['onPress'];
    disabled?: boolean;
    accessibilityLabel?: string;
    className?: string;
};

export function Checkbox({ status = 'unchecked', onPress, disabled = false, accessibilityLabel, className = '' }: CheckboxProps) {
    const checked = status === 'checked';
    return (
        <Pressable
            accessibilityRole="checkbox"
            accessibilityLabel={accessibilityLabel}
            accessibilityState={{ checked, disabled }}
            disabled={disabled}
            onPress={onPress}
            className={`h-9 w-9 items-center justify-center rounded-xl active:bg-slate-100 dark:active:bg-slate-800 ${className}`}
        >
            <View className={`h-5 w-5 items-center justify-center rounded-md border-2 ${checked ? 'border-indigo-600 bg-indigo-600 dark:border-indigo-400 dark:bg-indigo-400' : 'border-slate-400 dark:border-slate-500'}`}>
                {checked ? <NativeText className="text-xs font-black text-white dark:text-slate-950">✓</NativeText> : null}
            </View>
        </Pressable>
    );
}

type RadioProps = {
    checked?: boolean;
    onPress?: PressableProps['onPress'];
    disabled?: boolean;
    accessibilityLabel?: string;
    className?: string;
};

export function Radio({ checked = false, onPress, disabled = false, accessibilityLabel, className = '' }: RadioProps) {
    return (
        <Pressable
            accessibilityRole="radio"
            accessibilityLabel={accessibilityLabel}
            accessibilityState={{ selected: checked, disabled }}
            disabled={disabled}
            onPress={onPress}
            className={`h-9 w-9 items-center justify-center rounded-full active:bg-slate-100 dark:active:bg-slate-800 ${className}`}
        >
            <View className={`h-5 w-5 items-center justify-center rounded-full border-2 ${checked ? 'border-indigo-600 dark:border-indigo-400' : 'border-slate-400 dark:border-slate-500'}`}>
                {checked ? <View className="h-2.5 w-2.5 rounded-full bg-indigo-600 dark:bg-indigo-400" /> : null}
            </View>
        </Pressable>
    );
}

type SwitchProps = {
    value: boolean;
    onValueChange?: (value: boolean) => void;
    disabled?: boolean;
    accessibilityLabel?: string;
};

export function Switch({ value, onValueChange, disabled = false, accessibilityLabel }: SwitchProps) {
    return (
        <NativeSwitch
            value={value}
            onValueChange={onValueChange}
            disabled={disabled}
            accessibilityLabel={accessibilityLabel}
            trackColor={{ false: '#cbd5e1', true: '#818cf8' }}
            thumbColor={value ? '#4f46e5' : '#f8fafc'}
        />
    );
}

type DialogProps = {
    visible: boolean;
    onDismiss: () => void;
    title: string;
    children: ReactNode;
    actions?: ReactNode;
};

export function Dialog({ visible, onDismiss, title, children, actions }: DialogProps) {
    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
            <View className="flex-1 items-center justify-center bg-black/50 px-5">
                <View className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
                    <NativeText className="text-xl font-bold text-slate-950 dark:text-slate-50">{title}</NativeText>
                    <View className="mt-4">{children}</View>
                    {actions ? <View className="mt-5 flex-row justify-end gap-2">{actions}</View> : null}
                </View>
            </View>
        </Modal>
    );
}

type SnackbarProps = {
    visible: boolean;
    children: ReactNode;
    onDismiss: () => void;
    actionLabel?: string;
    onAction?: () => void;
    bottomOffset?: number;
};

export function Snackbar({ visible, children, onDismiss, actionLabel = 'Dismiss', onAction, bottomOffset = 24 }: SnackbarProps) {
    if (!visible) return null;
    return (
        <View className="absolute left-4 right-4" style={{ bottom: bottomOffset }}>
            <View className="flex-row items-center rounded-2xl bg-slate-900 px-4 py-3 shadow-lg dark:bg-slate-100">
                <NativeText className="min-w-0 flex-1 text-sm text-white dark:text-slate-900">{children}</NativeText>
                <Pressable accessibilityRole="button" onPress={onAction ?? onDismiss} className="ml-3 rounded-xl px-2 py-1 active:opacity-70">
                    <NativeText className="text-sm font-bold text-indigo-300 dark:text-indigo-700">{actionLabel}</NativeText>
                </Pressable>
            </View>
        </View>
    );
}

export function Divider({ className = '', style }: { className?: string; style?: StyleProp<ViewStyle> }) {
    return <View className={`h-px bg-slate-200 dark:bg-slate-800 ${className}`} style={style} />;
}
