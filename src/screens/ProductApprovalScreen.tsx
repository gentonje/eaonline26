import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Image } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Search, CheckCircle, XCircle, Clock, Eye, ShieldAlert, Package, Sparkles, AlertTriangle, Camera } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import ScreenHeader from '../components/ScreenHeader';
import { getImageUrl } from '../lib/image-utils';
import { adminApi } from '../lib/api';
import { useFeedback } from '../contexts/FeedbackContext';

interface PendingProduct {
    id: string;
    title: string;
    description: string;
    price: number;
    category: string;
    product_status: string;
    storage_path: string | null;
    created_at: string;
    user_id: string;
    username: string | null;
    country_name: string | null;
    quality_flag: 'blurry' | 'harmful' | null;
    quality_reason: string | null;
    quality_checked_at: string | null;
}

export default function ProductApprovalScreen() {
    const { isAdmin, isSuperAdmin } = useAuth();
    const navigation = useNavigation<any>();
    const feedback = useFeedback();
    const [products, setProducts] = useState<PendingProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<'pending' | 'published' | 'all' | 'flagged'>('pending');
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [scanning, setScanning] = useState(false);

    const handleRunScan = async () => {
        try {
            setScanning(true);
            const r = await adminApi.runQualityScan(25);
            const msg = `Scanned ${r.scanned} · ${r.flagged_blurry} blurry · ${r.flagged_harmful} harmful`;
            feedback?.showToast?.(msg, 'success') ?? Alert.alert('Quality Scan', msg);
            await fetchProducts();
        } catch (err: any) {
            const msg = err?.message || 'Scan failed';
            feedback?.showToast?.(msg, 'error') ?? Alert.alert('Quality Scan Failed', msg);
        } finally {
            setScanning(false);
        }
    };

    useEffect(() => {
        if (isAdmin || isSuperAdmin) {
            fetchProducts();
        }
    }, [isAdmin, isSuperAdmin]);

    const fetchProducts = async () => {
        try {
            setLoading(true);

            const { data: productsData, error: productsError } = await supabase
                .from('products')
                .select('id, title, description, price, category, product_status, storage_path, created_at, user_id, country_id, quality_flag, quality_reason, quality_checked_at')
                .order('created_at', { ascending: false });

            if (productsError) throw productsError;

            const { data: profiles } = await supabase
                .from('profiles')
                .select('id, username, full_name');

            const { data: countriesData } = await supabase
                .from('countries')
                .select('id, name');

            const profileMap = new Map((profiles || []).map(p => [p.id, p.full_name || p.username || 'Unknown']));
            const countryMap = new Map((countriesData || []).map(c => [c.id, c.name]));

            const enriched: PendingProduct[] = (productsData || []).map(p => ({
                ...p,
                username: profileMap.get(p.user_id) || 'Unknown User',
                country_name: countryMap.get(p.country_id) || null,

            }));

            setProducts(enriched);
        } catch (error: any) {
            console.error('Error fetching products:', error);
            Alert.alert('Error', 'Failed to load products');
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (productId: string) => {
        try {
            setUpdatingId(productId);
            const { error } = await supabase
                .from('products')
                .update({ product_status: 'published' })
                .eq('id', productId);

            if (error) {
                console.error('Approve error:', JSON.stringify(error));
                throw error;
            }

            setProducts(prev => prev.map(p =>
                p.id === productId ? { ...p, product_status: 'published' } : p
            ));
        } catch (error: any) {
            console.error('Error approving product:', error);
            Alert.alert('Approve Failed', error?.message || 'Failed to approve product. Make sure the admin update policy is applied in Supabase.');
        } finally {
            setUpdatingId(null);
        }
    };

    const handleReject = async (productId: string, currentStatus: string) => {
        const nextStatus = currentStatus === 'published' ? 'draft' : 'rejected';
        const actionLabel = currentStatus === 'published' ? 'Unpublish Product' : 'Reject Product';
        Alert.alert(
            actionLabel,
            currentStatus === 'published'
                ? 'This will remove the listing from the public marketplace and return it to draft.'
                : 'This will reject the listing and remove it from the pending approval queue.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Confirm',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setUpdatingId(productId);
                            const { error } = await supabase
                                .from('products')
                                .update({ product_status: nextStatus })
                                .eq('id', productId)
                                .select('id, product_status')
                                .single();

                            if (error) {
                                console.error('Reject/Unpublish error:', JSON.stringify(error));
                                throw error;
                            }

                            setProducts(prev => prev.map(p =>
                                p.id === productId ? { ...p, product_status: nextStatus } : p
                            ));
                        } catch (error: any) {
                            console.error('Error rejecting product:', error);
                            Alert.alert('Action Failed', error?.message || 'Failed to update product. Make sure the admin update policy is applied in Supabase.');
                        } finally {
                            setUpdatingId(null);
                        }
                    }
                }
            ]
        );
    };

    const filteredProducts = products.filter(p => {
        const matchesSearch = p.title.toLowerCase().includes(search.toLowerCase()) ||
            (p.username?.toLowerCase() || '').includes(search.toLowerCase());

        if (filter === 'pending') return matchesSearch && p.product_status === 'draft';
        if (filter === 'published') return matchesSearch && p.product_status === 'published';
        if (filter === 'flagged') return matchesSearch && !!p.quality_flag;
        return matchesSearch;
    });

    const pendingCount = products.filter(p => p.product_status === 'draft').length;
    const publishedCount = products.filter(p => p.product_status === 'published').length;
    const flaggedCount = products.filter(p => !!p.quality_flag).length;

    if (!isAdmin && !isSuperAdmin) {
        return (
            <View className="flex-1 bg-white">
                <ScreenHeader title="Product Approvals" showDrawerButton={true} />
                <View className="flex-1 justify-center items-center p-8">
                    <ShieldAlert color="#ef4444" size={64} />
                    <Text className="text-xl font-black text-black mt-4 text-center">Access Denied</Text>
                    <Text className="text-gray-500 mt-2 text-center">You don't have permission to access this section.</Text>
                </View>
            </View>
        );
    }

    if (loading) {
        return (
            <View className="flex-1 bg-white">
                <ScreenHeader title="Product Approvals" showDrawerButton={true} />
                <View className="flex-1 justify-center items-center">
                    <ActivityIndicator size="large" color="#FDB913" />
                </View>
            </View>
        );
    }

    return (
        <View className="flex-1 bg-white">
            <ScreenHeader title="Product Approvals" showDrawerButton={true} />
            <View className="flex-1 p-4">
                <View className="flex-row mb-3" style={{ gap: 8 }}>
                    <View className="flex-1 bg-primary/20 p-4 rounded-2xl items-center">
                        <Text className="text-2xl font-black text-black">{pendingCount}</Text>
                        <Text className="text-xs font-bold text-black/50 uppercase">Pending</Text>
                    </View>
                    <View className="flex-1 bg-accent/10 p-4 rounded-2xl items-center">
                        <Text className="text-2xl font-black text-accent">{publishedCount}</Text>
                        <Text className="text-xs font-bold text-black/50 uppercase">Published</Text>
                    </View>
                    <View className="flex-1 bg-red-50 p-4 rounded-2xl items-center">
                        <Text className="text-2xl font-black text-red-500">{flaggedCount}</Text>
                        <Text className="text-xs font-bold text-black/50 uppercase">Flagged</Text>
                    </View>
                    <View className="flex-1 bg-gray-100 p-4 rounded-2xl items-center">
                        <Text className="text-2xl font-black text-black">{products.length}</Text>
                        <Text className="text-xs font-bold text-black/50 uppercase">Total</Text>
                    </View>
                </View>

                {/* Quality scanner: AI checks all published products' images for blur
                    and titles/descriptions/images for harmful content. Runs daily
                    automatically — this button kicks off an extra on-demand scan. */}
                <TouchableOpacity
                    onPress={handleRunScan}
                    disabled={scanning}
                    className="bg-accent flex-row items-center justify-center py-3 rounded-2xl mb-4"
                    style={{ opacity: scanning ? 0.7 : 1 }}
                >
                    {scanning ? (
                        <>
                            <ActivityIndicator size="small" color="#fff" />
                            <Text className="text-white font-black ml-2">Scanning images & captions…</Text>
                        </>
                    ) : (
                        <>
                            <Sparkles size={16} color="#fff" />
                            <Text className="text-white font-black ml-2">Run AI Quality &amp; Safety Scan</Text>
                        </>
                    )}
                </TouchableOpacity>

                <View className="flex-row items-center bg-surface p-3 rounded-2xl border border-secondary/10 mb-4">
                    <Search color="#64748b" size={18} />
                    <TextInput
                        placeholder="Search products or sellers..."
                        value={search}
                        onChangeText={setSearch}
                        className="flex-1 ml-2 text-sm font-bold text-gray-900"
                        placeholderTextColor="#9ca3af"
                    />
                </View>

                <View className="flex-row mb-4" style={{ gap: 6, flexWrap: 'wrap' }}>
                    {[
                        { key: 'pending' as const, label: 'Pending', icon: Clock, count: pendingCount },
                        { key: 'published' as const, label: 'Published', icon: CheckCircle, count: publishedCount },
                        { key: 'flagged' as const, label: 'Flagged', icon: AlertTriangle, count: flaggedCount },
                        { key: 'all' as const, label: 'All', icon: Package, count: products.length },
                    ].map(tab => (
                        <TouchableOpacity
                            key={tab.key}
                            onPress={() => setFilter(tab.key)}
                            className={`flex-1 py-2.5 rounded-xl items-center flex-row justify-center ${
                                filter === tab.key ? 'bg-accent' : 'bg-gray-100'
                            }`}
                        >
                            <tab.icon size={14} color={filter === tab.key ? '#fff' : '#64748b'} />
                            <Text className={`text-xs font-black ml-1 ${
                                filter === tab.key ? 'text-white' : 'text-gray-600'
                            }`}>
                                {tab.label} ({tab.count})
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {filteredProducts.length === 0 ? (
                    <View className="flex-1 justify-center items-center py-20">
                        <CheckCircle size={48} color="#00A082" />
                        <Text className="text-black/40 font-bold text-lg mt-4">All caught up!</Text>
                        <Text className="text-black/30 font-bold text-sm mt-1">
                            {filter === 'pending' ? 'No products waiting for approval' : 'No products found'}
                        </Text>
                    </View>
                ) : (
                    <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                        {filteredProducts.map((product) => (
                            <View
                                key={product.id}
                                className={`rounded-2xl border mb-3 overflow-hidden ${
                                    product.product_status === 'draft'
                                        ? 'border-primary/30 bg-primary/5'
                                        : 'border-accent/20 bg-accent/5'
                                }`}
                            >
                                <View className="flex-row p-3">
                                    <View className="w-20 h-20 bg-white rounded-xl overflow-hidden border border-secondary/10">
                                        <Image
                                            source={{ uri: getImageUrl(product.storage_path) }}
                                            className="w-full h-full"
                                            resizeMode="cover"
                                        />
                                    </View>
                                    <View className="flex-1 ml-3 justify-center">
                                        <Text className="text-base font-black text-black" numberOfLines={1}>
                                            {product.title}
                                        </Text>
                                        <Text className="text-sm font-bold text-accent mt-0.5">
                                            KES {product.price?.toLocaleString()}
                                        </Text>
                                        <View className="flex-row items-center mt-1" style={{ gap: 6 }}>
                                            <Text className="text-xs text-gray-500 font-medium">
                                                by {product.username}
                                            </Text>
                                            {product.country_name && (
                                                <Text className="text-xs text-gray-400 font-medium">
                                                    · {product.country_name}
                                                </Text>
                                            )}
                                        </View>
                                        <Text className="text-xs text-gray-400 font-medium mt-0.5">
                                            {new Date(product.created_at).toLocaleDateString()}
                                        </Text>
                                    </View>
                                    <View className="justify-center" style={{ gap: 4 }}>
                                        <View className={`px-2.5 py-1 rounded-full ${
                                            product.product_status === 'published' ? 'bg-accent/20' : 'bg-primary/30'
                                        }`}>
                                            <Text className={`text-[10px] font-black uppercase ${
                                                product.product_status === 'published' ? 'text-accent' : 'text-black'
                                            }`}>
                                                {product.product_status}
                                            </Text>
                                        </View>
                                        {product.quality_flag && (
                                            <View className={`px-2 py-1 rounded-full flex-row items-center ${
                                                product.quality_flag === 'harmful' ? 'bg-red-100' : 'bg-orange-100'
                                            }`}>
                                                {product.quality_flag === 'harmful'
                                                    ? <AlertTriangle size={10} color="#dc2626" />
                                                    : <Camera size={10} color="#ea580c" />}
                                                <Text className={`text-[9px] font-black uppercase ml-1 ${
                                                    product.quality_flag === 'harmful' ? 'text-red-600' : 'text-orange-600'
                                                }`}>
                                                    {product.quality_flag}
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                </View>

                                {product.quality_flag && product.quality_reason && (
                                    <View className={`mx-3 mb-2 p-2 rounded-lg flex-row items-start ${
                                        product.quality_flag === 'harmful' ? 'bg-red-50' : 'bg-orange-50'
                                    }`}>
                                        <AlertTriangle size={12} color={product.quality_flag === 'harmful' ? '#dc2626' : '#ea580c'} style={{ marginTop: 2 }} />
                                        <Text className={`text-xs font-bold ml-2 flex-1 ${
                                            product.quality_flag === 'harmful' ? 'text-red-700' : 'text-orange-700'
                                        }`}>
                                            AI flagged: {product.quality_reason}
                                        </Text>
                                    </View>
                                )}

                                <View className="flex-row border-t border-secondary/10 divide-x divide-secondary/10">
                                    <TouchableOpacity
                                        onPress={() => navigation.navigate('ProductDetail', { productId: product.id })}
                                        className="flex-1 flex-row items-center justify-center py-3"
                                    >
                                        <Eye size={14} color="#64748b" />
                                        <Text className="text-xs font-bold text-gray-500 ml-1">View</Text>
                                    </TouchableOpacity>

                                    {product.product_status === 'draft' ? (
                                        <>
                                            <TouchableOpacity
                                                onPress={() => handleApprove(product.id)}
                                                disabled={updatingId === product.id}
                                                className="flex-1 flex-row items-center justify-center py-3 bg-accent/10"
                                            >
                                                {updatingId === product.id ? (
                                                    <ActivityIndicator size="small" color="#00A082" />
                                                ) : (
                                                    <>
                                                        <CheckCircle size={14} color="#00A082" />
                                                        <Text className="text-xs font-black text-accent ml-1">Approve</Text>
                                                    </>
                                                )}
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                onPress={() => handleReject(product.id, product.product_status)}
                                                disabled={updatingId === product.id}
                                                className="flex-1 flex-row items-center justify-center py-3"
                                            >
                                                <XCircle size={14} color="#ef4444" />
                                                <Text className="text-xs font-black text-red-500 ml-1">Reject</Text>
                                            </TouchableOpacity>
                                        </>
                                    ) : (
                                        <TouchableOpacity
                                            onPress={() => handleReject(product.id)}
                                            disabled={updatingId === product.id}
                                            className="flex-1 flex-row items-center justify-center py-3"
                                        >
                                            {updatingId === product.id ? (
                                                <ActivityIndicator size="small" color="#ef4444" />
                                            ) : (
                                                <>
                                                    <XCircle size={14} color="#ef4444" />
                                                    <Text className="text-xs font-black text-red-500 ml-1">Unpublish</Text>
                                                </>
                                            )}
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>
                        ))}
                    </ScrollView>
                )}
            </View>
        </View>
    );
}
