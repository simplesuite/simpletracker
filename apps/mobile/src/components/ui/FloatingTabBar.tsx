import { useContext, useEffect, useState } from 'react';
import { Keyboard, Pressable, Text as NativeText, View, type LayoutChangeEvent } from 'react-native';
import { CommonActions } from '@react-navigation/native';
import { BottomTabBarHeightCallbackContext, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useColorScheme } from 'nativewind';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getUiTheme } from '@simpletracker/ui';
import { useThemeStore } from '../../store/themeStore';

export function FloatingTabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
    const onHeightChange = useContext(BottomTabBarHeightCallbackContext);
    const { effectiveTheme } = useThemeStore();
    const { setColorScheme } = useColorScheme();
    const focusedRoute = state.routes[state.index];
    const focusedOptions = descriptors[focusedRoute.key]?.options;
    const [keyboardVisible, setKeyboardVisible] = useState(false);

    useEffect(() => {
        setColorScheme(effectiveTheme);
    }, [effectiveTheme, setColorScheme]);

    useEffect(() => {
        const showSubscription = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
        const hideSubscription = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
        return () => {
            showSubscription.remove();
            hideSubscription.remove();
        };
    }, []);

    if (focusedOptions?.tabBarHideOnKeyboard && keyboardVisible) {
        return null;
    }

    const theme = getUiTheme(effectiveTheme);
    const activeIconColor = theme.onPrimaryContainer;
    const inactiveIconColor = theme.onSurfaceVariant;

    const handleLayout = (event: LayoutChangeEvent) => {
        onHeightChange?.(event.nativeEvent.layout.height);
    };

    return (
        <View
            onLayout={handleLayout}
            className="absolute bottom-3 left-3 right-3 rounded-[30px] border px-1 py-1"
            style={{
                backgroundColor: effectiveTheme === 'dark' ? 'rgba(32, 32, 35, 0.82)' : 'rgba(255, 255, 255, 0.9)',
                borderColor: effectiveTheme === 'dark' ? 'rgba(71, 85, 105, 0.65)' : 'rgba(203, 213, 225, 0.7)',
                elevation: 4,
                shadowColor: theme.scrim,
                shadowOpacity: effectiveTheme === 'dark' ? 0.24 : 0.08,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 4 },
            }}
        >
            <View className="flex-row items-center gap-1">
                {state.routes.map((route, index) => {
                    const focused = state.index === index;
                    const options = descriptors[route.key]?.options;
                    const label = typeof options?.title === 'string' ? options.title : route.name;
                    const icon = options?.tabBarIcon?.({
                        focused,
                        color: focused ? activeIconColor : inactiveIconColor,
                        size: 22,
                    });

                    const onPress = () => {
                        const event = navigation.emit({
                            type: 'tabPress',
                            target: route.key,
                            canPreventDefault: true,
                        });
                        if (!focused && !event.defaultPrevented) {
                            navigation.dispatch({
                                ...CommonActions.navigate(route.name, route.params),
                                target: state.key,
                            });
                        }
                    };

                    const onLongPress = () => {
                        navigation.emit({ type: 'tabLongPress', target: route.key });
                    };

                    return (
                        <Pressable
                            key={route.key}
                            accessibilityLabel={options?.tabBarAccessibilityLabel ?? label}
                            accessibilityRole="tab"
                            accessibilityState={{ selected: focused }}
                            testID={options?.tabBarButtonTestID}
                            onPress={onPress}
                            onLongPress={onLongPress}
                            className={`min-h-[50px] rounded-[30px] flex-1 flex-row items-center justify-center rounded-2xl px-1 active:opacity-70 ${focused ? 'bg-primary-container dark:bg-primary-container-dark' : ''}`}
                        >
                            {icon}
                            <NativeText className={`ml-1 text-[11px] font-semibold ${focused ? 'text-on-primary-container dark:text-on-primary-container-dark' : 'text-on-surface-variant dark:text-on-surface-variant-dark'}`}>
                                {label}
                            </NativeText>
                        </Pressable>
                    );
                })}
            </View>
        </View>
    );
}
