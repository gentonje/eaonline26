import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { useCompare } from '../contexts/CompareContext';

export default function CompareButton({ product }: { product: any }) {
    const { addProduct, removeProduct, isCompared } = useCompare();
    const selected = isCompared(product?.id);

    return (
        <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={selected ? 'Remove from comparison' : 'Add to comparison'}
            onPress={() => selected ? removeProduct(product.id) : addProduct(product)}
            className={`rounded-xl px-3 py-2 items-center justify-center ${selected ? 'bg-accent/10 border border-accent/30' : 'bg-gray-100 border border-gray-200'}`}
            activeOpacity={0.75}
        >
            <Text className={`text-xs font-black ${selected ? 'text-accent' : 'text-gray-700'}`}>
                {selected ? '✓ Added to compare' : '+ Compare'}
            </Text>
        </TouchableOpacity>
    );
}
