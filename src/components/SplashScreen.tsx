import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withSpring,
    withSequence,
    withDelay,
    withRepeat,
    Easing,
    interpolate,
} from 'react-native-reanimated';
import { ShoppingBag } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SplashScreen() {
    const insets = useSafeAreaInsets();
    
    const logoScale = useSharedValue(0);
    const logoOpacity = useSharedValue(0);
    const ringScale = useSharedValue(0.8);
    const ringOpacity = useSharedValue(0);
    const ring2Scale = useSharedValue(0.8);
    const ring2Opacity = useSharedValue(0);
    const textOpacity = useSharedValue(0);
    const textTranslateY = useSharedValue(30);
    const taglineOpacity = useSharedValue(0);
    const dotsOpacity = useSharedValue(0);

    useEffect(() => {
        logoOpacity.value = withTiming(1, { duration: 600 });
        logoScale.value = withSequence(
            withSpring(1.15, { damping: 8, stiffness: 100 }),
            withSpring(1, { damping: 12, stiffness: 120 })
        );

        ringScale.value = withDelay(300, withTiming(1.8, { duration: 1200, easing: Easing.out(Easing.cubic) }));
        ringOpacity.value = withDelay(300, withSequence(
            withTiming(0.4, { duration: 400 }),
            withTiming(0, { duration: 800 })
        ));

        ring2Scale.value = withDelay(500, withTiming(2.2, { duration: 1400, easing: Easing.out(Easing.cubic) }));
        ring2Opacity.value = withDelay(500, withSequence(
            withTiming(0.3, { duration: 400 }),
            withTiming(0, { duration: 1000 })
        ));

        textOpacity.value = withDelay(600, withTiming(1, { duration: 500 }));
        textTranslateY.value = withDelay(600, withSpring(0, { damping: 15, stiffness: 120 }));

        taglineOpacity.value = withDelay(900, withTiming(1, { duration: 500 }));

        dotsOpacity.value = withDelay(1200, withTiming(1, { duration: 300 }));
    }, []);

    const logoAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: logoScale.value }],
        opacity: logoOpacity.value,
    }));

    const ringAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: ringScale.value }],
        opacity: ringOpacity.value,
    }));

    const ring2AnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: ring2Scale.value }],
        opacity: ring2Opacity.value,
    }));

    const textAnimatedStyle = useAnimatedStyle(() => ({
        opacity: textOpacity.value,
        transform: [{ translateY: textTranslateY.value }],
    }));

    const taglineAnimatedStyle = useAnimatedStyle(() => ({
        opacity: taglineOpacity.value,
    }));

    const dotsAnimatedStyle = useAnimatedStyle(() => ({
        opacity: dotsOpacity.value,
    }));

    return (
        <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            <View style={styles.logoContainer}>
                <Animated.View style={[styles.ring, ringAnimatedStyle]} />
                <Animated.View style={[styles.ring2, ring2AnimatedStyle]} />
                
                <Animated.View style={[styles.logoCircle, logoAnimatedStyle]}>
                    <ShoppingBag size={48} color="#FFFFFF" strokeWidth={2.5} />
                </Animated.View>
            </View>

            <Animated.View style={textAnimatedStyle}>
                <Text style={styles.appName}>Online Store</Text>
            </Animated.View>

            <Animated.View style={taglineAnimatedStyle}>
                <Text style={styles.tagline}>Shopping made easy</Text>
            </Animated.View>

            <Animated.View style={[styles.loadingDots, dotsAnimatedStyle]}>
                <LoadingDots />
            </Animated.View>
        </View>
    );
}

function LoadingDots() {
    const dot1 = useSharedValue(0);
    const dot2 = useSharedValue(0);
    const dot3 = useSharedValue(0);

    useEffect(() => {
        dot1.value = withRepeat(
            withSequence(
                withTiming(1, { duration: 300 }),
                withTiming(0, { duration: 300 }),
                withDelay(300, withTiming(0, { duration: 0 }))
            ),
            -1,
            false
        );
        
        dot2.value = withDelay(150, withRepeat(
            withSequence(
                withTiming(1, { duration: 300 }),
                withTiming(0, { duration: 300 }),
                withDelay(300, withTiming(0, { duration: 0 }))
            ),
            -1,
            false
        ));
        
        dot3.value = withDelay(300, withRepeat(
            withSequence(
                withTiming(1, { duration: 300 }),
                withTiming(0, { duration: 300 }),
                withDelay(300, withTiming(0, { duration: 0 }))
            ),
            -1,
            false
        ));
    }, []);

    const dot1Style = useAnimatedStyle(() => ({
        opacity: interpolate(dot1.value, [0, 1], [0.3, 1]),
        transform: [{ scale: interpolate(dot1.value, [0, 1], [1, 1.3]) }],
    }));

    const dot2Style = useAnimatedStyle(() => ({
        opacity: interpolate(dot2.value, [0, 1], [0.3, 1]),
        transform: [{ scale: interpolate(dot2.value, [0, 1], [1, 1.3]) }],
    }));

    const dot3Style = useAnimatedStyle(() => ({
        opacity: interpolate(dot3.value, [0, 1], [0.3, 1]),
        transform: [{ scale: interpolate(dot3.value, [0, 1], [1, 1.3]) }],
    }));

    return (
        <View style={styles.dotsContainer}>
            <Animated.View style={[styles.dot, dot1Style]} />
            <Animated.View style={[styles.dot, dot2Style]} />
            <Animated.View style={[styles.dot, dot3Style]} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FFD147',
    },
    logoContainer: {
        width: 160,
        height: 160,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 32,
    },
    logoCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#00A082',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
        elevation: 8,
    },
    ring: {
        position: 'absolute',
        width: 100,
        height: 100,
        borderRadius: 50,
        borderWidth: 3,
        borderColor: '#00A082',
    },
    ring2: {
        position: 'absolute',
        width: 100,
        height: 100,
        borderRadius: 50,
        borderWidth: 2,
        borderColor: '#00A082',
    },
    appName: {
        fontSize: 32,
        fontWeight: '800',
        color: '#1a1a1a',
        marginBottom: 8,
        textAlign: 'center',
        letterSpacing: -0.5,
    },
    tagline: {
        fontSize: 16,
        color: '#4a4a4a',
        textAlign: 'center',
        fontWeight: '500',
    },
    loadingDots: {
        position: 'absolute',
        bottom: 80,
    },
    dotsContainer: {
        flexDirection: 'row',
        gap: 8,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#00A082',
    },
});
