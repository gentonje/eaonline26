import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Pressable, ActivityIndicator } from 'react-native';
import { supabase } from '../lib/supabase';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Heart, ShoppingBag, ChevronLeft } from 'lucide-react-native';

import { useShopping } from '../hooks/useShopping';
import { useFeedback } from '../contexts/FeedbackContext';

import ProductGrid from '../components/ProductGrid';
import ProductCard from '../components/ProductCard';
import ScreenHeader from '../components/ScreenHeader';
import { WishlistSkeleton } from '../components/Skeleton';

export default function WishlistScreen() {
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const navigation = useNavigation<any>();
    const { addToCart, removeFromWishlist } = useShopping();
    const { showToast } = useFeedback();

    useFocusEffect(
        useCallback(() => {
            fetchWishlist();
        }, [])
    );


    const fetchWishlist = async () => {
        try {
            if (items.length === 0) setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) return;
            setCurrentUserId(user.id);

            const { data, error } = await supabase
                .from('wishlist')
                .select(`
                    id,
                    products (
                        id,
                        title,
                        price,
                        storage_path,
                        description,
                        category,
                        user_id,
                        countries (
                            id,
                            name,
                            currency
                        )
                    )
                `)
                .eq('user_id', user.id);

            if (error) throw error;
            setItems(data || []);
        } catch (error) {
            console.error('Error fetching wishlist:', error);
            showToast('Failed to load wishlist', 'error');
        } finally {
            setLoading(false);
        }
    };


    const handleRemoveFromWishlist = async (itemId: string) => {
        const success = await removeFromWishlist(itemId);
        if (success) {
            setItems(prev => prev.filter(i => i.id !== itemId));
        }
    };

    const handleAddToCart = async (productId: string) => {
        await addToCart(productId);
    };


    return (
        <View style={{ flex: 1 }} className="bg-white">
            <ScreenHeader 
                title="Wishlist" 
                subtitle="Items saved for later" 
                showBackButton={false}
                showDrawerButton={true}
            />


            {loading ? (
                <WishlistSkeleton />
            ) : (
                <ScrollView
                    className="flex-1"
                    contentContainerStyle={{ paddingBottom: 100 }}
                >
                    {items.length === 0 ? (
                        <View className="items-center justify-center mt-20">
                            <Heart size={80} color="#cbd5e1" fill="#f1f5f9" />
                            <Text className="text-gray-500 mt-4 text-lg">Your wishlist is empty</Text>
                            <TouchableOpacity
                                onPress={() => navigation.navigate('BrowseProducts')}
                                className="mt-4 bg-orange-500 px-8 py-3 rounded-full"
                            >
                                <Text className="text-white font-bold">Start Shopping</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <ProductGrid
                            items={items}
                            renderItem={(item) => (
                                <ProductCard
                                    product={item.products}
                                    actions={(() => {
                                        const isOwner = !!currentUserId && item.products?.user_id === currentUserId;
                                        return (
                                            <View className="space-y-2">
                                                {isOwner ? (
                                                    <View
                                                        style={{
                                                            backgroundColor: '#e2e8f0',
                                                            paddingVertical: 8,
                                                            borderRadius: 8,
                                                            justifyContent: 'center',
                                                            alignItems: 'center',
                                                        }}
                                                    >
                                                        <Text style={{ color: '#64748b', fontSize: 11, fontWeight: '800' }}>Your listing</Text>
                                                    </View>
                                                ) : (
                                                    <Pressable
                                                        onPress={() => handleAddToCart(item.products.id)}
                                                        style={({ pressed }) => ({
                                                            backgroundColor: '#00A082',
                                                            paddingVertical: 8,
                                                            borderRadius: 8,
                                                            flexDirection: 'row',
                                                            justifyContent: 'center',
                                                            alignItems: 'center',
                                                            opacity: pressed ? 0.85 : 1,
                                                        })}
                                                    >
                                                        <ShoppingBag color="white" size={14} />
                                                        <Text style={{ color: 'white', fontSize: 12, fontWeight: '700', marginLeft: 4 }}>To Cart</Text>
                                                    </Pressable>
                                                )}
                                                <TouchableOpacity
                                                    onPress={() => handleRemoveFromWishlist(item.id)}
                                                    className="bg-gray-100 py-2 rounded-lg items-center flex-row justify-center"
                                                >
                                                    <Heart size={14} color="#ef4444" fill="#ef4444" />
                                                    <Text className="text-gray-600 text-xs font-bold ml-1">Remove</Text>
                                                </TouchableOpacity>
                                            </View>
                                        );
                                    })()}
                                />
                            )}
                        />
                    )}
                </ScrollView>
            )}
        </View>
    );
}
