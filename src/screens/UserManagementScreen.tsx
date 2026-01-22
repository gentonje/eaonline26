import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Image } from 'react-native';
import { supabase } from '../lib/supabase';
import { confirmAction } from '../lib/alerts';
import { Search, Trash2, Package, ChevronDown, ChevronUp, Check, X, Edit } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import ScreenHeader from '../components/ScreenHeader';
import { getImageUrl } from '../lib/image-utils';

interface Product {
    id: string;
    title: string;
    price: number;
    product_status: string;
    storage_path: string | null;
    created_at: string;
}

interface UserWithProducts {
    id: string;
    username: string | null;
    full_name: string | null;
    contact_email: string | null;
    products: Product[];
    expanded: boolean;
}

export default function UserManagementScreen() {
    const navigation = useNavigation<any>();
    const [users, setUsers] = useState<UserWithProducts[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [updatingProduct, setUpdatingProduct] = useState<string | null>(null);

    useEffect(() => {
        fetchUsersWithProducts();
    }, []);

    const fetchUsersWithProducts = async () => {
        try {
            setLoading(true);
            const { data: profiles, error: profilesError } = await supabase
                .from('profiles')
                .select('id, username, full_name, contact_email')
                .order('username');

            if (profilesError) throw profilesError;

            const usersWithProducts = await Promise.all((profiles || []).map(async (profile: any) => {
                const { data: products, error: productsError } = await supabase
                    .from('products')
                    .select('id, title, price, product_status, storage_path, created_at')
                    .eq('user_id', profile.id)
                    .order('created_at', { ascending: false });

                return {
                    ...profile,
                    products: products || [],
                    expanded: false
                };
            }));

            setUsers(usersWithProducts);
        } catch (error: any) {
            console.error('Error fetching users:', error);
            Alert.alert('Error', 'Failed to load users');
        } finally {
            setLoading(false);
        }
    };

    const toggleUserExpanded = (userId: string) => {
        setUsers(prev => prev.map(user => 
            user.id === userId ? { ...user, expanded: !user.expanded } : user
        ));
    };

    const toggleProductStatus = async (productId: string, currentStatus: string) => {
        const newStatus = currentStatus === 'published' ? 'pending' : 'published';
        const action = newStatus === 'published' ? 'publish' : 'unpublish';
        
        try {
            setUpdatingProduct(productId);
            const { error } = await supabase
                .from('products')
                .update({ product_status: newStatus })
                .eq('id', productId);

            if (error) throw error;

            setUsers(prev => prev.map(user => ({
                ...user,
                products: user.products.map(product => 
                    product.id === productId ? { ...product, product_status: newStatus } : product
                )
            })));
        } catch (error: any) {
            console.error('Error updating product status:', error);
            Alert.alert('Error', `Failed to ${action} product`);
        } finally {
            setUpdatingProduct(null);
        }
    };

    const handleDeleteProduct = async (productId: string, userId: string) => {
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
                    
                    setUsers(prev => prev.map(user => 
                        user.id === userId 
                            ? { ...user, products: user.products.filter(p => p.id !== productId) }
                            : user
                    ));
                } catch (error: any) {
                    console.error('Error deleting product:', error);
                    Alert.alert('Error', error.message || 'Failed to delete product');
                }
            }
        });
    };

    const filteredUsers = users.filter(user =>
        (user.username?.toLowerCase() || '').includes(search.toLowerCase()) ||
        (user.full_name?.toLowerCase() || '').includes(search.toLowerCase()) ||
        (user.contact_email?.toLowerCase() || '').includes(search.toLowerCase())
    );

    const getPendingCount = (products: Product[]) => 
        products.filter(p => p.product_status === 'pending').length;
    
    const getPublishedCount = (products: Product[]) => 
        products.filter(p => p.product_status === 'published').length;

    return (
        <View className="flex-1 bg-white">
            <ScreenHeader title="User Management" showDrawerButton={true} />
            <View className="flex-1 p-4">
                <View className="flex-row items-center bg-surface p-4 rounded-3xl border border-secondary/10 mb-6">
                    <Search color="#64748b" size={20} />
                    <TextInput
                        placeholder="Search users..."
                        value={search}
                        onChangeText={setSearch}
                        className="flex-1 ml-2 text-base font-bold text-gray-900"
                        placeholderTextColor="#9ca3af"
                    />
                </View>

                {loading ? (
                    <View className="flex-1 justify-center items-center">
                        <ActivityIndicator size="large" color="#FDB913" />
                    </View>
                ) : (
                    <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                        {filteredUsers.map((user) => (
                            <View key={user.id} className="bg-surface rounded-[32px] border border-secondary/5 mb-4 overflow-hidden">
                                <TouchableOpacity 
                                    onPress={() => toggleUserExpanded(user.id)}
                                    className="p-5"
                                >
                                    <View className="flex-row justify-between items-center">
                                        <View className="flex-1">
                                            <Text className="text-xl font-black text-black">
                                                {user.full_name || user.username || 'Anonymous'}
                                            </Text>
                                            {user.contact_email && (
                                                <Text className="text-black/40 font-bold text-sm">{user.contact_email}</Text>
                                            )}
                                            <View className="flex-row mt-2" style={{ gap: 8 }}>
                                                <View className="bg-accent/10 px-3 py-1 rounded-full">
                                                    <Text className="text-accent font-black text-[10px]">
                                                        {getPublishedCount(user.products)} PUBLISHED
                                                    </Text>
                                                </View>
                                                {getPendingCount(user.products) > 0 && (
                                                    <View className="bg-primary px-3 py-1 rounded-full">
                                                        <Text className="text-black font-black text-[10px]">
                                                            {getPendingCount(user.products)} PENDING
                                                        </Text>
                                                    </View>
                                                )}
                                            </View>
                                        </View>
                                        <View className="flex-row items-center">
                                            {user.products.length > 0 && (
                                                user.expanded ? 
                                                    <ChevronUp size={20} color="#64748b" /> : 
                                                    <ChevronDown size={20} color="#64748b" />
                                            )}
                                        </View>
                                    </View>
                                </TouchableOpacity>

                                {user.expanded && user.products.length > 0 && (
                                    <View className="border-t border-secondary/10 px-5 py-4">
                                        <Text className="text-xs font-black text-black/40 uppercase mb-3 tracking-widest">
                                            Products ({user.products.length})
                                        </Text>
                                        {user.products.map((product) => (
                                            <View 
                                                key={product.id} 
                                                className={`flex-row items-center p-3 rounded-2xl mb-2 ${
                                                    product.product_status === 'published' ? 'bg-accent/5' : 'bg-primary/20'
                                                }`}
                                            >
                                                <View className="w-14 h-14 bg-white rounded-xl overflow-hidden border border-secondary/10">
                                                    <Image
                                                        source={{ uri: getImageUrl(product.storage_path) }}
                                                        className="w-full h-full"
                                                        resizeMode="cover"
                                                    />
                                                </View>
                                                <View className="flex-1 ml-3">
                                                    <Text className="text-sm font-black text-black" numberOfLines={1}>
                                                        {product.title}
                                                    </Text>
                                                    <Text className="text-accent font-black text-sm">
                                                        ${product.price}
                                                    </Text>
                                                </View>
                                                <View className="flex-row items-center" style={{ gap: 8 }}>
                                                    <TouchableOpacity
                                                        onPress={() => toggleProductStatus(product.id, product.product_status)}
                                                        disabled={updatingProduct === product.id}
                                                        className={`px-3 py-2 rounded-xl flex-row items-center ${
                                                            product.product_status === 'published' 
                                                                ? 'bg-accent' 
                                                                : 'bg-black'
                                                        }`}
                                                    >
                                                        {updatingProduct === product.id ? (
                                                            <ActivityIndicator size="small" color="white" />
                                                        ) : (
                                                            <>
                                                                {product.product_status === 'published' ? (
                                                                    <Check size={14} color="white" />
                                                                ) : (
                                                                    <X size={14} color="white" />
                                                                )}
                                                                <Text className="text-white font-black text-[10px] ml-1 uppercase">
                                                                    {product.product_status === 'published' ? 'Published' : 'Pending'}
                                                                </Text>
                                                            </>
                                                        )}
                                                    </TouchableOpacity>
                                                    <TouchableOpacity
                                                        onPress={() => handleDeleteProduct(product.id, user.id)}
                                                        className="p-2 bg-red-50 rounded-xl"
                                                    >
                                                        <Trash2 color="#ef4444" size={16} />
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        ))}
                                    </View>
                                )}

                                {user.expanded && user.products.length === 0 && (
                                    <View className="border-t border-secondary/10 px-5 py-6 items-center">
                                        <Package size={32} color="#d1d5db" />
                                        <Text className="text-black/40 font-bold mt-2">No products</Text>
                                    </View>
                                )}
                            </View>
                        ))}
                    </ScrollView>
                )}
            </View>
        </View>
    );
}
