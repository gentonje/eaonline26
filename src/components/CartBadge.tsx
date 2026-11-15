import React, { useState, useCallback } from 'react';
import { View, Text, Pressable } from 'react-native';
import { ShoppingCart } from 'lucide-react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';

export default function CartBadge() {
    const navigation = useNavigation<any>();
    const [count, setCount] = useState(0);

    const fetchCount = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { setCount(0); return; }
            const { data: cart } = await supabase
                .from('cart')
                .select('id')
                .eq('user_id', user.id)
                .maybeSingle();
            if (!cart) { setCount(0); return; }
            const { count: itemCount } = await supabase
                .from('cart_items')
                .select('id', { count: 'exact', head: true })
                .eq('cart_id', cart.id);
            setCount(itemCount || 0);
        } catch {
            setCount(0);
        }
    };

    useFocusEffect(useCallback(() => { fetchCount(); }, []));

    const goToCart = () => {
        try {
            navigation.navigate('Cart');
        } catch {
            const parent = navigation.getParent?.();
            parent?.navigate('Cart');
        }
    };

    return (
        <Pressable
            onPress={goToCart}
            style={({ pressed }) => ({
                width: 40,
                height: 40,
                justifyContent: 'center',
                alignItems: 'center',
                opacity: pressed ? 0.7 : 1,
            })}
        >
            <ShoppingCart size={24} color="black" />
            {count > 0 && (
                <View style={{
                    position: 'absolute',
                    top: 2,
                    right: 0,
                    minWidth: 18,
                    height: 18,
                    paddingHorizontal: 4,
                    borderRadius: 9,
                    backgroundColor: '#FDB913',
                    justifyContent: 'center',
                    alignItems: 'center',
                    borderWidth: 1.5,
                    borderColor: '#00A082',
                }}>
                    <Text style={{ color: 'black', fontSize: 10, fontWeight: '900' }}>
                        {count > 99 ? '99+' : count}
                    </Text>
                </View>
            )}
        </Pressable>
    );
}
