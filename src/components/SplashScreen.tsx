import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, useWindowDimensions } from 'react-native';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Zap } from 'lucide-react-native';

const mascotImage = require('../../assets/splash-mascot.png');

const BRAND = 'East Africa Online';
const TAGLINE = 'Where Africa shops together';

const TEAL = '#00A082';
const YELLOW = '#FDB913';
const INK = '#111827';
const MUTED = '#64748b';

export default function SplashScreen() {
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();

    // Mascot entrance
    const logoOpacity = useSharedValue(0);
    const logoScale = useSharedValue(0.7);

    // Self-writing brand text
    const [typedCount, setTypedCount] = useState(0);

    // Tagline
    const taglineOpacity = useSharedValue(0);
    const taglineTranslateY = useSharedValue(12);

    // Underline
    const underlineWidth = useSharedValue(0);

    // Loading dots
    const dotsOpacity = useSharedValue(0);

    // Promo chip
    const chipOpacity = useSharedValue(0);
    const chipTranslateY = useSharedValue(8);

    useEffect(() => {
        // Mascot entrance
        logoOpacity.value = withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) });
        logoScale.value = withSequence(
            withSpring(1.06, { damping: 10, stiffness: 110 }),
            withSpring(1, { damping: 14, stiffness: 120 })
        );

        // Self-writing brand text — type one char every ~70ms after a 600ms delay
        const startDelay = 600;
        const perChar = 70;
        const timeouts: ReturnType<typeof setTimeout>[] = [];
        for (let i = 1; i <= BRAND.length; i++) {
            timeouts.push(
                setTimeout(() => setTypedCount(i), startDelay + i * perChar)
            );
        }

        // Underline grows after typing completes
        const underlineDelay = startDelay + BRAND.length * perChar + 100;
        underlineWidth.value = withDelay(
            underlineDelay,
            withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) })
        );

        // Tagline fades in after underline
        taglineOpacity.value = withDelay(
            underlineDelay + 350,
            withTiming(1, { duration: 500 })
        );
        taglineTranslateY.value = withDelay(
            underlineDelay + 350,
            withSpring(0, { damping: 14, stiffness: 110 })
        );

        // Promo chip
        chipOpacity.value = withDelay(
            underlineDelay + 600,
            withTiming(1, { duration: 400 })
        );
        chipTranslateY.value = withDelay(
            underlineDelay + 600,
            withSpring(0, { damping: 14, stiffness: 110 })
        );

        // Loading dots
        dotsOpacity.value = withDelay(
            underlineDelay + 700,
            withTiming(1, { duration: 300 })
        );

        return () => timeouts.forEach(clearTimeout);
    }, []);

    const logoStyle = useAnimatedStyle(() => ({
        opacity: logoOpacity.value,
        transform: [{ scale: logoScale.value }],
    }));

    const taglineStyle = useAnimatedStyle(() => ({
        opacity: taglineOpacity.value,
        transform: [{ translateY: taglineTranslateY.value }],
    }));

    const chipStyle = useAnimatedStyle(() => ({
        opacity: chipOpacity.value,
        transform: [{ translateY: chipTranslateY.value }],
    }));

    const dotsStyle = useAnimatedStyle(() => ({
        opacity: dotsOpacity.value,
    }));

    // Underline grows from 0 to brand text width (~ measured visually)
    const maxUnderline = Math.min(width * 0.7, 360);
    const underlineStyle = useAnimatedStyle(() => ({
        width: interpolate(underlineWidth.value, [0, 1], [0, maxUnderline]),
    }));

    const typedText = BRAND.slice(0, typedCount);
    const showCaret = typedCount < BRAND.length;

    return (
        <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            <View style={styles.content}>
                {/* Mascot inside a soft yellow halo (matches dashboard promo card) */}
                <View style={styles.logoArea}>
                    <View style={styles.haloOuter} />
                    <View style={styles.haloInner} />
                    <Animated.View style={[styles.mascotWrap, logoStyle]}>
                        <Image
                            source={mascotImage}
                            style={styles.mascot}
                            resizeMode="contain"
                        />
                    </Animated.View>
                </View>

                {/* Self-writing brand name */}
                <View style={styles.brandRow}>
                    <Text style={styles.brand}>
                        {typedText}
                        {showCaret ? <Text style={styles.caret}>|</Text> : null}
                    </Text>
                </View>

                {/* Animated yellow underline */}
                <Animated.View style={[styles.underline, underlineStyle]} />

                {/* Tagline */}
                <Animated.View style={taglineStyle}>
                    <Text style={styles.tagline}>{TAGLINE}</Text>
                </Animated.View>

                {/* Promo chip echoing the dashboard banner */}
                <Animated.View style={[styles.chip, chipStyle]}>
                    <View style={styles.chipIcon}>
                        <Zap size={14} color={YELLOW} fill={YELLOW} />
                    </View>
                    <Text style={styles.chipText}>Free delivery across East Africa</Text>
                </Animated.View>
            </View>

            {/* Loading dots */}
            <Animated.View style={[styles.loadingDots, dotsStyle]}>
                <LoadingDots />
            </Animated.View>

            <View style={styles.footer}>
                <Text style={styles.footerText}>eastafricaonline.com</Text>
            </View>
        </View>
    );
}

