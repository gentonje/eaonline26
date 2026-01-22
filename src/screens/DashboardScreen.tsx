import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ShoppingBag, Star, TrendingUp, Heart, Zap, MapPin } from 'lucide-react-native';
import ScreenHeader from '../components/ScreenHeader';

export default function DashboardScreen() {
    const navigation = useNavigation<any>();

    return (
        <View className="flex-1 bg-white">
            <ScreenHeader 
                title="South Sudan" 
                subtitle="Explore products near you"
                showDrawerButton={true}
                rightElement={
                    <View className="bg-white/30 px-3 py-1 rounded-full flex-row items-center">
                        <MapPin size={12} color="black" />
                        <Text className="ml-1 font-bold text-black text-[10px]">Nairobi, Kenya</Text>
                    </View>
                }
            />
            <ScrollView
                className="flex-1 bg-white"
                contentContainerStyle={{ paddingBottom: 100 }}
            >
                <View className="px-6 mt-2">
                    {/* Categories */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row mb-6">
                        {[
                            { name: 'Food', icon: <ShoppingBag color="#00A082" size={24} /> },
                            { name: 'Shops', icon: <TrendingUp color="#00A082" size={24} /> },
                            { name: 'Groceries', icon: <Zap color="#00A082" size={24} /> },
                            { name: 'Pharmacy', icon: <Star color="#00A082" size={24} /> }
                        ].map((cat) => (
                            <TouchableOpacity
                                key={cat.name}
                                className="bg-white w-24 h-24 rounded-full items-center justify-center mr-4 shadow-sm border border-secondary/20"
                                onPress={() => navigation.navigate('BrowseProducts', { category: cat.name })}
                            >
                                <View className="mb-1">{cat.icon}</View>
                                <Text className="text-xs font-bold text-gray-800">{cat.name}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    {/* Promotional Banner */}
                    <View className="bg-primary/20 rounded-3xl p-6 flex-row items-center justify-between mb-8 overflow-hidden">
                        <View className="flex-1 pr-4">
                            <Text className="text-xl font-black text-black mb-2">Free delivery in the WHOLE app</Text>
                            <Text className="text-black/60 text-sm">No minimum purchase</Text>
                        </View>
                        <View className="bg-white p-3 rounded-full">
                            <Zap color="#FDB913" size={24} fill="#FDB913" />
                        </View>
                    </View>

                    {/* Section Header */}
                    <View className="flex-row justify-between items-center mb-4">
                        <Text className="text-xl font-black text-gray-900">Featured items</Text>
                        <TouchableOpacity onPress={() => navigation.navigate('BrowseProducts')}>
                            <Text className="text-accent font-bold">See All</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>
        </View>
    );
}
