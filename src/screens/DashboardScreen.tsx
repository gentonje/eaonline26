import React, { useEffect, useState, useCallback } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import {
    ShoppingBag, Zap, Shirt, Sparkles,
    Dumbbell, Utensils, ArrowRight, Baby, Tag,
} from "lucide-react-native";
import ScreenHeader from "../components/ScreenHeader";
import ProductCard from "../components/ProductCard";
import { DashboardFeaturedSkeleton } from "../components/Skeleton";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from '../lib/supabase';
import { useColumns } from '../hooks/useColumns';

export default function DashboardScreen() {
    const navigation = useNavigation<any>();
    const { user } = useAuth();
    const numColumns = useColumns();
    const [displayName, setDisplayName] = useState('');
    const [featured, setFeatured] = useState<any[]>([]);
    const [featuredLoading, setFeaturedLoading] = useState(true);

    useEffect(() => {
        if (user) {
            supabase
                .from('profiles')
                .select('full_name, username')
                .eq('id', user.id)
                .maybeSingle()
                .then(({ data }) => {
                    if (data) {
                        setDisplayName(data.full_name || data.username || user.email?.split('@')[0] || 'Welcome');
                    } else {
                        setDisplayName(user.email?.split('@')[0] || 'Welcome');
                    }
                });
        }
    }, [user]);

    useFocusEffect(
        useCallback(() => {
            fetchFeatured();
        }, [])
    );

    async function fetchFeatured() {
        setFeaturedLoading(true);
        try {
            const { data, error } = await supabase
                .from('products')
                .select('*, product_images(*), countries(id, name, currency)')
                .eq('product_status', 'published')
                .order('created_at', { ascending: false })
                .limit(8);
            if (!error) setFeatured(data || []);
        } catch (e) {
            console.error('Error fetching featured products:', e);
        } finally {
            setFeaturedLoading(false);
        }
    }

    const categories = [
        { name: "Electronics", icon: <Zap color="#00A082" size={20} /> },
        { name: "Fashion",     icon: <ShoppingBag color="#00A082" size={20} /> },
        { name: "Clothing",    icon: <Shirt color="#00A082" size={20} /> },
        { name: "Handicrafts", icon: <Tag color="#00A082" size={20} /> },
        { name: "Sports",      icon: <Dumbbell color="#00A082" size={20} /> },
        { name: "Beauty",      icon: <Sparkles color="#00A082" size={20} /> },
        { name: "Children",    icon: <Baby color="#00A082" size={20} /> },
        { name: "Kitchen",     icon: <Utensils color="#00A082" size={20} /> },
    ];

    return (
        <View className="flex-1 bg-white">
            <ScreenHeader
                title={displayName ? `Hi, ${displayName} 👋` : "Welcome"}
                subtitle="Explore products near you"
                showDrawerButton={true}
            />
            <ScrollView
                className="flex-1 bg-white"
                contentContainerStyle={{ paddingBottom: 100 }}
                showsVerticalScrollIndicator={false}
            >
                {/* ── Category chips ─────────────────────────────────────── */}
                <View style={{ paddingHorizontal: 16, marginTop: 12, marginBottom: 4 }}>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: '#9ca3af', letterSpacing: 1.2, marginBottom: 10 }}>
                        SHOP BY CATEGORY
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            {categories.map((cat) => (
                                <TouchableOpacity
                                    key={cat.name}
                                    onPress={() => navigation.navigate("BrowseProducts", { category: cat.name })}
                                    style={{
                                        backgroundColor: '#fff',
                                        borderWidth: 1,
                                        borderColor: '#e5e7eb',
                                        borderRadius: 999,
                                        paddingHorizontal: 14,
                                        paddingVertical: 10,
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        gap: 6,
                                        elevation: 1,
                                        shadowColor: '#000',
                                        shadowOpacity: 0.04,
                                        shadowRadius: 4,
                                        shadowOffset: { width: 0, height: 1 },
                                    }}
                                >
                                    {cat.icon}
                                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#374151' }}>{cat.name}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </ScrollView>
                </View>

                {/* ── Promo banner ───────────────────────────────────────── */}
                <View style={{
                    marginHorizontal: 16, marginTop: 16, marginBottom: 20,
                    backgroundColor: '#FDB913', borderRadius: 24, padding: 20,
                    flexDirection: 'row', alignItems: 'center',
                    justifyContent: 'space-between', overflow: 'hidden',
                }}>
                    <View style={{ flex: 1, paddingRight: 12 }}>
                        <Text style={{ fontSize: 18, fontWeight: '900', color: '#1a1a1a', lineHeight: 24, marginBottom: 4 }}>
                            Free delivery{'\n'}across East Africa
                        </Text>
                        <Text style={{ fontSize: 13, color: 'rgba(0,0,0,0.55)', fontWeight: '600' }}>
                            No minimum purchase required
                        </Text>
                    </View>
                    <View style={{ backgroundColor: '#fff', borderRadius: 999, padding: 14, elevation: 3 }}>
                        <Zap color="#FDB913" size={26} fill="#FDB913" />
                    </View>
                </View>

                {/* ── Featured products ──────────────────────────────────── */}
                <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <Text style={{ fontSize: 18, fontWeight: '900', color: '#111827' }}>Featured Items</Text>
                        <TouchableOpacity
                            onPress={() => navigation.navigate("BrowseProducts")}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                        >
                            <Text style={{ color: '#00A082', fontWeight: '700', fontSize: 14 }}>See All</Text>
                            <ArrowRight size={14} color="#00A082" />
                        </TouchableOpacity>
                    </View>
                </View>

                {featuredLoading ? (
                    <DashboardFeaturedSkeleton numColumns={numColumns} />
                ) : (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12 }}>
                        {featured.map((product) => (
                            <View key={product.id} style={{ width: `${(100 / numColumns).toFixed(4)}%` as any, padding: 4 }}>
                                <ProductCard product={product} />
                            </View>
                        ))}
                    </View>
                )}
            </ScrollView>
        </View>
    );
}
