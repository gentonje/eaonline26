import * as React from 'react';
import { useState, useEffect } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, ActivityIndicator, Alert, useWindowDimensions, TextInput, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import ScreenHeader from '../components/ScreenHeader';
import WebScrollView from '../components/WebScrollView';
import { supabase } from '../lib/supabase';
import { ArrowLeft, ShoppingCart, Heart, ShoppingBag, Star, MessageSquare, ChevronRight, Share2 } from 'lucide-react-native';
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
            const { data, error } = await supabase
                .from('reviews')
                .select('*, profiles(username)')
                .eq('product_id', productId)
                .order('created_at', { ascending: false });
            
            if (error) {
                if (error.code === 'PGRST116' || error.message.includes('not found')) return;
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
                <ActivityIndicator size="large" color="#00A082" />
            </View>
        );
    }

    if (!product) return null;

    let allImages = product.product_images?.sort((a: any, b: any) => 
        (a.display_order || 0) - (b.display_order || 0)
    ) || [];

    if (allImages.length === 0 && product.storage_path) {
        allImages = [{ storage_path: product.storage_path, is_main: true, display_order: 0 }];
    }

    const mainImage = allImages.find((img: any) => img.is_main) || allImages[0];
    const additionalImages = allImages.filter((img: any) => img !== mainImage).slice(0, 4);

    const mainImageUrl = mainImage ? getImageUrl(mainImage.storage_path) : getImageUrl(null);
    const additionalImageUrls = additionalImages.map((img: any) => getImageUrl(img.storage_path));

    return (
        <View style={{ flex: 1, display: 'flex', flexDirection: 'column' }} className="bg-white">
            <ScreenHeader 
                title="Details" 
                showBackButton={true}
                rightElement={
                    <AnimatedPressable
                        onPress={handleAddToWishlist}
                        style={wishlistAnimatedStyle}
                        className="w-10 h-10 bg-white/50 rounded-full justify-center items-center"
                    >
                        <Heart color={isWishlisted ? "#00A082" : "black"} fill={isWishlisted ? "#00A082" : "none"} size={24} />
                    </AnimatedPressable>
                }
            />

            <View style={{ flex: 1, position: 'relative' }}>
                <WebScrollView contentPadding={0}>
                    <View style={{ height: GALLERY_HEIGHT }} className="bg-primary/5">
                        <Image
                            source={{ uri: selectedCarouselImage || mainImageUrl }}
                            style={{ width: '100%', height: GALLERY_HEIGHT }}
                            resizeMode="contain"
                        />
                    </View>

                    {(additionalImageUrls.length > 0 || mainImage) && (
                        <View className="bg-white border-b border-gray-100 py-4">
                            <Text className="text-xs font-black text-gray-400 px-5 pb-3 uppercase tracking-widest">
                                Product Images ({allImages.length})
                            </Text>
                            <View style={{ flexDirection: 'row', paddingHorizontal: 20, flexWrap: 'wrap', gap: 12 }}>
                                <TouchableOpacity
                                    onPress={() => setSelectedCarouselImage(null)}
                                >
                                    <View
                                        style={{
                                            width: 70, height: 70, borderRadius: 16,
                                            borderWidth: selectedCarouselImage === null ? 3 : 1,
                                            borderColor: selectedCarouselImage === null ? '#00A082' : '#e2e8f0',
                                            overflow: 'hidden',
                                            backgroundColor: '#f8fafc'
                                        }}
                                    >
                                        <Image source={{ uri: mainImageUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                                    </View>
                                    {selectedCarouselImage === null && (
                                        <View className="absolute -bottom-1 left-1/2 -ml-3 bg-accent px-2 py-0.5 rounded-full">
                                            <Text className="text-[8px] text-white font-black">MAIN</Text>
                                        </View>
                                    )}
                                </TouchableOpacity>
                                {additionalImageUrls.map((img: string, index: number) => (
                                    <TouchableOpacity key={index} onPress={() => setSelectedCarouselImage(img)}>
                                        <View
                                            style={{
                                                width: 70, height: 70, borderRadius: 16,
                                                borderWidth: selectedCarouselImage === img ? 3 : 1,
                                                borderColor: selectedCarouselImage === img ? '#00A082' : '#e2e8f0',
                                                overflow: 'hidden',
                                                backgroundColor: '#f8fafc'
                                            }}
                                        >
                                            <Image source={{ uri: img }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    )}

                    <View className="p-6">
                        <View className="flex-row justify-between items-start mb-6">
                            <View className="flex-1 mr-4">
                                <View className="bg-primary/20 self-start px-3 py-1 rounded-full mb-2">
                                    <Text className="text-[10px] text-black font-black uppercase tracking-widest">{product.category}</Text>
                                </View>
                                <Text className="text-3xl font-black text-black leading-tight">{product.title}</Text>
                            </View>
                            <Text className="text-2xl font-black text-accent">{product.currency} {product.price}</Text>
                        </View>

                        <View className="flex-row items-center p-4 bg-surface rounded-3xl mb-8 border border-secondary/10">
                            <View className="w-12 h-12 bg-primary rounded-full justify-center items-center">
                                <Text className="text-xl font-black text-black">{product.profiles?.username?.[0]?.toUpperCase()}</Text>
                            </View>
                            <View className="ml-3">
                                <Text className="font-black text-black text-lg">{product.profiles?.username}</Text>
                                <Text className="text-xs text-black/40 font-bold">Verified Seller</Text>
                            </View>
                        </View>

                        <View className="mb-8">
                            <Text className="text-xl font-black text-black mb-3">Description</Text>
                            <Text className="text-black/60 leading-7 font-bold">{product.description || 'No description available.'}</Text>
                        </View>

                        <View className="mt-4 border-t border-gray-100 pt-8">
                            <Text className="text-2xl font-black text-black mb-6">Reviews & Comments</Text>
                            <View className="bg-surface p-6 rounded-[30px] mb-8 border border-secondary/10">
                                <Text className="text-sm font-black text-black mb-4">Leave a review</Text>
                                <View className="flex-row mb-6">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <TouchableOpacity key={star} onPress={() => submitReview(star, commentText)}>
                                            <Heart size={28} color="#00A082" fill={star <= 0 ? "#00A082" : "none"} className="mr-3" />
                                        </TouchableOpacity>
                                    ))}
                                </View>
                                <View className="flex-row items-center bg-white rounded-2xl border border-secondary/20 px-4 py-2">
                                    <TextInput
                                        className="flex-1 py-3 text-black font-bold"
                                        placeholder="Write a comment..."
                                        value={commentText}
                                        onChangeText={setCommentText}
                                        multiline
                                    />
                                    <TouchableOpacity 
                                        onPress={() => submitReview(5, commentText)}
                                        className="ml-2 bg-black px-5 py-3 rounded-xl"
                                    >
                                        <Text className="text-white text-xs font-black">POST</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                            {reviews.length > 0 ? (
                                reviews.map((review) => (
                                    <View key={review.id} className="mb-8 pb-8 border-b border-gray-50">
                                        <View className="flex-row justify-between items-center mb-3">
                                            <Text className="font-black text-black text-lg">{review.profiles?.username}</Text>
                                            <View className="flex-row">
                                                {[...Array(review.rating)].map((_, i) => <Heart key={i} size={16} color="#00A082" fill="#00A082" />)}
                                            </View>
                                        </View>
                                        <Text className="text-black/60 font-bold mb-3">{review.comment}</Text>
                                        <Text className="text-[10px] text-black/30 font-black uppercase">{new Date(review.created_at).toLocaleDateString()}</Text>
                                    </View>
                                ))
                            ) : (
                                <Text className="text-black/30 font-black italic text-center mb-8">No reviews yet.</Text>
                            )}
                        </View>
                    </View>

                    <View style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: Math.max(insets.bottom, 32) + 40 }}>
                        <AnimatedPressable
                            style={[{ width: '100%' }, cartAnimatedStyle]}
                            className="bg-black py-5 rounded-2xl flex-row justify-center items-center space-x-3 shadow-xl"
                            onPress={handleAddToCart}
                        >
                            <ShoppingCart color="white" size={24} />
                            <Text className="text-white font-black text-xl uppercase tracking-widest">Add to Cart</Text>
                        </AnimatedPressable>
                    </View>
                </WebScrollView>
            </View>
        </View>
    );
}
