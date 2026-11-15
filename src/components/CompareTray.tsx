import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { X, Scale } from 'lucide-react-native';
import { useCompare } from '../contexts/CompareContext';

export default function CompareTray() {
    const navigation = useNavigation<any>();
    const { products, removeProduct, clearProducts } = useCompare();

    if (products.length === 0) return null;

    const ready = products.length >= 2;

    return (
        <View
            style={{
                position: 'absolute', left: 14, right: 14, bottom: 14, zIndex: 100,
                backgroundColor: '#111827', borderRadius: 20, padding: 12,
                flexDirection: 'row', alignItems: 'center',
                shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 12, elevation: 12,
            }}
        >
            <View style={{ flex: 1, marginRight: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Scale size={16} color="#fff" />
                    <Text style={{ color: '#fff', fontWeight: '900', marginLeft: 7 }}>
                        {products.length} of 4 selected
                    </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 5 }}>
                    {products.map((product: any) => (
                        <View key={product.id} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 8, maxWidth: 105 }}>
                            <Text numberOfLines={1} style={{ color: '#d1d5db', fontSize: 10, flexShrink: 1 }}>
                                {product.title}
                            </Text>
                            <TouchableOpacity onPress={() => removeProduct(product.id)} hitSlop={8} style={{ marginLeft: 3 }}>
                                <X size={12} color="#9ca3af" />
                            </TouchableOpacity>
                        </View>
                    ))}
                </View>
            </View>
            <TouchableOpacity
                onPress={() => ready ? navigation.navigate('ProductComparison') : navigation.navigate('App')}
                activeOpacity={0.8}
                style={{ backgroundColor: ready ? '#00A082' : '#374151', paddingHorizontal: 14, paddingVertical: 11, borderRadius: 13 }}
            >
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '900' }}>
                    {ready ? 'Compare now' : 'Add one more'}
                </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={clearProducts} hitSlop={10} style={{ marginLeft: 9, padding: 4 }}>
                <X size={17} color="#d1d5db" />
            </TouchableOpacity>
        </View>
    );
}
