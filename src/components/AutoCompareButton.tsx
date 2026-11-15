import React, { useState } from 'react';
import { ActivityIndicator, Alert, Text, TouchableOpacity } from 'react-native';
import { Search } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useCompare } from '../contexts/CompareContext';
import { getAutoCompareSearchTerms, rankAutoCompareProducts } from '../lib/product-matching';

export default function AutoCompareButton({ product, compact = false }: { product: any; compact?: boolean }) {
    const navigation = useNavigation<any>();
    const { replaceProducts } = useCompare();
    const [loading, setLoading] = useState(false);

    const handlePress = async () => {
        const queryText = String(product?.title || '').trim();
        const terms = getAutoCompareSearchTerms(queryText);
        if (!product?.id || !terms.length || loading) return;

        setLoading(true);
        try {
            let query = supabase
                .from('products')
                .select('*, product_images(*), countries(id, name, currency)')
                .eq('product_status', 'published')
                .order('created_at', { ascending: false })
                .limit(100);

            if (product?.category) query = query.eq('category', product.category);

            const searchFilter = terms.flatMap(term => [
                `title.ilike.%${term}%`,
                `description.ilike.%${term}%`,
            ]).join(',');

            const { data, error } = await query.or(searchFilter);
            if (error) throw error;

            const candidates = [product, ...(data || []).filter((item: any) => item.id !== product.id)];
            const matches = rankAutoCompareProducts(candidates, queryText, 4);

            if (matches.length < 2) {
                Alert.alert(
                    'Not enough similar offers',
                    `We found “${queryText}”, but could not find another close listing from a different seller yet.`
                );
                return;
            }

            replaceProducts(matches);
            navigation.navigate('ProductComparison');
        } catch (error) {
            console.error('Auto Compare failed:', error);
            Alert.alert('Auto Compare unavailable', 'We could not find similar offers right now. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <TouchableOpacity
            onPress={handlePress}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel={`Automatically compare offers similar to ${product?.title || 'this product'}`}
            activeOpacity={0.75}
            style={{
                borderRadius: 10,
                paddingHorizontal: compact ? 8 : 12,
                paddingVertical: compact ? 8 : 10,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                backgroundColor: loading ? '#e2e8f0' : '#e8f7f3',
                borderWidth: 1,
                borderColor: '#b7e7da',
            }}
        >
            {loading
                ? <ActivityIndicator size="small" color="#00856d" />
                : <Search size={compact ? 13 : 15} color="#00856d" />}
            <Text style={{ marginLeft: 7, color: '#007d67', fontWeight: '900', fontSize: compact ? 11 : 13 }}>
                {loading ? 'Finding offers…' : 'Auto Compare'}
            </Text>
        </TouchableOpacity>
    );
}
