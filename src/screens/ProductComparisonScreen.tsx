import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import ScreenHeader from '../components/ScreenHeader';
import { useCompare } from '../contexts/CompareContext';
import { supabase } from '../lib/supabase';
import { getProductMainImage } from '../lib/image-utils';
import { X, Plus, Scale } from 'lucide-react-native';

const ROWS: { label: string; value: (product: any, sellers: Record<string, string>) => string }[] = [
    { label: 'Price', value: (p: any) => `${p.countries?.currency || 'KES'} ${Number(p.price || 0).toLocaleString()}` },
    { label: 'Category', value: (p: any) => p.category || 'Not listed' },
    { label: 'Location', value: (p: any) => [p.county, p.countries?.name].filter(Boolean).join(', ') || 'Not listed' },
    { label: 'Availability', value: (p: any) => p.available_quantity == null ? 'Not listed' : p.available_quantity > 0 ? `${p.available_quantity} in stock` : 'Out of stock' },
    { label: 'Condition', value: (p: any) => p.condition || 'Not specified' },
    { label: 'Warranty', value: (p: any) => p.warranty || 'Not specified' },
    { label: 'Delivery', value: (p: any) => p.delivery_terms || 'Not specified' },
    { label: 'Seller', value: (p: any, sellers: Record<string, string>) => sellers[p.user_id] || 'Seller details unavailable' },
    { label: 'Date listed', value: (p: any) => p.created_at ? new Date(p.created_at).toLocaleDateString() : 'Not listed' },
    { label: 'Description', value: (p: any) => p.description || 'No description provided' },
];

