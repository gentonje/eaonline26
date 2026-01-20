import * as React from 'react';
import { useState, useEffect } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, ActivityIndicator, Alert, useWindowDimensions, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { ArrowLeft, ShoppingCart, Heart } from 'lucide-react-native';
import { useShopping } from '../hooks/useShopping';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { getImageUrl } from '../lib/image-utils';
import ProductCard from '../components/ProductCard';

const AnimatedPressable = Animated.createAnimatedComponent(TouchableOpacity);

export default function ProductDetailScreen() {
    const route = useRoute();
    const navigation = useNavigation<any>();
    const insets = useSafeAreaInsets();
    const { width, height: windowHeight } = useWindowDimensions();
    const GALLERY_HEIGHT = Math.min(width, windowHeight * 0.35);

    const { productId } = route.params as { productId: string };

    const [product, setProduct] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isWishlisted, setIsWishlisted] = useState(false);
    const [similarProducts, setSimilarProducts] = useState<any[]>([]);
    const [selectedCarouselImage, setSelectedCarouselImage] = useState<string | null>(null);

    const [reviews, setReviews] = useState<any[]>([]);
    const [commentText, setCommentText] = useState('');

    const { addToCart, toggleWishlist } = useShopping();

    const cartScale = useSharedValue(1);
    const wishlistScale = useSharedValue(1);

    const cartAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: cartScale.value }]
    }));

    const wishlistAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: wishlistScale.value }]
    }));

    useEffect(() => {
        fetchProductDetails();
        fetchReviews();
    }, [productId]);

    async function fetchReviews() {
        try {
            // Check if reviews table exists first by a simple query
            const { data, error } = await supabase
                .from('reviews')
                .select('*, profiles(username)')
                .eq('product_id', productId)
                .order('created_at', { ascending: false });
            
            if (error) {
                if (error.code === 'PGRST116' || error.message.includes('not found')) {
                    console.log('Reviews table might not exist yet');
                    return;
                }
                throw error;
            }
            setReviews(data || []);
        } catch (error) {
            console.error('Error fetching reviews:', error);
        }
    }

    async function submitReview(rating: number, text: string) {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                Alert.alert('Login Required', 'Please login to leave a review');
                return;
            }

            const { error } = await supabase
                .from('reviews')
                .insert([{
                    user_id: user.id,
                    product_id: productId,
                    rating,
                    comment: text
                }]);

            if (error) throw error;
            fetchReviews();
            setCommentText('');
        } catch (error) {
            console.error('Error submitting review:', error);
            Alert.alert('Error', 'Failed to submit review');
        }
    }

    async function fetchProductDetails() {
        try {
            const { data: { user } } = await supabase.auth.getUser();

            const { data, error } = await supabase
                .from('products')
                .select('*, product_images(*), profiles(username)')
                .eq('id', productId)
                .single();

            if (error) throw error;
            setProduct(data);

            if (user) {
                checkWishlistStatus(user.id);
            }
            fetchSimilarProducts(data.category);
        } catch (error) {
            console.error('Error fetching product details:', error);
            Alert.alert('Error', 'Could not load product details');
            navigation.goBack();
        } finally {
            setLoading(false);
        }
    }

    async function checkWishlistStatus(userId: string) {
        try {
            const { data } = await supabase
                .from('wishlist')
                .select('id')
                .eq('user_id', userId)
                .eq('product_id', productId)
                .maybeSingle();

            setIsWishlisted(!!data);
        } catch (error) {
            console.error('Error checking wishlist status:', error);
        }
    }

    async function fetchSimilarProducts(category: string) {
        try {
            let query = supabase
                .from('products')
                .select('*, product_images(*)')
                .eq('product_status', 'published')
                .neq('id', productId)
                .limit(10);

            if (category) {
                query = query.eq('category', category);
            }

            const { data } = await query;
            setSimilarProducts(data || []);
        } catch (error) {
            console.error('Error fetching similar products:', error);
        }
    }

    const handleAddToCart = async () => {
        cartScale.value = withSpring(0.9, { damping: 10, stiffness: 100 }, () => {
            cartScale.value = withSpring(1);
        });
        await addToCart(productId);
    };

    const handleAddToWishlist = async () => {
        wishlistScale.value = withSpring(0.8, { damping: 5, stiffness: 200 }, () => {
            wishlistScale.value = withSpring(1.2, {}, () => {
                wishlistScale.value = withSpring(1);
            });
        });
        const result = await toggleWishlist(productId);
        if (result.success) {
            setIsWishlisted(result.action === 'added');
        }
    };

    if (loading) {
        return (
            <View className="flex-1 justify-center items-center bg-white">
                <ActivityIndicator size="large" color="#2563eb" />
            </View>
        );
    }

    if (!product) return null;

    // Get all product images sorted by display_order
    let allImages = product.product_images?.sort((a: any, b: any) => 
        (a.display_order || 0) - (b.display_order || 0)
    ) || [];

    // Fallback to storage_path if no product_images
    if (allImages.length === 0 && product.storage_path) {
        allImages = [{ storage_path: product.storage_path, is_main: true, display_order: 0 }];
    }

    // Separate main image and additional images
    const mainImage = allImages.find((img: any) => img.is_main) || allImages[0];
    const additionalImages = allImages.filter((img: any) => img !== mainImage);

    const mainImageUrl = mainImage ? getImageUrl(mainImage.storage_path) : getImageUrl(null);
    const additionalImageUrls = additionalImages.map((img: any) => getImageUrl(img.storage_path));

    return (
        <View style={{ flex: 1, backgroundColor: 'white' }}>
            {/* Header */}
            <View
                style={{ paddingTop: Math.max(insets.top, 20) }}
                className="absolute top-0 left-0 right-0 z-10 flex-row justify-between items-center p-4"
            >
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    className="w-10 h-10 bg-white/80 rounded-full justify-center items-center shadow-sm"
                >
                    <ArrowLeft color="#000" size={24} />
                </TouchableOpacity>
                <AnimatedPressable
                    onPress={handleAddToWishlist}
                    style={wishlistAnimatedStyle}
                    className="w-10 h-10 bg-white/80 rounded-full justify-center items-center shadow-sm"
                >
                    <Heart color={isWishlisted ? "#FFD700" : "#000"} fill={isWishlisted ? "#FFD700" : "none"} size={24} />
                </AnimatedPressable>
            </View>

            <View style={{ flex: 1 }}>
                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{
                        paddingBottom: insets.bottom + 100
                    }}
                    showsVerticalScrollIndicator={true}
                    persistentScrollbar={true}
                    keyboardShouldPersistTaps="handled"
                    scrollEnabled={true}
                >
                    {/* Main Image */}
                    <View style={{ height: GALLERY_HEIGHT }} className="bg-gray-50">
                        <Image
                            source={{ uri: selectedCarouselImage || mainImageUrl }}
                            style={{ width: '100%', height: GALLERY_HEIGHT }}
                            resizeMode="contain"
                        />
                    </View>

                    {/* Additional Images Carousel */}
                    {additionalImageUrls.length > 0 && (
                        <View className="bg-white border-b border-gray-100 pb-4">
                            <Text className="text-sm font-semibold text-gray-700 px-5 py-3 uppercase tracking-wide">
                                More Photos ({additionalImageUrls.length})
                            </Text>
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 8 }}
                                className="flex-row"
                            >
                                {/* Show main image as first option in carousel */}
                                <TouchableOpacity
                                    onPress={() => setSelectedCarouselImage(null)}
                                    className="mr-3"
                                    activeOpacity={0.8}
                                >
                                    <View
                                        style={{
                                            width: 100,
                                            height: 100,
                                            borderRadius: 12,
                                            borderWidth: selectedCarouselImage === null ? 3 : 1,
                                            borderColor: selectedCarouselImage === null ? '#f97316' : '#e5e7eb',
                                            overflow: 'hidden'
                                        }}
                                    >
                                        <Image
                                            source={{ uri: mainImageUrl }}
                                            style={{ width: '100%', height: '100%' }}
                                            resizeMode="cover"
                                        />
                                        {selectedCarouselImage === null && (
                                            <View style={{ position: 'absolute', top: 4, left: 4, backgroundColor: '#f97316', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 2 }}>
                                                <Text className="text-white font-bold text-xs">Main</Text>
                                            </View>
                                        )}
                                    </View>
                                </TouchableOpacity>
                                {additionalImageUrls.map((img: string, index: number) => (
                                    <TouchableOpacity
                                        key={`additional-image-${index}`}
                                        onPress={() => setSelectedCarouselImage(img)}
                                        className="mr-3"
                                        activeOpacity={0.8}
                                    >
                                        <View
                                            style={{
                                                width: 100,
                                                height: 100,
                                                borderRadius: 12,
                                                borderWidth: selectedCarouselImage === img ? 3 : 1,
                                                borderColor: selectedCarouselImage === img ? '#f97316' : '#e5e7eb',
                                                overflow: 'hidden'
                                            }}
                                        >
                                            <Image
                                                source={{ uri: img }}
                                                style={{ width: '100%', height: '100%' }}
                                                resizeMode="cover"
                                            />
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    )}

                    {/* Product Info */}
                    <View className="p-5">
                        <View className="flex-row justify-between items-start mb-4">
                            <View className="flex-1 mr-4">
                                <Text className="text-sm text-blue-600 font-semibold mb-1 uppercase tracking-wider">
                                    {product.category || 'General'}
                                </Text>
                                <Text className="text-2xl font-bold text-gray-900 leading-tight">
                                    {product.title}
                                </Text>
                            </View>
                            <Text className="text-xl font-bold text-blue-600">
                                {product.currency} {product.price}
                            </Text>
                        </View>

                        {/* Seller Info */}
                        <View className="flex-row items-center p-3 border-y border-gray-100 mb-4 space-x-3">
                            <View className="w-10 h-10 bg-gray-200 rounded-full justify-center items-center">
                                <Text className="text-lg font-bold text-gray-500">
                                    {product.profiles?.username?.[0]?.toUpperCase() || 'S'}
                                </Text>
                            </View>
                            <View>
                                <Text className="font-semibold text-gray-900">
                                    {product.profiles?.username || 'Seller'}
                                </Text>
                                <Text className="text-xs text-gray-500">Verified Seller</Text>
                            </View>
                        </View>

                        {/* Description */}
                        <View className="mb-6">
                            <Text className="text-lg font-semibold text-gray-900 mb-2">Description</Text>
                            <Text className="text-gray-600 leading-6">
                                {product.description || 'No description available.'}
                            </Text>
                        </View>

                        {/* Additional Details */}
                        <View className="flex-row flex-wrap gap-2 mt-2">
                            <View className="bg-gray-100 px-3 py-1 rounded-full">
                                <Text className="text-xs text-gray-600">Stock: {product.in_stock ? 'In Stock' : 'Out of Stock'}</Text>
                            </View>
                            <View className="bg-gray-100 px-3 py-1 rounded-full">
                                <Text className="text-xs text-gray-600">Views: {product.views || 0}</Text>
                            </View>
                        </View>

                        {/* Reviews Section */}
                    <View className="mt-8 border-t border-gray-100 pt-8">
                        <Text className="text-xl font-bold text-gray-900 mb-4 px-1">Reviews & Comments</Text>
                        
                        {/* Quick Review Input */}
                        <View className="bg-gray-50 p-4 rounded-xl mb-6">
                            <Text className="text-sm font-semibold text-gray-700 mb-2">Leave a review</Text>
                            <View className="flex-row mb-3">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <TouchableOpacity key={star} onPress={() => submitReview(star, commentText)}>
                                        <Heart size={24} color="#2563eb" fill={star <= 0 ? "#2563eb" : "none"} className="mr-2" />
                                    </TouchableOpacity>
                                ))}
                            </View>
                            <View className="flex-row items-center bg-white rounded-lg border border-gray-200 px-3 py-1">
                                <TextInput
                                    className="flex-1 py-2 text-gray-800"
                                    placeholder="Write a comment..."
                                    value={commentText}
                                    onChangeText={setCommentText}
                                    multiline
                                />
                                <TouchableOpacity 
                                    onPress={() => submitReview(5, commentText)}
                                    className="ml-2 bg-blue-600 p-2 rounded-full"
                                >
                                    <Text className="text-white text-xs font-bold px-2">Post</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {reviews.length > 0 ? (
                            reviews.map((review) => (
                                <View key={review.id} className="mb-6 pb-6 border-b border-gray-50">
                                    <View className="flex-row justify-between items-center mb-2">
                                        <Text className="font-bold text-gray-900">{review.profiles?.username || 'User'}</Text>
                                        <View className="flex-row">
                                            {[...Array(review.rating)].map((_, i) => (
                                                <Heart key={i} size={14} color="#2563eb" fill="#2563eb" />
                                            ))}
                                        </View>
                                    </View>
                                    <Text className="text-gray-600 mb-2">{review.comment}</Text>
                                    <Text className="text-xs text-gray-400">
                                        {new Date(review.created_at).toLocaleDateString()}
                                    </Text>
                                </View>
                            ))
                        ) : (
                            <Text className="text-gray-500 italic px-1">No reviews yet. Be the first to review!</Text>
                        )}
                    </View>

                    {/* Similar Products Section */}
                        {similarProducts.length > 0 && (
                            <View className="mt-8 border-t border-gray-100 pt-8">
                                <View className="flex-row justify-between items-center mb-4 px-1">
                                    <Text className="text-xl font-bold text-gray-900">Similar Products</Text>
                                    <TouchableOpacity onPress={() => navigation.navigate('App', { screen: 'BrowseProducts', params: { category: product.category } })}>
                                        <Text className="text-blue-600 font-semibold">See All</Text>
                                    </TouchableOpacity>
                                </View>
                                <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    contentContainerStyle={{ paddingRight: 20 }}
                                    className="flex-row"
                                >
                                    {similarProducts.map((p) => (
                                        <View key={p.id} style={{ width: 200 }} className="mr-4">
                                            <ProductCard
                                                product={p}
                                                onPress={() => {
                                                    navigation.push('ProductDetail', { productId: p.id });
                                                }}
                                            />
                                        </View>
                                    ))}
                                </ScrollView>
                            </View>
                        )}
                    </View>
                </ScrollView>
            </View>

            {/* Bottom Action Bar */}
            <View
                style={{ paddingBottom: Math.max(insets.bottom, 16) }}
                className="p-4 bg-white border-t border-gray-100"
            >
                <AnimatedPressable
                    style={[{ width: '100%' }, cartAnimatedStyle]}
                    className="bg-blue-600 py-4 rounded-xl flex-row justify-center items-center space-x-2 shadow-lg shadow-blue-200"
                    onPress={handleAddToCart}
                >
                    <ShoppingCart color="white" size={20} />
                    <Text className="text-white font-bold text-lg">Add to Cart</Text>
                </AnimatedPressable>
            </View>
        </View>
    );
}
