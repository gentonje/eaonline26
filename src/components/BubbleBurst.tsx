import * as React from 'react';
import { useEffect } from 'react';
import { View, Platform } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withSequence,
    withDelay,
    Easing,
} from 'react-native-reanimated';

interface BubbleProps {
    angle: number;
    distance: number;
    size: number;
    delay: number;
    color: string;
    duration: number;
}

function Bubble({ angle, distance, size, delay, color, duration }: BubbleProps) {
    const progress = useSharedValue(0);
    const opacity = useSharedValue(0);

    useEffect(() => {
        progress.value = withDelay(delay, withTiming(1, { duration, easing: Easing.out(Easing.cubic) }));
        opacity.value = withDelay(
            delay,
            withSequence(
                withTiming(1, { duration: 80 }),
                withTiming(0, { duration: duration - 80, easing: Easing.in(Easing.quad) })
            )
        );
    }, []);

    const style = useAnimatedStyle(() => {
        const dx = Math.cos(angle) * distance * progress.value;
        const dy = Math.sin(angle) * distance * progress.value - 10 * progress.value * progress.value;
        const scale = 0.4 + 0.8 * (1 - Math.abs(progress.value - 0.4));
        return {
            opacity: opacity.value,
            transform: [{ translateX: dx }, { translateY: dy }, { scale }],
        };
    });

    return (
        <Animated.View
            pointerEvents="none"
            style={[
                {
                    position: 'absolute',
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    backgroundColor: color,
                    left: -size / 2,
                    top: -size / 2,
                },
                style,
            ]}
        />
    );
}

interface BubbleBurstProps {
    /** Change this number to trigger a new burst. */
    triggerKey: number;
    /** Optional palette of colors. Defaults to brand teal/yellow. */
    colors?: string[];
}

export default function BubbleBurst({ triggerKey, colors = ['#00A082', '#FDB913', '#ffffff', '#34d399'] }: BubbleBurstProps) {
    // Play pop sound on web (Web Audio API). No-op on native.
    useEffect(() => {
        if (triggerKey === 0) return;
        if (Platform.OS !== 'web' || typeof window === 'undefined') return;
        let closeTimer: any;
        let ctx: any;
        try {
            const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
            if (!AC) return;
            ctx = new AC();
            const now = ctx!.currentTime;

            // High blip
            const o1 = ctx!.createOscillator();
            const g1 = ctx.createGain();
            o1.type = 'sine';
            o1.frequency.setValueAtTime(880, now);
            o1.frequency.exponentialRampToValueAtTime(1760, now + 0.08);
            g1.gain.setValueAtTime(0.0001, now);
            g1.gain.exponentialRampToValueAtTime(0.25, now + 0.01);
            g1.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
            o1.connect(g1).connect(ctx.destination);
            o1.start(now);
            o1.stop(now + 0.2);

            // Low thud
            const o2 = ctx.createOscillator();
            const g2 = ctx.createGain();
            o2.type = 'triangle';
            o2.frequency.setValueAtTime(220, now);
            o2.frequency.exponentialRampToValueAtTime(110, now + 0.1);
            g2.gain.setValueAtTime(0.0001, now);
            g2.gain.exponentialRampToValueAtTime(0.18, now + 0.01);
            g2.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
            o2.connect(g2).connect(ctx.destination);
            o2.start(now);
            o2.stop(now + 0.2);

            // Auto-close to free resources
            closeTimer = setTimeout(() => { try { ctx.close(); } catch (_) {} }, 400);
        } catch (_) {
            // ignore
        }
        return () => {
            if (closeTimer) clearTimeout(closeTimer);
            try { ctx?.close(); } catch (_) {}
        };
    }, [triggerKey]);

    // Generate 10 bubbles at varied angles/distances/sizes
    const bubbles = React.useMemo(() => {
        const count = 10;
        return Array.from({ length: count }).map((_, i) => {
            // Bias upward (angles in radians, -PI to 0 = upper half)
            const baseAngle = -Math.PI / 2; // straight up
            const spread = Math.PI * 0.9; // ~162° fan
            const angle = baseAngle + (i / (count - 1) - 0.5) * spread + (Math.random() - 0.5) * 0.3;
            const distance = 35 + Math.random() * 30;
            const size = 5 + Math.random() * 7;
            const delay = Math.random() * 60;
            const color = colors[i % colors.length];
            const duration = 600 + Math.random() * 250;
            return { angle, distance, size, delay, color, duration };
        });
    }, [triggerKey]);

    if (triggerKey === 0) return null;

    return (
        <View
            pointerEvents="none"
            style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                width: 0,
                height: 0,
                zIndex: 100,
            }}
        >
            {bubbles.map((b, i) => (
                <Bubble key={`${triggerKey}-${i}`} {...b} />
            ))}
        </View>
    );
}
