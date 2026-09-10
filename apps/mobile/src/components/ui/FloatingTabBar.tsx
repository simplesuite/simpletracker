import { useContext, useEffect, useState } from 'react';
import { Keyboard, Pressable, Text as NativeText, View, type LayoutChangeEvent } from 'react-native';
import { CommonActions } from '@react-navigation/native';
import { BottomTabBarHeightCallbackContext, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useColorScheme } from 'nativewind';
import { MaterialCommunityIcons } from '@expo/vector-icons';
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

    const activeIconColor = effectiveTheme === 'dark' ? '#0f172a' : '#ffffff';
    const inactiveIconColor = effectiveTheme === 'dark' ? '#94a3b8' : '#64748b';

    const handleLayout = (event: LayoutChangeEvent) => {
        onHeightChange?.(event.nativeEvent.layout.height);
    };

    return (
        <View
            onLayout={handleLayout}
            className="absolute bottom-3 left-3 right-3 rounded-[28px] border border-slate-200 bg-white px-2 pt-2 dark:border-slate-700 dark:bg-slate-900"
            style={{
                paddingBottom: Math.max(insets.bottom, 4),
                elevation: 10,
                shadowColor: effectiveTheme === 'dark' ? '#000000' : '#0f172a',
                shadowOpacity: effectiveTheme === 'dark' ? 0.38 : 0.14,
                shadowRadius: 18,
                shadowOffset: { width: 0, height: 8 },
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
                            className={`min-h-14 flex-1 flex-row items-center justify-center rounded-3xl px-2 active:opacity-70 ${focused ? 'bg-indigo-600 dark:bg-indigo-400' : ''}`}
                        >
                            {icon}
                            <NativeText className={`ml-1.5 text-xs font-bold ${focused ? 'text-white dark:text-slate-950' : 'text-slate-500 dark:text-slate-400'}`}>
                                {label}
                            </NativeText>
                        </Pressable>
                    );
                })}
            </View>
        </View>
    );
}
