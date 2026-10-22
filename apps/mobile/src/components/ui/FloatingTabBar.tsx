import { useContext, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Keyboard, Pressable, Text as NativeText, View, type LayoutChangeEvent } from 'react-native';
import { CommonActions } from '@react-navigation/native';
import { BottomTabBarHeightCallbackContext, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useColorScheme } from 'nativewind';
import { getUiTheme } from '@simpletracker/ui';
import { useThemeStore } from '../../store/themeStore';

const GAP = 4;
// Keep the slide/label timings in sync with the web FloatingTabBar.
const SLIDE_DURATION = 280;
const FADE_DURATION = 200;
const EASING = Easing.bezier(0.22, 1, 0.36, 1);

export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
    const onHeightChange = useContext(BottomTabBarHeightCallbackContext);
    const { effectiveTheme } = useThemeStore();
    const { setColorScheme } = useColorScheme();
    const focusedRoute = state.routes[state.index];
    const focusedOptions = descriptors[focusedRoute.key]?.options;
    const [keyboardVisible, setKeyboardVisible] = useState(false);
    // Inner row width (excluding the bar's horizontal padding) used to size and
    // position the sliding indicator.
    const [rowWidth, setRowWidth] = useState(0);

    const tabCount = state.routes.length;
    const slotWidth = rowWidth > 0 ? (rowWidth - GAP * (tabCount - 1)) / tabCount : 0;

    // Animated value that tracks the active tab index; the indicator derives its
    // horizontal offset from it so selection slides instead of jumping.
    const indicatorIndex = useRef(new Animated.Value(state.index)).current;

    useEffect(() => {
        setColorScheme(effectiveTheme);
    }, [effectiveTheme, setColorScheme]);

    useEffect(() => {
        Animated.timing(indicatorIndex, {
            toValue: state.index,
            duration: SLIDE_DURATION,
            easing: EASING,
            useNativeDriver: true,
        }).start();
    }, [state.index, indicatorIndex]);

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

    // Hide the bar entirely when the focused tab requests it (e.g. on a detail
    // screen), mirroring the web app where the bar disappears on detail pages.
    const tabBarStyle = focusedOptions?.tabBarStyle as { display?: string } | undefined;
    if (tabBarStyle?.display === 'none') {
        return null;
    }

    const theme = getUiTheme(effectiveTheme);
    const activeIconColor = theme.onPrimary;
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
            <View
                className="flex-row items-center"
                style={{ gap: GAP }}
                onLayout={(event) => setRowWidth(event.nativeEvent.layout.width)}
            >
                {/* Sliding active-tab indicator, mirroring the web tab bar. */}
                {slotWidth > 0 && tabCount > 1 ? (
                    <Animated.View
                        pointerEvents="none"
                        style={{
                            position: 'absolute',
                            top: 0,
                            bottom: 0,
                            left: 0,
                            width: slotWidth,
                            borderRadius: 30,
                            backgroundColor: theme.primary,
                            transform: [{
                                translateX: indicatorIndex.interpolate({
                                    inputRange: state.routes.map((_, i) => i),
                                    outputRange: state.routes.map((_, i) => i * (slotWidth + GAP)),
                                }),
                            }],
                        }}
                    />
                ) : null}
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
                            className="min-h-[50px] flex-1 flex-row items-center justify-center rounded-[30px] px-1 active:opacity-70"
                        >
                            {icon}
                            <TabLabel focused={focused} color={focused ? activeIconColor : inactiveIconColor}>
                                {label}
                            </TabLabel>
                        </Pressable>
                    );
                })}
            </View>
        </View>
    );
}

/**
 * Tab label that only reveals itself for the active tab: inactive tabs collapse
 * to just the icon (width + opacity animate to 0), matching the web tab bar.
 */
function TabLabel({ focused, color, children }: { focused: boolean; color: string; children: string }) {
    const reveal = useRef(new Animated.Value(focused ? 1 : 0)).current;
    const [textWidth, setTextWidth] = useState(0);

    useEffect(() => {
        Animated.timing(reveal, {
            toValue: focused ? 1 : 0,
            duration: focused ? SLIDE_DURATION : FADE_DURATION,
            easing: EASING,
            useNativeDriver: false,
        }).start();
    }, [focused, reveal]);

    return (
        <Animated.View
            style={{
                overflow: 'hidden',
                opacity: reveal,
                maxWidth: textWidth > 0 ? reveal.interpolate({ inputRange: [0, 1], outputRange: [0, textWidth + 6] }) : undefined,
                marginLeft: reveal.interpolate({ inputRange: [0, 1], outputRange: [0, 4] }),
            }}
        >
            {/* Hidden measurer keeps the animated label at its natural width. */}
            <NativeText
                onLayout={(event) => {
                    const width = event.nativeEvent.layout.width;
                    if (width > 0 && width !== textWidth) setTextWidth(width);
                }}
                numberOfLines={1}
                className="text-[11px] font-semibold"
                style={{ color }}
            >
                {children}
            </NativeText>
        </Animated.View>
    );
}
