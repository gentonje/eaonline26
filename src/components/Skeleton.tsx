import React, { useEffect } from 'react';
import { View, useWindowDimensions } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    interpolate,
    withDelay,
    Easing,
} from 'react-native-reanimated';

interface SkeletonProps {
    width?: number | string;
    height?: number | string;
    borderRadius?: number;
    className?: string;
    delay?: number;
}

export function Skeleton({ width = '100%', height = 20, borderRadius = 8, className = '', delay = 0 }: SkeletonProps) {
    const shimmer = useSharedValue(0);

    useEffect(() => {
        shimmer.value = withDelay(
            delay,
            withRepeat(
                withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
                -1,
                true
            )
        );
    }, []);

    const animatedStyle = useAnimatedStyle(() => {
        const opacity = interpolate(shimmer.value, [0, 1], [0.38, 0.68]);
        return { opacity };
    });

    return (
        <Animated.View
            style={[
                {
                    width: width as any,
                    height: height as any,
                    borderRadius,
                    backgroundColor: '#E8EAED',
                },
                animatedStyle,
            ]}
            className={className}
        />
    );
}

export function ProductCardSkeleton({ index = 0 }: { index?: number }) {
    const stagger = index * 80;
    return (
        <View style={{ backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#f3f4f6' }}>
            <Skeleton height={160} borderRadius={0} delay={stagger} />
            <View style={{ padding: 10 }}>
                <Skeleton height={13} width="85%" borderRadius={6} delay={stagger + 40} />
                <View style={{ height: 6 }} />
                <Skeleton height={13} width="50%" borderRadius={6} delay={stagger + 80} />
            </View>
        </View>
    );
}

export function ProductGridSkeleton({ count = 6, numColumns = 2 }: { count?: number; numColumns?: number }) {
    const itemWidth = `${(100 / numColumns).toFixed(4)}%` as any;
    return (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {Array.from({ length: count }).map((_, index) => (
                <View key={index} style={{ width: itemWidth, padding: 4 }}>
                    <ProductCardSkeleton index={index} />
                </View>
            ))}
        </View>
    );
}

export function CartItemSkeleton({ index = 0 }: { index?: number }) {
    const d = index * 60;
    return (
        <View style={{
            backgroundColor: '#fff',
            borderRadius: 16,
            borderWidth: 1,
            borderColor: '#f3f4f6',
            marginBottom: 12,
            padding: 12,
            flexDirection: 'row',
            alignItems: 'center',
        }}>
            <Skeleton width={72} height={72} borderRadius={12} delay={d} />
            <View style={{ flex: 1, marginLeft: 12 }}>
                <Skeleton width="75%" height={14} borderRadius={6} delay={d + 40} />
                <View style={{ height: 8 }} />
                <Skeleton width="45%" height={12} borderRadius={6} delay={d + 80} />
                <View style={{ height: 10 }} />
                <Skeleton width="60%" height={32} borderRadius={10} delay={d + 120} />
            </View>
        </View>
    );
}

export function CartSkeleton() {
    return (
        <View style={{ flex: 1, padding: 16 }}>
            {Array.from({ length: 4 }).map((_, i) => (
                <CartItemSkeleton key={i} index={i} />
            ))}
            <View style={{ marginTop: 12 }}>
                <Skeleton width="100%" height={56} borderRadius={16} delay={300} />
            </View>
        </View>
    );
}

export function WishlistSkeleton() {
    return (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', padding: 4 }}>
            {Array.from({ length: 6 }).map((_, i) => (
                <View key={i} style={{ width: '50%', padding: 4 }}>
                    <View style={{ backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#f3f4f6' }}>
                        <Skeleton height={160} borderRadius={0} delay={i * 80} />
                        <View style={{ padding: 10 }}>
                            <Skeleton height={13} width="85%" borderRadius={6} delay={i * 80 + 40} />
                            <View style={{ height: 6 }} />
                            <Skeleton height={13} width="50%" borderRadius={6} delay={i * 80 + 80} />
                            <View style={{ height: 8 }} />
                            <Skeleton height={32} borderRadius={8} delay={i * 80 + 120} />
                            <View style={{ height: 6 }} />
                            <Skeleton height={32} borderRadius={8} delay={i * 80 + 160} />
                        </View>
                    </View>
                </View>
            ))}
        </View>
    );
}

export function DashboardFeaturedSkeleton({ numColumns = 2 }: { numColumns?: number }) {
    const itemWidth = `${(100 / numColumns).toFixed(4)}%` as any;
    return (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16 }}>
            {Array.from({ length: numColumns * 2 }).map((_, i) => (
                <View key={i} style={{ width: itemWidth, padding: 4 }}>
                    <ProductCardSkeleton index={i} />
                </View>
            ))}
        </View>
    );
}

export function ProductDetailSkeleton() {
    const { width, height: windowHeight } = useWindowDimensions();
    const galleryHeight = Math.min(width, windowHeight * 0.35);

    return (
        <View style={{ flex: 1, backgroundColor: '#fff' }}>
            <Skeleton height={galleryHeight} borderRadius={0} delay={0} />

            <View style={{ flexDirection: 'row', paddingHorizontal: 20, paddingTop: 16, gap: 10 }}>
                {[0, 1, 2].map((i) => (
                    <Skeleton key={i} width={70} height={70} borderRadius={16} delay={i * 100} />
                ))}
            </View>

            <View style={{ padding: 24 }}>
                <Skeleton width={80} height={22} borderRadius={12} delay={100} />
                <View style={{ height: 12 }} />
                <Skeleton width="90%" height={28} borderRadius={8} delay={150} />
                <View style={{ height: 6 }} />
                <Skeleton width="60%" height={28} borderRadius={8} delay={200} />
                <View style={{ height: 16 }} />
                <Skeleton width="30%" height={24} borderRadius={8} delay={250} />

                <View style={{ height: 28 }} />

                <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#f8f9fa', borderRadius: 24 }}>
                    <Skeleton width={48} height={48} borderRadius={24} delay={300} />
                    <View style={{ marginLeft: 12, flex: 1 }}>
                        <Skeleton width="50%" height={16} borderRadius={6} delay={350} />
                        <View style={{ height: 6 }} />
                        <Skeleton width="30%" height={12} borderRadius={6} delay={400} />
                    </View>
                </View>

                <View style={{ height: 28 }} />

                <Skeleton width={120} height={20} borderRadius={6} delay={450} />
                <View style={{ height: 12 }} />
                <Skeleton width="100%" height={14} borderRadius={6} delay={500} />
                <View style={{ height: 8 }} />
                <Skeleton width="100%" height={14} borderRadius={6} delay={550} />
                <View style={{ height: 8 }} />
                <Skeleton width="75%" height={14} borderRadius={6} delay={600} />
            </View>

            <View style={{ paddingHorizontal: 24, paddingBottom: 32 }}>
                <Skeleton width="100%" height={56} borderRadius={16} delay={650} />
            </View>
        </View>
    );
}

export function ImageSkeleton({ style }: { style?: any }) {
    return <Skeleton width="100%" height="100%" borderRadius={0} className={style} />;
}