export default function ProductComparisonScreen() {
    const navigation = useNavigation<any>();
    const { products, removeProduct, clearProducts } = useCompare();
    const [sellers, setSellers] = useState<Record<string, string>>({});
    const [loadingSellers, setLoadingSellers] = useState(false);
    const attributeKeys = [...new Set(products.flatMap((product: any) => Object.keys(product.attributes || {})))];

    useEffect(() => {
        let active = true;
        const loadSellers = async () => {
            const ids = [...new Set(products.map((p: any) => p.user_id).filter(Boolean))];
            if (!ids.length) { setSellers({}); return; }
            setLoadingSellers(true);
            const { data, error } = await supabase.from('profiles').select('id, username, full_name').in('id', ids);
            if (active && !error) {
                const map: Record<string, string> = {};
                (data || []).forEach((profile: any) => {
                    map[profile.id] = profile.username || profile.full_name || 'Seller';
                });
                setSellers(map);
            }
            if (active) setLoadingSellers(false);
        };
        loadSellers();
        return () => { active = false; };
    }, [products]);

    return (
        <View style={{ flex: 1, backgroundColor: '#fff' }}>
            <ScreenHeader title="Compare Products" showBackButton />
            <ScrollView contentContainerStyle={{ paddingBottom: 132 }}>
                <View style={{ paddingHorizontal: 18, paddingTop: 18, paddingBottom: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 22, fontWeight: '900', color: '#111827' }}>Compare side by side</Text>
                            <Text style={{ color: '#6b7280', fontSize: 12, marginTop: 4 }}>
                                Compare up to four listings using the information sellers have provided.
                            </Text>
                        </View>
                        {products.length > 0 && (
                            <TouchableOpacity onPress={clearProducts} style={{ padding: 8 }}>
                                <Text style={{ color: '#dc2626', fontWeight: '800', fontSize: 12 }}>Clear all</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {products.length < 2 ? (
                    <View style={{ margin: 18, padding: 24, borderRadius: 20, backgroundColor: '#f8fafc', alignItems: 'center' }}>
                        <Scale size={34} color="#00A082" />
                        <Text style={{ color: '#111827', fontWeight: '900', fontSize: 16, marginTop: 12 }}>Choose at least two products</Text>
                        <Text style={{ color: '#6b7280', textAlign: 'center', marginTop: 6, lineHeight: 20 }}>
                            Add another product from Similar Products or Browse Products to start comparing.
                        </Text>
                        <TouchableOpacity onPress={() => navigation.navigate('App')} style={{ marginTop: 16, backgroundColor: '#00A082', borderRadius: 12, paddingHorizontal: 18, paddingVertical: 12 }}>
                            <Text style={{ color: '#fff', fontWeight: '900' }}>Browse products</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12 }}>
                            <View>
                                <View style={{ flexDirection: 'row' }}>
                                    <View style={{ width: 112, padding: 10, justifyContent: 'flex-end' }}>
                                        <Text style={{ color: '#6b7280', fontWeight: '900', fontSize: 11, textTransform: 'uppercase' }}>Product details</Text>
                                    </View>
                                    {products.map((product: any) => (
                                        <View key={product.id} style={{ width: 205, padding: 10, borderLeftWidth: 1, borderColor: '#e5e7eb' }}>
                                            <View style={{ height: 118, backgroundColor: '#f3f4f6', borderRadius: 12, overflow: 'hidden' }}>
                                                <Image source={{ uri: getProductMainImage(product) || 'https://via.placeholder.com/300x300?text=No+Image' }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                                            </View>
                                            <Text numberOfLines={2} style={{ color: '#111827', fontWeight: '900', marginTop: 9, minHeight: 38 }}>{product.title}</Text>
                                            <TouchableOpacity onPress={() => removeProduct(product.id)} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 7 }}>
                                                <X size={13} color="#dc2626" />
                                                <Text style={{ color: '#dc2626', fontSize: 11, fontWeight: '800', marginLeft: 4 }}>Remove</Text>
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                </View>
                                {ROWS.map((row, index) => (
                                    <View key={row.label} style={{ flexDirection: 'row', backgroundColor: index % 2 === 0 ? '#f8fafc' : '#fff', borderTopWidth: 1, borderColor: '#e5e7eb' }}>
                                        <View style={{ width: 112, padding: 10, justifyContent: 'center' }}>
                                            <Text style={{ color: '#475569', fontWeight: '900', fontSize: 11 }}>{row.label}</Text>
                                        </View>
                                        {products.map((product: any) => (
                                            <View key={product.id} style={{ width: 205, padding: 10, borderLeftWidth: 1, borderColor: '#e5e7eb', justifyContent: 'center' }}>
                                                <Text style={{ color: row.label === 'Price' ? '#00A082' : '#1f2937', fontWeight: row.label === 'Price' ? '900' : '600', fontSize: 12, lineHeight: 18 }}>
                                                    {row.value(product, sellers)}
                                                </Text>
                                            </View>
                                        ))}
                                    </View>
                                ))}
                                {attributeKeys.map((key, index) => (
                                    <View key={key} style={{ flexDirection: 'row', backgroundColor: index % 2 === 0 ? '#f8fafc' : '#fff', borderTopWidth: 1, borderColor: '#e5e7eb' }}>
                                        <View style={{ width: 112, padding: 10, justifyContent: 'center' }}>
                                            <Text style={{ color: '#475569', fontWeight: '900', fontSize: 11 }}>{key}</Text>
                                        </View>
                                        {products.map((product: any) => (
                                            <View key={product.id} style={{ width: 205, padding: 10, borderLeftWidth: 1, borderColor: '#e5e7eb', justifyContent: 'center' }}>
                                                <Text style={{ color: '#1f2937', fontWeight: '600', fontSize: 12, lineHeight: 18 }}>{product.attributes?.[key] == null ? 'Not specified' : String(product.attributes[key])}</Text>
                                            </View>
                                        ))}
                                    </View>
                                ))}
                            </View>
                        </ScrollView>
                        {loadingSellers && <ActivityIndicator color="#00A082" style={{ marginTop: 12 }} />}
                        <TouchableOpacity onPress={() => navigation.navigate('App')} style={{ marginHorizontal: 18, marginTop: 4, padding: 15, backgroundColor: '#111827', borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                            <Plus size={17} color="#fff" />
                            <Text style={{ color: '#fff', fontWeight: '900', marginLeft: 8 }}>Add another product</Text>
                        </TouchableOpacity>
                    </>
                )}
            </ScrollView>
        </View>
    );
}
