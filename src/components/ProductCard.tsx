import * as React from 'react';
import { useState } from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { getProductMainImage } from '../lib/image-utils';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    FadeIn,
} from 'react-native-reanimated';
import { Skeleton } from './Skeleton';

interface ProductCardProps {
    product: any;
    showPrice?: boolean;
    actions?: React.ReactNode;
    onPress?: () => void;
}

const PLACEHOLDER_IMAGE = 'https://via.placeholder.com/300x300?text=No+Image';

export default function ProductCard({ product, showPrice = true, actions, onPress }: ProductCardProps) {
    const navigation = useNavigation<any>();
    const rawImageUrl = getProductMainImage(product);
    const imageUrl = rawImageUrl || PLACEHOLDER_IMAGE;
    const [imageLoaded, setImageLoaded] = useState(false);
    const [imageError, setImageError] = useState(false);
    
    const scale = useSharedValue(1);
    
    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const handlePress = onPress || (() => navigation.navigate('ProductDetail', { productId: product.id }));

    const handlePressIn = () => {
        scale.value = withSpring(0.96, { damping: 15, stiffness: 400 });
    };

    const handlePressOut = () => {
        scale.value = withSpring(1, { damping: 15, stiffness: 400 });
    };

    return (
        <Animated.View 
            entering={FadeIn.duration(400)}
            style={animatedStyle}
            className="bg-white rounded-xl overflow-hidden border border-gray-100"
        >
            <TouchableOpacity
                onPress={handlePress}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                activeOpacity={1}
                className="flex-1"
            >
                <View className="aspect-square bg-gray-100">
                    {!imageLoaded && !imageError && (
                        <View className="absolute inset-0">
                            <Skeleton width="100%" height="100%" borderRadius={0} />
                        </View>
                    )}
                    <Image
                        source={{ uri: imageError ? PLACEHOLDER_IMAGE : imageUrl }}
                        className="w-full h-full"
                        resizeMode="cover"
                        onLoad={() => setImageLoaded(true)}
                        onError={() => setImageError(true)}
                        style={{ opacity: imageLoaded || imageError ? 1 : 0 }}
                    />
                </View>
                <View className="p-2">
                    <Text className="font-bold text-gray-900 text-sm" numberOfLines={1}>
                        {product.title}
                    </Text>
                    {showPrice && (
                        <Text className="text-accent font-black text-sm mt-0.5">
                            {product.currency || 'SSP'} {product.price?.toLocaleString()}
                        </Text>
                    )}
                </View>
            </TouchableOpacity>
            {actions && <View className="p-2 pt-0">{actions}</View>}
        </Animated.View>
    );
}