function LoadingDots() {
    const dot1 = useSharedValue(0);
    const dot2 = useSharedValue(0);
    const dot3 = useSharedValue(0);

    useEffect(() => {
        const cfg = (sv: typeof dot1, delay: number) => {
            sv.value = withDelay(
                delay,
                withRepeat(
                    withSequence(
                        withTiming(1, { duration: 400 }),
                        withTiming(0, { duration: 400 }),
                        withDelay(200, withTiming(0, { duration: 0 }))
                    ),
                    -1,
                    false
                )
            );
        };
        cfg(dot1, 0);
        cfg(dot2, 200);
        cfg(dot3, 400);
    }, []);

    const dot1Style = useAnimatedStyle(() => ({
        opacity: interpolate(dot1.value, [0, 1], [0.25, 1]),
        transform: [{ scale: interpolate(dot1.value, [0, 1], [1, 1.3]) }],
    }));
    const dot2Style = useAnimatedStyle(() => ({
        opacity: interpolate(dot2.value, [0, 1], [0.25, 1]),
        transform: [{ scale: interpolate(dot2.value, [0, 1], [1, 1.3]) }],
    }));
    const dot3Style = useAnimatedStyle(() => ({
        opacity: interpolate(dot3.value, [0, 1], [0.25, 1]),
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
        backgroundColor: '#FFFFFF',
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    logoArea: {
        width: 260,
        height: 260,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 28,
    },
    haloOuter: {
        position: 'absolute',
        width: 260,
        height: 260,
        borderRadius: 130,
        backgroundColor: 'rgba(253, 185, 19, 0.10)',
    },
    haloInner: {
        position: 'absolute',
        width: 210,
        height: 210,
        borderRadius: 105,
        backgroundColor: 'rgba(253, 185, 19, 0.18)',
    },
    mascotWrap: {
        width: 220,
        height: 220,
        alignItems: 'center',
        justifyContent: 'center',
    },
    mascot: {
        width: 220,
        height: 220,
    },
    brandRow: {
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 44,
    },
    brand: {
        fontSize: 32,
        fontWeight: '900',
        color: INK,
        textAlign: 'center',
        letterSpacing: -0.5,
    },
    caret: {
        fontSize: 32,
        fontWeight: '300',
        color: TEAL,
    },
    underline: {
        height: 4,
        backgroundColor: YELLOW,
        borderRadius: 2,
        marginTop: 10,
    },
    tagline: {
        fontSize: 15,
        color: MUTED,
        textAlign: 'center',
        fontWeight: '600',
        marginTop: 16,
    },
    chip: {
        marginTop: 22,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFBEB',
        borderColor: '#FDE68A',
        borderWidth: 1,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 999,
    },
    chipIcon: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
    },
    chipText: {
        fontSize: 12,
        fontWeight: '800',
        color: INK,
        letterSpacing: 0.2,
    },
    loadingDots: {
        alignItems: 'center',
        paddingBottom: 28,
    },
    dotsContainer: {
        flexDirection: 'row',
        gap: 10,
    },
    dot: {
        width: 9,
        height: 9,
        borderRadius: 5,
        backgroundColor: TEAL,
    },
    footer: {
        alignItems: 'center',
        paddingBottom: 20,
    },
    footerText: {
        fontSize: 12,
        color: '#9ca3af',
        fontWeight: '600',
        letterSpacing: 0.5,
    },
});
