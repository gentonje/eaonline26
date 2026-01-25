import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    interpolate,
} from 'react-native-reanimated';

interface SkeletonProps {
    width?: number | string;
    height?: number | string;
    borderRadius?: number;
    className?: string;
}

export function Skeleton({ width = '100%', height = 20, borderRadius = 8, className = '' }: SkeletonProps) {
    const shimmer = useSharedValue(0);

    useEffect(() => {
        shimmer.value = withRepeat(
            withTiming(1, { duration: 1200 }),
            -1,
            false
        );
    }, []);

    const animatedStyle = useAnimatedStyle(() => {
        const opacity = interpolate(shimmer.value, [0, 0.5, 1], [0.3, 0.6, 0.3]);
        return { opacity };
    });

    return (
        <Animated.View
            style={[
                {
                    width: width as any,
                    height: height as any,
                    borderRadius,
                    backgroundColor: '#E5E7EB',
                },
                animatedStyle,
            ]}
            className={className}
        />
    );
}

export function ProductCardSkeleton() {
    return (
        <View className="bg-white rounded-xl overflow-hidden border border-gray-100">
            <Skeleton height={150} borderRadius={0} />
            <View className="p-3">
                <Skeleton height={16} width="80%" className="mb-2" />
                <Skeleton height={14} width="40%" />
            </View>
        </View>
    );
}

export function ProductGridSkeleton({ count = 6 }: { count?: number }) {
    return (
        <View className="flex-row flex-wrap">
            {Array.from({ length: count }).map((_, index) => (
                <View key={index} className="w-1/2 md:w-1/3 lg:w-1/4 p-1">
                    <ProductCardSkeleton />
                </View>
            ))}
        </View>
    );
}

export function ImageSkeleton({ style }: { style?: any }) {
    return <Skeleton width="100%" height="100%" borderRadius={0} className={style} />;
}
