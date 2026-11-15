import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, Pressable, Alert, useWindowDimensions, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import ScreenHeader from '../components/ScreenHeader';
import WebScrollView from '../components/WebScrollView';
import { supabase } from '../lib/supabase';
import { ShoppingCart, Heart, Star, CornerDownRight } from 'lucide-react-native';
import { useShopping } from '../hooks/useShopping';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { getImageUrl } from '../lib/image-utils';
import ProductCard from '../components/ProductCard';
import AutoCompareButton from '../components/AutoCompareButton';
import { ProductDetailSkeleton } from '../components/Skeleton';
import BubbleBurst from '../components/BubbleBurst';

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

    const [seller, setSeller] = useState<any>(null);
    const [reviews, setReviews] = useState<any[]>([]);
    const [commentText, setCommentText] = useState('');
    const [selectedRating, setSelectedRating] = useState(0);
    const [replyTo, setReplyTo] = useState<{ id: string; username: string } | null>(null);
    const [replyText, setReplyText] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [burstKey, setBurstKey] = useState(0);

    const { addToCart, toggleWishlist } = useShopping();

    const cartScale = useSharedValue(1);
    const wishlistScale = useSharedValue(1);

    const cartAnimatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: cartScale.value }] }));
    const wishlistAnimatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: wishlistScale.value }] }));

    useEffect(() => {
        fetchProductDetails();
        fetchReviews();
    }, [productId]);

    // Refresh wishlist status whenever screen regains focus
    useFocusEffect(
        useCallback(() => {
            (async () => {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    setCurrentUserId(user.id);
                    checkWishlistStatus(user.id);
                }
            })();
        }, [productId])
    );

    async function fetchReviews() {
        try {
            const { data, error } = await supabase
                .from('reviews')
                .select('id, rating, content, created_at, user_id, parent_id')
                .eq('product_id', productId)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('fetchReviews error:', error.message);
                return;
            }
            if (!data || data.length === 0) {
                setReviews([]);
                return;
            }

            const userIds = [...new Set(data.map((r: any) => r.user_id).filter(Boolean))];
            let profileMap: Record<string, string> = {};
            if (userIds.length > 0) {
                const { data: profiles } = await supabase
                    .from('profiles')
                    .select('id, username, full_name')
                    .in('id', userIds);
                (profiles || []).forEach((p: any) => {
                    profileMap[p.id] = p.username || p.full_name || 'User';
                });
            }
            setReviews(data.map((r: any) => ({
                ...r,
                username: profileMap[r.user_id] || 'Anonymous',
            })));
        } catch (e) {
            console.error('fetchReviews threw:', e);
        }
    }

    async function submitReview() {
        if (submitting) return;
        if (selectedRating === 0) {
            Alert.alert('Rating Required', 'Please tap the stars to choose a rating.');
            return;
        }
        if (!commentText.trim()) {
            Alert.alert('Comment Required', 'Please write a short comment.');
            return;
        }
        setSubmitting(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                Alert.alert('Login Required', 'Please login to leave a review');
                return;
            }
            const { error } = await supabase
                .from('reviews')
                .insert([{ user_id: user.id, product_id: productId, rating: selectedRating, content: commentText.trim() }]);
            if (error) throw error;
            setCommentText('');
            setSelectedRating(0);
            fetchReviews();
        } catch (error: any) {
            console.error('submitReview error:', error);
            Alert.alert('Error', error?.message || 'Failed to submit review');
        } finally {
            setSubmitting(false);
        }
    }

    async function submitReply(parentId: string) {
        if (!replyText.trim()) return;
        setSubmitting(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                Alert.alert('Login Required', 'Please login to reply');
                return;
            }
            const { error } = await supabase
                .from('reviews')
                .insert([{ user_id: user.id, product_id: productId, rating: 0, content: replyText.trim(), parent_id: parentId }]);
            if (error) throw error;
            setReplyText('');
            setReplyTo(null);
            fetchReviews();
        } catch (error: any) {
            console.error('submitReply error:', error);
            Alert.alert('Error', error?.message || 'Failed to submit reply');
        } finally {
            setSubmitting(false);
        }
    }

    async function fetchProductDetails() {
        try {
            const { data, error } = await supabase
                .from('products')
                .select('*, product_images(*), countries(id, name, currency)')
                .eq('id', productId)
                .maybeSingle();

            if (error) throw error;
            if (!data) {
                Alert.alert('Not Found', 'This product could not be loaded.');
                navigation.goBack();
                return;
            }
            setProduct(data);

            if (data.user_id) {
                supabase.from('profiles').select('id, username, full_name').eq('id', data.user_id).maybeSingle()
                    .then(({ data: profile }) => { if (profile) setSeller(profile); });
            }
            fetchSimilarProducts(data);
        } catch (error: any) {
            console.error('Error fetching product details:', error);
            if (error?.code === 'PGRST116') {
                Alert.alert('Not Found', 'This product could not be loaded.');
                navigation.goBack();
            }
        } finally {
            setLoading(false);
        }
    }

    async function checkWishlistStatus(userId: string) {
        try {
            const { data } = await supabase
                .from('wishlist').select('id')
                .eq('user_id', userId).eq('product_id', productId).maybeSingle();
            setIsWishlisted(!!data);
        } catch (error) { console.error('Error checking wishlist status:', error); }
    }

    async function fetchSimilarProducts(currentProduct: any) {
        try {
            let query = supabase
                .from('products')
                .select('*, product_images(*), countries(id, name, currency)')
                .eq('product_status', 'published')
                .neq('id', productId)
                .order('created_at', { ascending: false })
                .limit(30);
            if (currentProduct?.category) query = query.eq('category', currentProduct.category);
            const { data, error } = await query;
            if (error) throw error;

            const currentPrice = Number(currentProduct?.price || 0);
            const ranked = (data || []).map((candidate: any) => {
                let score = 0;
                if (currentProduct?.category && candidate.category === currentProduct.category) score += 5;
                if (currentProduct?.country_id && candidate.country_id === currentProduct.country_id) score += 2;
                if (currentProduct?.county && candidate.county && candidate.county.toLowerCase() === currentProduct.county.toLowerCase()) score += 2;
                if (currentPrice > 0 && Number(candidate.price) > 0) {
                    const priceDistance = Math.abs(Number(candidate.price) - currentPrice) / currentPrice;
                    score += Math.max(0, 3 * (1 - Math.min(priceDistance, 1)));
                }
                return { ...candidate, _similarityScore: score };
            }).sort((a: any, b: any) =>
                b._similarityScore - a._similarityScore ||
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );
            setSimilarProducts(ranked.slice(0, 10));
        } catch (error) { console.error('Error fetching similar products:', error); }
    }

    const handleAddToCart = async () => {
        cartScale.value = withSpring(0.9, { damping: 10, stiffness: 100 }, () => { cartScale.value = withSpring(1); });
        await addToCart(productId);
    };

    const handleToggleWishlist = async () => {
        wishlistScale.value = withSpring(0.8, { damping: 5, stiffness: 200 }, () => {
            wishlistScale.value = withSpring(1.2, {}, () => { wishlistScale.value = withSpring(1); });
        });
        // Optimistic update for instant feedback
        const prev = isWishlisted;
        setIsWishlisted(!prev);
        // Trigger bubble burst + pop sound only when ADDING (not removing)
        if (!prev) setBurstKey((k) => k + 1);
        const result = await toggleWishlist(productId, { silent: true });
        if (!result.success) {
            setIsWishlisted(prev); // rollback on failure
        } else {
            setIsWishlisted(result.action === 'added');
        }
    };

    if (loading) {
        return (
            <View style={{ flex: 1 }} className="bg-white">
                <ScreenHeader title="Details" showBackButton={true} />
                <WebScrollView contentPadding={0}><ProductDetailSkeleton /></WebScrollView>
            </View>
        );
    }
    if (!product) return null;

    let allImages = product.product_images?.sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0)) || [];
    if (allImages.length === 0 && product.storage_path) {
        allImages = [{ storage_path: product.storage_path, is_main: true, display_order: 0 }];
    }
    const mainImage = allImages.find((img: any) => img.is_main) || allImages[0];
    const additionalImages = allImages.filter((img: any) => img !== mainImage).slice(0, 4);
    const mainImageUrl = mainImage ? getImageUrl(mainImage.storage_path) : getImageUrl(null);
    const additionalImageUrls = additionalImages.map((img: any) => getImageUrl(img.storage_path));

    const currency = product.countries?.currency || 'KES';
    const topReviews = reviews.filter((r: any) => !r.parent_id);
    const repliesByParent = reviews.reduce((acc: Record<string, any[]>, r: any) => {
        if (r.parent_id) {
            (acc[r.parent_id] ||= []).push(r);
        }
        return acc;
    }, {});
    // Show replies oldest-first under each parent for natural conversation flow
    Object.values(repliesByParent).forEach((arr: any) =>
        arr.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    );

    return (
        <View style={{ flex: 1, display: 'flex', flexDirection: 'column' }} className="bg-white">
            <ScreenHeader
                title="Details"
                showBackButton={true}
                rightElement={
                    <View style={{ width: 40, height: 40, justifyContent: 'center', alignItems: 'center' }}>
                        <Animated.View style={wishlistAnimatedStyle}>
                            <Pressable
                                onPress={handleToggleWishlist}
                                style={({ pressed }) => ({
                                    width: 40,
                                    height: 40,
                                    backgroundColor: 'rgba(255,255,255,0.5)',
                                    borderRadius: 9999,
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    opacity: pressed ? 0.7 : 1,
                                })}
                            >
                                <Heart color={isWishlisted ? "#00A082" : "black"} fill={isWishlisted ? "#00A082" : "none"} size={24} />
                            </Pressable>
                        </Animated.View>
                        <BubbleBurst triggerKey={burstKey} />
                    </View>
                }
            />

            <View style={{ flex: 1, position: 'relative' }}>
                <WebScrollView contentPadding={0}>
                    {/* Hero image — "contain" so the whole product is visible without cropping */}
                    <View style={{ height: GALLERY_HEIGHT + 16, paddingTop: 16 }} className="bg-gray-50">
                        <Image
                            source={{ uri: selectedCarouselImage || mainImageUrl }}
                            style={{ width: '100%', height: GALLERY_HEIGHT }}
                            resizeMode="contain"
                        />
                    </View>

                    {/* Thumbnails */}
                    {(additionalImageUrls.length > 0 || mainImage) && (
                        <View className="bg-white border-b border-gray-100 py-4">
                            <Text className="text-xs font-black text-gray-400 px-5 pb-3 uppercase tracking-widest">
                                Product Images ({allImages.length})
                            </Text>
                            <View style={{ flexDirection: 'row', paddingHorizontal: 20, flexWrap: 'wrap', gap: 12 }}>
                                <TouchableOpacity onPress={() => setSelectedCarouselImage(null)}>
                                    <View style={{
                                        width: 70, height: 70, borderRadius: 16,
                                        borderWidth: selectedCarouselImage === null ? 3 : 1,
                                        borderColor: selectedCarouselImage === null ? '#00A082' : '#e2e8f0',
                                        overflow: 'hidden', backgroundColor: '#f8fafc'
                                    }}>
                                        <Image source={{ uri: mainImageUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                                    </View>
                                </TouchableOpacity>
                                {additionalImageUrls.map((img: string, index: number) => (
                                    <TouchableOpacity key={index} onPress={() => setSelectedCarouselImage(img)}>
                                        <View style={{
                                            width: 70, height: 70, borderRadius: 16,
                                            borderWidth: selectedCarouselImage === img ? 3 : 1,
                                            borderColor: selectedCarouselImage === img ? '#00A082' : '#e2e8f0',
                                            overflow: 'hidden', backgroundColor: '#f8fafc'
                                        }}>
                                            <Image source={{ uri: img }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    )}

                    {/* === DETAILS CARD === */}
                    <View className="p-6">
                        {/* Category chip */}
                        <View className="bg-primary/20 self-start px-3 py-1 rounded-full mb-3">
                            <Text className="text-[10px] text-black font-black uppercase tracking-widest">{product.category}</Text>
                        </View>

                        {/* TITLE — full width, no truncation */}
                        <Text className="text-3xl font-black text-black leading-tight mb-4" style={{ width: '100%' }}>
                            {product.title}
                        </Text>

                        {/* PRICE — own line, prominent */}
                        <View className="flex-row items-baseline mb-6">
                            <Text className="text-3xl font-black text-accent">
                                {currency} {Number(product.price).toLocaleString()}
                            </Text>
                            {product.available_quantity != null && (
                                <Text className="text-xs font-black text-black/40 ml-3 uppercase tracking-wider">
                                    {product.available_quantity} in stock
                                </Text>
                            )}
                        </View>

                        {/* Compare the current listing with alternatives */}
                        <View className="mb-6">
                            <AutoCompareButton product={product} />
                        </View>

                        {/* Seller card */}
                        <TouchableOpacity
                            onPress={() => product?.user_id && navigation.navigate('Store', { storeId: product.user_id })}
                            activeOpacity={0.7}
                            className="flex-row items-center p-4 bg-surface rounded-3xl mb-8 border border-secondary/10"
                        >
                            <View className="w-12 h-12 bg-primary rounded-full justify-center items-center">
                                <Text className="text-xl font-black text-black">
                                    {(seller?.username || seller?.full_name || 'S')[0].toUpperCase()}
                                </Text>
                            </View>
                            <View className="ml-3" style={{ flex: 1 }}>
                                <Text className="font-black text-black text-lg">{seller?.username || seller?.full_name || 'Seller'}</Text>
                                <Text className="text-xs text-accent font-black uppercase tracking-wider">Visit Store →</Text>
                            </View>
                        </TouchableOpacity>

                        {/* Description */}
                        <View className="mb-2">
                            <Text className="text-xl font-black text-black mb-3">Description</Text>
                            <Text className="text-black/60 leading-7 font-bold">{product.description || 'No description available.'}</Text>
                        </View>
                    </View>

                    {/* === SIMILAR PRODUCTS CAROUSEL === */}
                    {similarProducts.length > 0 && (
                        <View className="bg-gray-50 py-6 mb-2">
                            <View className="flex-row items-center justify-between px-6 mb-4">
                                <Text className="text-xl font-black text-black">Similar Products</Text>
                                <Text className="text-xs font-black text-black/40 uppercase tracking-wider">
                                    {similarProducts.length} items
                                </Text>
                            </View>
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8 }}
                            >
                                {similarProducts.map((p: any) => (
                                    <View key={p.id} style={{ width: 180, marginHorizontal: 8 }}>
                                        <ProductCard
                                            product={p}
                                            onPress={() => navigation.push('ProductDetail', { productId: p.id })}
                                            actions={<AutoCompareButton product={p} compact />}
                                        />
                                    </View>
                                ))}
                            </ScrollView>
                        </View>
                    )}

                    {/* === REVIEWS === */}
                    <View className="px-6 pt-2">
                        <View className="border-t border-gray-100 pt-8">
                            <Text className="text-2xl font-black text-black mb-6">Reviews & Comments</Text>

                            {/* Composer */}
                            <View className="bg-surface p-5 rounded-[28px] mb-8 border border-secondary/10">
                                <Text className="text-sm font-black text-black mb-3">Leave a review</Text>
                                <View className="flex-row mb-4">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <TouchableOpacity
                                            key={star}
                                            onPress={() => setSelectedRating(star)}
                                            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                                            style={{ marginRight: 8 }}
                                        >
                                            <Star
                                                size={30}
                                                color="#FDB913"
                                                fill={star <= selectedRating ? "#FDB913" : "none"}
                                            />
                                        </TouchableOpacity>
                                    ))}
                                    {selectedRating > 0 && (
                                        <Text className="text-xs font-black text-black/50 ml-2 self-center">
                                            {selectedRating} / 5
                                        </Text>
                                    )}
                                </View>
                                <View className="flex-row items-end bg-white rounded-2xl border border-secondary/20 px-4 py-2">
                                    <TextInput
                                        className="flex-1 py-3 text-black font-bold"
                                        placeholder="Write a comment..."
                                        placeholderTextColor="#9ca3af"
                                        value={commentText}
                                        onChangeText={setCommentText}
                                        multiline
                                    />
                                    <TouchableOpacity
                                        onPress={submitReview}
                                        disabled={submitting}
                                        className={`ml-2 px-5 py-3 rounded-xl ${submitting ? 'bg-black/40' : 'bg-black'}`}
                                    >
                                        <Text className="text-white text-xs font-black">{submitting ? '...' : 'POST'}</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Comment list */}
                            {topReviews.length > 0 ? (
                                topReviews.map((review: any) => {
                                    const replies = repliesByParent[review.id] || [];
                                    return (
                                        <View key={review.id} className="mb-8 pb-6 border-b border-gray-50">
                                            <View className="flex-row justify-between items-center mb-2">
                                                <Text className="font-black text-black text-base">{review.username}</Text>
                                                {review.rating > 0 && (
                                                    <View className="flex-row">
                                                        {[...Array(review.rating)].map((_, i) =>
                                                            <Star key={i} size={14} color="#FDB913" fill="#FDB913" />
                                                        )}
                                                    </View>
                                                )}
                                            </View>
                                            <Text className="text-black/70 font-bold mb-2">{review.content}</Text>
                                            <View className="flex-row items-center justify-between">
                                                <Text className="text-[10px] text-black/30 font-black uppercase">
                                                    {new Date(review.created_at).toLocaleDateString()}
                                                </Text>
                                                {currentUserId && (
                                                    <TouchableOpacity
                                                        onPress={() => {
                                                            setReplyTo(replyTo?.id === review.id ? null : { id: review.id, username: review.username });
                                                            setReplyText('');
                                                        }}
                                                    >
                                                        <Text className="text-[11px] text-accent font-black uppercase tracking-wider">
                                                            {replyTo?.id === review.id ? 'Cancel' : 'Reply'}
                                                        </Text>
                                                    </TouchableOpacity>
                                                )}
                                            </View>

                                            {/* Reply composer */}
                                            {replyTo?.id === review.id && (
                                                <View className="flex-row items-end bg-white rounded-2xl border border-secondary/20 px-3 py-2 mt-3 ml-6">
                                                    <TextInput
                                                        className="flex-1 py-2 text-black font-bold text-sm"
                                                        placeholder={`Reply to ${review.username}...`}
                                                        placeholderTextColor="#9ca3af"
                                                        value={replyText}
                                                        onChangeText={setReplyText}
                                                        multiline
                                                        autoFocus
                                                    />
                                                    <TouchableOpacity
                                                        onPress={() => submitReply(review.id)}
                                                        disabled={submitting || !replyText.trim()}
                                                        className={`ml-2 px-4 py-2 rounded-lg ${submitting || !replyText.trim() ? 'bg-black/40' : 'bg-accent'}`}
                                                    >
                                                        <Text className="text-white text-[11px] font-black">SEND</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            )}

                                            {/* Replies */}
                                            {replies.length > 0 && (
                                                <View className="mt-4 ml-2 pl-4 border-l-2 border-accent/30">
                                                    {replies.map((rep: any) => (
                                                        <View key={rep.id} className="mb-4">
                                                            <View className="flex-row items-center mb-1">
                                                                <CornerDownRight size={12} color="#00A082" />
                                                                <Text className="font-black text-black text-sm ml-2">{rep.username}</Text>
                                                            </View>
                                                            <Text className="text-black/70 font-bold text-sm ml-5">{rep.content}</Text>
                                                            <Text className="text-[9px] text-black/30 font-black uppercase ml-5 mt-1">
                                                                {new Date(rep.created_at).toLocaleDateString()}
                                                            </Text>
                                                        </View>
                                                    ))}
                                                </View>
                                            )}
                                        </View>
                                    );
                                })
                            ) : (
                                <Text className="text-black/30 font-black italic text-center mb-8">No reviews yet. Be the first!</Text>
                            )}
                        </View>
                    </View>

                    {/* Add to cart */}
                    <View style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: Math.max(insets.bottom, 32) + 40 }}>
                        {currentUserId && product?.user_id === currentUserId ? (
                            <View style={{ width: '100%' }}>
                                <Pressable
                                    onPress={() => navigation.navigate('EditProduct', { productId: product.id })}
                                    style={({ pressed }) => ({
                                        backgroundColor: '#00A082',
                                        paddingVertical: 20,
                                        borderRadius: 16,
                                        flexDirection: 'row',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        opacity: pressed ? 0.85 : 1,
                                    })}
                                >
                                    <Text style={{ color: 'white', fontWeight: '900', fontSize: 18, textTransform: 'uppercase', letterSpacing: 2 }}>
                                        Edit Your Listing
                                    </Text>
                                </Pressable>
                                <Text style={{ color: '#64748b', fontSize: 12, fontWeight: '700', textAlign: 'center', marginTop: 10 }}>
                                    You own this product — you can't add it to your own cart.
                                </Text>
                            </View>
                        ) : (
                            <Animated.View style={[{ width: '100%' }, cartAnimatedStyle]}>
                                <Pressable
                                    onPress={handleAddToCart}
                                    style={({ pressed }) => ({
                                        backgroundColor: '#000',
                                        paddingVertical: 20,
                                        borderRadius: 16,
                                        flexDirection: 'row',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        opacity: pressed ? 0.85 : 1,
                                    })}
                                >
                                    <ShoppingCart color="white" size={24} />
                                    <Text style={{ color: 'white', fontWeight: '900', fontSize: 18, textTransform: 'uppercase', letterSpacing: 2, marginLeft: 12 }}>
                                        Add to Cart
                                    </Text>
                                </Pressable>
                            </Animated.View>
                        )}
                    </View>
                </WebScrollView>
            </View>
        </View>
    );
}
