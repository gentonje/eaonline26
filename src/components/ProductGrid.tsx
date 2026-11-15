import * as React from 'react';
import { View } from 'react-native';
import { useColumns } from '../hooks/useColumns';

interface ProductGridProps<T> {
    items: T[];
    renderItem: (item: T) => React.ReactNode;
}

export default function ProductGrid<T extends { id: string | number }>({ items, renderItem }: ProductGridProps<T>) {
    const numColumns = useColumns();
    const itemWidth = `${(100 / numColumns).toFixed(4)}%` as any;

    return (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {items.map((item) => (
                <View key={item.id} style={{ width: itemWidth, padding: 4 }}>
                    {renderItem(item)}
                </View>
            ))}
        </View>
    );
}
