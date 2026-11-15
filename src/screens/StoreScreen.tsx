import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, ActivityIndicator, TouchableOpacity, Alert, TextInput } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Store as StoreIcon, Edit3, Save, X, Package } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import ProductCard from '../components/ProductCard';
import ScreenHeader from '../components/ScreenHeader';
import { useColumns } from '../hooks/useColumns';

interface StoreRow {
    id: string;
    name: string;
    bio: string | null;
    logo_path: string | null;
}

export default function StoreScreen() {
    const route = useRoute<any>();
    const navigation = useNavigation<any>();
    const { user } = useAuth();
    const numColumns = useColumns();

    const storeId: string = route.params?.storeId;
    const isOwner = user?.id === storeId;

    const [store, setStore] = useState<StoreRow | null>(null);
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [draftName, setDraftName] = useState('');
    const [draftBio, setDraftBio] = useState('');

    useEffect(() => {
        if (!storeId) return;
        load();
    }, [storeId]);

    async function load() {
        setLoading(true);
        try {
            const { data: s, error: se } = await supabase
                .from('stores')
                .select('id, name, bio, logo_path')
                .eq('id', storeId)
                .maybeSingle();
            if (se) throw se;
            setStore(s);
            setDraftName(s?.name || '');
            setDraftBio(s?.bio || '');

            const productsQuery = supabase
                .from('products')
                .select('*, product_images(*), countries(id, name, currency)')
                .eq('user_id', storeId)
                .order('created_at', { ascending: false });
            // Owners see all their products; visitors only see published ones
            const { data: p, error: pe } = isOwner
                ? await productsQuery
                : await productsQuery.eq('product_status', 'published');
            if (pe) throw pe;
            setProducts(p || []);
        } catch (e: any) {
            console.error('Load store failed', e);
            Alert.alert('Error', e.message || 'Failed to load store');
        } finally {
            setLoading(false);
        }
    }

    async function saveStore() {
        if (!draftName.trim()) {
            Alert.alert('Required', 'Store name cannot be empty');
            return;
        }
        setSaving(true);
        try {
            const { error } = await supabase
                .from('stores')
                .update({ name: draftName.trim(), bio: draftBio.trim(), updated_at: new Date().toISOString() })
                .eq('id', storeId);
            if (error) throw error;
            setStore(prev => prev ? { ...prev, name: draftName.trim(), bio: draftBio.trim() } : prev);
            setEditing(false);
        } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed to save store');
        } finally {
            setSaving(false);
        }
    }

    const renderProduct = useCallback(({ item }: { item: any }) => (
        <View style={{ width: `${(100 / numColumns).toFixed(4)}%` as any, padding: 4 }}>
            <ProductCard product={item} />
        </View>
    ), [numColumns]);

    const header = (
        <View className="px-2 pt-3 pb-4">
            <View className="bg-surface rounded-3xl p-5 border border-secondary/10">
                <View className="flex-row items-center mb-3">
                    <View className="w-16 h-16 bg-accent/15 rounded-2xl justify-center items-center">
                        <StoreIcon size={28} color="#00A082" />
                    </View>
                    <View style={{ flex: 1 }} className="ml-3">
                        {editing ? (
                            <TextInput
                                value={draftName}
                                onChangeText={setDraftName}
                                placeholder="Store name"
                                placeholderTextColor="#9ca3af"
                                className="font-black text-black text-xl bg-white rounded-xl px-3 py-2 border border-secondary/20"
                            />
                        ) : (
                            <Text className="font-black text-black text-2xl" numberOfLines={1}>
                                {store?.name || 'Store'}
                            </Text>
                        )}
                        <Text className="text-xs font-bold text-black/40 mt-0.5">
                            {products.length} {products.length === 1 ? 'product' : 'products'}
                        </Text>
                    </View>
                    {isOwner && !editing && (
                        <TouchableOpacity
                            onPress={() => setEditing(true)}
                            className="bg-black w-10 h-10 rounded-full justify-center items-center"
                        >
                            <Edit3 size={16} color="white" />
                        </TouchableOpacity>
                    )}
                </View>

                {editing ? (
                    <>
                        <TextInput
                            value={draftBio}
                            onChangeText={setDraftBio}
                            placeholder="Tell buyers about your store (e.g. 'Quality used laptops at fair prices')"
                            placeholderTextColor="#9ca3af"
                            multiline
                            numberOfLines={3}
                            style={{ minHeight: 70, textAlignVertical: 'top' }}
                            className="font-medium text-black text-sm bg-white rounded-xl px-3 py-2 border border-secondary/20 mb-3"
                        />
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                            <TouchableOpacity
                                onPress={() => { setEditing(false); setDraftName(store?.name || ''); setDraftBio(store?.bio || ''); }}
                                className="bg-secondary/10 px-4 py-2.5 rounded-xl flex-row items-center"
                            >
                                <X size={14} color="#666" />
                                <Text className="font-black text-black/60 text-xs ml-1">CANCEL</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={saveStore}
                                disabled={saving}
                                style={{ flex: 1 }}
                                className="bg-accent rounded-xl py-2.5 flex-row items-center justify-center"
                            >
                                {saving
                                    ? <ActivityIndicator color="white" size="small" />
                                    : <><Save size={14} color="white" /><Text className="font-black text-white text-xs ml-1">SAVE STORE</Text></>}
                            </TouchableOpacity>
                        </View>
                    </>
                ) : (
                    store?.bio
                        ? <Text className="text-black/70 text-sm leading-5 font-medium">{store.bio}</Text>
                        : isOwner
                            ? <Text className="text-black/40 text-sm font-medium italic">Add a description so buyers know what you sell</Text>
                            : null
                )}
            </View>
        </View>
    );

    if (loading) {
        return (
            <View style={{ flex: 1 }} className="bg-white">
                <ScreenHeader title="Store" showBackButton={true} />
                <View className="flex-1 justify-center items-center">
                    <ActivityIndicator color="#00A082" />
                </View>
            </View>
        );
    }

    return (
        <View style={{ flex: 1 }} className="bg-white">
            <ScreenHeader title={store?.name || 'Store'} showBackButton={true} />
            <FlatList
                key={numColumns}
                data={products}
                renderItem={renderProduct}
                keyExtractor={(item) => item.id.toString()}
                numColumns={numColumns}
                ListHeaderComponent={header}
                contentContainerStyle={{ paddingBottom: 100, paddingHorizontal: 6 }}
                ListEmptyComponent={
                    <View className="items-center py-16">
                        <Package size={48} color="#d1d5db" />
                        <Text className="text-black/40 font-bold mt-4">
                            {isOwner ? 'No products yet — add some from your dashboard' : 'This store has no products yet'}
                        </Text>
                    </View>
                }
                columnWrapperStyle={numColumns > 1 ? { marginHorizontal: -4 } : undefined}
            />
        </View>
    );
}
