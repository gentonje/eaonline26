import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, FlatList, ActivityIndicator } from 'react-native';
import { supabase } from '../lib/supabase';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import ProductCard from '../components/ProductCard';
import ScreenHeader from '../components/ScreenHeader';
import { ProductGridSkeleton } from '../components/Skeleton';

type RootStackParamList = {
    Dashboard: undefined;
    BrowseProducts: { category?: string } | undefined;
    ProductDetail: { productId: string };
};

type NavigationProp = StackNavigationProp<RootStackParamList>;

const ITEMS_PER_PAGE = 10;

export default function BrowseProductsScreen() {
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [page, setPage] = useState(0);
    const isFetchingRef = useRef(false);
    const navigation = useNavigation<NavigationProp>();

    useEffect(() => {
        fetchProducts(0, true);
    }, []);

    async function fetchProducts(pageNum: number, isRefresh: boolean = false) {
        if (isFetchingRef.current && !isRefresh) return;
        if (!isRefresh && loadingMore) return;
        
        isFetchingRef.current = true;
        
        try {
            if (isRefresh) {
                setLoading(true);
            } else {
                setLoadingMore(true);
            }

            const from = pageNum * ITEMS_PER_PAGE;
            const to = from + ITEMS_PER_PAGE - 1;

            const { data, error } = await supabase
                .from('products')
                .select('*, product_images(*)')
                .eq('product_status', 'published')
                .order('created_at', { ascending: false })
                .range(from, to);

            if (error) throw error;

            const newProducts = data || [];
            
            if (isRefresh) {
                setProducts(newProducts);
            } else {
                setProducts(prev => [...prev, ...newProducts]);
            }
            
            setHasMore(newProducts.length === ITEMS_PER_PAGE);
            setPage(pageNum);
        } catch (error) {
            console.error('Error fetching products:', error);
        } finally {
            setLoading(false);
            setLoadingMore(false);
            isFetchingRef.current = false;
        }
    }

    const handleLoadMore = useCallback(() => {
        if (!loadingMore && hasMore) {
            fetchProducts(page + 1);
        }
    }, [loadingMore, hasMore, page]);

    const renderProduct = useCallback(({ item, index }: { item: any; index: number }) => (
        <View className="w-1/2 p-1">
            <ProductCard product={item} />
        </View>
    ), []);

    const renderFooter = () => {
        if (!loadingMore) return null;
        return (
            <View className="py-4">
                <ActivityIndicator size="small" color="#00A082" />
            </View>
        );
    };

    if (loading) {
        return (
            <View style={{ flex: 1 }} className="bg-white">
                <ScreenHeader title="Browse Products" showDrawerButton={true} />
                <View style={{ flex: 1, paddingHorizontal: 6, paddingTop: 8 }}>
                    <ProductGridSkeleton count={6} />
                </View>
            </View>
        );
    }

    return (
        <View style={{ flex: 1 }} className="bg-white">
            <ScreenHeader title="Browse Products" showDrawerButton={true} />
            <FlatList
                data={products}
                renderItem={renderProduct}
                keyExtractor={(item) => item.id.toString()}
                numColumns={2}
                contentContainerStyle={{ paddingBottom: 100, paddingHorizontal: 6, paddingTop: 8 }}
                showsVerticalScrollIndicator={false}
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.5}
                ListFooterComponent={renderFooter}
                columnWrapperStyle={{ marginHorizontal: -4 }}
            />
        </View>
    );
}
