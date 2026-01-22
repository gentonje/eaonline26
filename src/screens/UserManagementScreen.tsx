import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Image } from 'react-native';
import { supabase } from '../lib/supabase';
import { confirmAction } from '../lib/alerts';
import { Search, Trash2, Package, Users, Edit } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import ScreenHeader from '../components/ScreenHeader';

interface UserStat {
    id: string;
    username: string | null;
    product_count: number;
    is_active: boolean;
    user_type: string;
}

export default function UserManagementScreen() {
    const navigation = useNavigation<any>();
    const [userStats, setUserStats] = useState<UserStat[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [activeTab, setActiveTab] = useState<'users' | 'products'>('users');
    const [products, setProducts] = useState<any[]>([]);

    useEffect(() => {
        if (activeTab === 'users') {
            fetchUserStats();
        } else {
            fetchProducts();
        }
    }, [activeTab]);

    const fetchUserStats = async () => {
        try {
            setLoading(true);
            const { data: profiles, error: profilesError } = await supabase
                .from('profiles')
                .select('id, username, user_type, is_active')
                .order('username');

            if (profilesError) throw profilesError;

            const stats = await Promise.all(profiles.map(async (profile: any) => {
                const { count, error: countError } = await supabase
                    .from('products')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', profile.id);

                return {
                    ...profile,
                    product_count: count || 0
                };
            }));

            setUserStats(stats as UserStat[]);
        } catch (error: any) {
            console.error('Error fetching user stats:', error);
            Alert.alert('Error', 'Failed to load user statistics');
        } finally {
            setLoading(false);
        }
    };

    const fetchProducts = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('products')
                .select(`
                    *,
                    product_images(*),
                    profiles:user_id (username)
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setProducts(data || []);
        } catch (error: any) {
            console.error('Error fetching products:', error);
            Alert.alert('Error', 'Failed to load products');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteProduct = async (productId: string) => {
        confirmAction({
            title: "Delete Product",
            message: "Are you sure you want to delete this product?",
            confirmText: "Delete",
            style: "destructive",
            onConfirm: async () => {
                try {
                    const { error } = await supabase
                        .from('products')
                        .delete()
                        .eq('id', productId);

                    if (error) throw error;
                    setProducts(prev => prev.filter(p => p.id !== productId));
                    Alert.alert('Success', 'Product deleted');
                } catch (error: any) {
                    console.error('Error deleting product:', error);
                    Alert.alert('Error', error.message || 'Failed to delete product');
                }
            }
        });
    };

    const filteredUsers = userStats.filter(user =>
        (user.username?.toLowerCase() || '').includes(search.toLowerCase())
    );

    const filteredProducts = products.filter(product =>
        (product.title?.toLowerCase() || '').includes(search.toLowerCase()) ||
        (product.profiles?.username?.toLowerCase() || '').includes(search.toLowerCase())
    );

    return (
        <View className="flex-1 bg-white">
            <ScreenHeader title="User Management" showDrawerButton={true} />
            <View className="flex-1 p-4">
                <View className="flex-row items-center bg-surface p-4 rounded-3xl border border-secondary/10 mb-6">
                    <Search color="#64748b" size={20} />
                    <TextInput
                        placeholder="Search users or products..."
                        value={search}
                        onChangeText={setSearch}
                        className="flex-1 ml-2 text-base font-bold text-gray-900"
                    />
                </View>

                <View className="flex-row bg-surface rounded-2xl p-2 mb-6 border border-secondary/5">
                    <TouchableOpacity
                        onPress={() => setActiveTab('users')}
                        className={`flex-1 py-3 rounded-xl items-center ${activeTab === 'users' ? 'bg-primary shadow-sm' : ''}`}
                    >
                        <Text className={`font-black uppercase text-xs tracking-wider ${activeTab === 'users' ? 'text-black' : 'text-gray-400'}`}>Users</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setActiveTab('products')}
                        className={`flex-1 py-3 rounded-xl items-center ${activeTab === 'products' ? 'bg-primary shadow-sm' : ''}`}
                    >
                        <Text className={`font-black uppercase text-xs tracking-wider ${activeTab === 'products' ? 'text-black' : 'text-gray-400'}`}>Products</Text>
                    </TouchableOpacity>
                </View>

                {loading ? (
                    <View className="flex-1 justify-center items-center">
                        <ActivityIndicator size="large" color="#FDB913" />
                    </View>
                ) : (
                    <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                        {activeTab === 'users' ? (
                            filteredUsers.map((user) => (
                                <View key={user.id} className="bg-surface p-5 rounded-[32px] border border-secondary/5 mb-4">
                                    <View className="flex-row justify-between items-center">
                                        <View>
                                            <Text className="text-xl font-black text-black">{user.username || 'Anonymous'}</Text>
                                            <Text className="text-black/50 font-bold">{user.product_count} Products</Text>
                                        </View>
                                        <View className={`px-4 py-2 rounded-full ${user.is_active ? 'bg-accent/10' : 'bg-red-100'}`}>
                                            <Text className={`text-[10px] font-black ${user.is_active ? 'text-accent' : 'text-red-700'}`}>
                                                {user.is_active ? 'ACTIVE' : 'INACTIVE'}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                            ))
                        ) : (
                            filteredProducts.map((product) => (
                                <View key={product.id} className="bg-surface p-5 rounded-[32px] border border-secondary/5 mb-4">
                                    <View className="flex-row items-center">
                                        <View className="w-20 h-20 bg-white rounded-2xl overflow-hidden border border-secondary/10">
                                            {product.product_images?.[0]?.storage_path ? (
                                                <Image
                                                    source={{ uri: `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/images/${product.product_images[0].storage_path}` }}
                                                    className="w-full h-full"
                                                />
                                            ) : (
                                                <View className="w-full h-full justify-center items-center bg-gray-50"><Package size={24} color="#94a3b8" /></View>
                                            )}
                                        </View>
                                        <View className="flex-1 ml-4">
                                            <Text className="text-lg font-black text-black" numberOfLines={1}>{product.title}</Text>
                                            <Text className="text-black/40 font-bold text-xs">By {product.profiles?.username || 'Unknown'}</Text>
                                            <Text className="text-accent font-black text-base mt-1">${product.price}</Text>
                                        </View>
                                        <View className="flex-row items-center">
                                            <TouchableOpacity
                                                onPress={() => navigation.navigate('EditProduct', { productId: product.id })}
                                                className="p-3 bg-primary/10 rounded-xl mr-2"
                                            >
                                                <Edit color="#FDB913" size={20} />
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                onPress={() => handleDeleteProduct(product.id)}
                                                className="p-3 bg-red-50 rounded-xl"
                                            >
                                                <Trash2 color="#ef4444" size={20} />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </View>
                            ))
                        )}
                    </ScrollView>
                )}
            </View>
        </View>
    );
}
