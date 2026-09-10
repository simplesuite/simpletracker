import type { ReactNode } from 'react';
import { useColorScheme } from 'nativewind';
import { getUiTheme } from './theme';
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
    body: 'text-base leading-6 text-on-surface dark:text-on-surface-dark',
    bodySmall: 'text-sm leading-5 text-on-surface-variant dark:text-on-surface-variant-dark',
    bodyLarge: 'text-lg leading-7 text-on-surface dark:text-on-surface-dark',
    label: 'text-sm font-semibold text-on-surface-variant dark:text-on-surface-variant-dark',
    title: 'text-lg font-bold text-on-surface dark:text-on-surface-dark',
    titleLarge: 'text-xl font-bold text-on-surface dark:text-on-surface-dark',
    headline: 'text-3xl font-bold tracking-tight text-on-surface dark:text-on-surface-dark',
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
        container: 'bg-primary dark:bg-primary',
        text: 'text-on-primary dark:text-on-primary-dark',
    },
    tonal: {
        container: 'bg-primary-container dark:bg-primary-container-dark',
        text: 'text-on-primary-container dark:text-on-primary-container-dark',
    },
    outlined: {
        container: 'border border-outline bg-transparent dark:border-outline-dark',
        text: 'text-on-surface dark:text-on-surface-dark',
    },
    text: {
        container: 'bg-transparent',
        text: 'text-primary dark:text-primary',
    },
    danger: {
        container: 'bg-transparent',
        text: 'text-error dark:text-error-dark',
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
    const { colorScheme } = useColorScheme();
    const theme = getUiTheme(colorScheme === 'dark' ? 'dark' : 'light');
    const styles = buttonVariants[variant];
    const isDisabled = disabled || loading;

    return (
        <Pressable
            {...props}
            disabled={isDisabled}
            accessibilityState={{ ...props.accessibilityState, disabled: isDisabled }}
            className={`min-h-12 flex-row items-center justify-center rounded-2xl px-5 active:opacity-70 disabled:opacity-50 ${compact ? 'min-h-10 rounded-xl px-3' : ''} ${styles.container} ${className}`}
        >
            {loading ? <ActivityIndicator size="small" color={variant === 'contained' ? theme.onPrimary : theme.primary} /> : icon}
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
    borderless?: boolean;
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
    borderless = false,
    ...props
}: TextFieldProps) {
    const { colorScheme } = useColorScheme();
    const theme = getUiTheme(colorScheme === 'dark' ? 'dark' : 'light');
    const fieldClasses = borderless
        ? 'min-h-0 flex-row items-center rounded-none border-0 bg-transparent px-0 dark:bg-transparent'
        : `min-h-14 flex-row items-center rounded-2xl border bg-surface px-4 dark:bg-surface-dark ${error ? 'border-error dark:border-error-dark' : 'border-outline dark:border-outline-dark'}`;
    return (
        <View className={`w-full ${className}`}>
            {label ? <NativeText className="mb-2 text-sm font-semibold text-on-surface-variant dark:text-on-surface-variant-dark">{label}</NativeText> : null}
            <View className={`${fieldClasses} ${!editable ? 'opacity-70' : ''}`}>
                {leading ? <View className="mr-3">{leading}</View> : null}
                <NativeTextInput
                    {...props}
                    editable={editable}
                    multiline={multiline}
                    placeholderTextColor={placeholderTextColor ?? theme.onSurfaceVariant}
                    className={`min-w-0 flex-1 ${borderless ? 'py-0' : 'py-3'} text-base text-on-surface dark:text-on-surface-dark ${multiline ? 'min-h-28' : ''} ${inputClassName}`}
                    style={inputStyle}
                />
                {trailing ? <View className="ml-3">{trailing}</View> : null}
            </View>
            {helperText ? <NativeText className={`mt-1 text-sm ${error ? 'text-error dark:text-error-dark' : 'text-on-surface-variant dark:text-on-surface-variant-dark'}`}>{helperText}</NativeText> : null}
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
    const classes = `rounded-3xl border border-outline-variant bg-surface dark:border-outline-variant-dark dark:bg-surface-dark ${disabled ? 'opacity-50' : ''} ${className}`;
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
            className={`h-9 w-9 items-center justify-center rounded-xl active:bg-surface-variant dark:active:bg-surface-variant-dark ${className}`}
        >
            <View className={`h-5 w-5 items-center justify-center rounded-md border-2 ${checked ? 'border-primary bg-primary dark:border-primary dark:bg-primary' : 'border-outline dark:border-outline-dark'}`}>
                {checked ? <NativeText className="text-xs font-black text-on-primary dark:text-on-primary-dark">✓</NativeText> : null}
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
            className={`h-9 w-9 items-center justify-center rounded-full active:bg-surface-variant dark:active:bg-surface-variant-dark ${className}`}
        >
            <View className={`h-5 w-5 items-center justify-center rounded-full border-2 ${checked ? 'border-primary dark:border-primary' : 'border-outline dark:border-outline-dark'}`}>
                {checked ? <View className="h-2.5 w-2.5 rounded-full bg-primary dark:bg-primary" /> : null}
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
    const { colorScheme } = useColorScheme();
    const theme = getUiTheme(colorScheme === 'dark' ? 'dark' : 'light');
    return (
        <NativeSwitch
            value={value}
            onValueChange={onValueChange}
            disabled={disabled}
            accessibilityLabel={accessibilityLabel}
            trackColor={{ false: theme.outline, true: theme.primary }}
            thumbColor={value ? theme.primary : theme.surface}
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
            <View className="flex-1 items-center justify-center bg-scrim px-5">
                <View className="w-full max-w-md rounded-3xl border border-outline-variant bg-surface p-5 dark:border-outline-dark dark:bg-surface-dark">
                    <NativeText className="text-xl font-bold text-on-surface dark:text-on-surface-dark">{title}</NativeText>
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
            <View className="flex-row items-center rounded-2xl bg-surface-dark px-4 py-3 shadow-lg">
                <NativeText className="min-w-0 flex-1 text-sm text-on-surface-dark">{children}</NativeText>
                <Pressable accessibilityRole="button" onPress={onAction ?? onDismiss} className="ml-3 rounded-xl px-2 py-1 active:opacity-70">
                    <NativeText className="text-sm font-bold text-primary">{actionLabel}</NativeText>
                </Pressable>
            </View>
        </View>
    );
}

export function Divider({ className = '', style }: { className?: string; style?: StyleProp<ViewStyle> }) {
    return <View className={`h-px bg-outline-variant dark:bg-outline-variant-dark ${className}`} style={style} />;
}
