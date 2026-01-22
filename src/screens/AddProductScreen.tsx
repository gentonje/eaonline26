import React, { useState } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import ScreenHeader from '../components/ScreenHeader';
import WebScrollView from '../components/WebScrollView';

export default function AddProductScreen() {
    const navigation = useNavigation();
    const [loading, setLoading] = useState(false);

    if (loading) {
        return (
            <View className="flex-1 justify-center items-center">
                <ActivityIndicator size="large" color="#00A082" />
            </View>
        );
    }

    return (
        <View style={{ flex: 1, display: 'flex', flexDirection: 'column' }} className="bg-white">
            <ScreenHeader title="List Product" showBackButton={true} />
            <View style={{ flex: 1, position: 'relative' }}>
                <WebScrollView>
                    <View className="bg-surface p-6 rounded-[32px] mb-6 border border-secondary/10">
                        <Text className="text-xl font-black text-black mb-4">Photos Section</Text>
                        <View className="h-48 bg-primary/10 rounded-2xl justify-center items-center">
                            <Text className="text-black/50 font-bold">Photo upload area</Text>
                        </View>
                    </View>

                    <View className="bg-surface p-6 rounded-[32px] mb-6 border border-secondary/10">
                        <Text className="text-xl font-black text-black mb-4">Info Section</Text>
                        <View className="h-32 bg-primary/10 rounded-2xl justify-center items-center mb-4">
                            <Text className="text-black/50 font-bold">Title input</Text>
                        </View>
                        <View className="h-32 bg-primary/10 rounded-2xl justify-center items-center mb-4">
                            <Text className="text-black/50 font-bold">Category selector</Text>
                        </View>
                        <View className="h-32 bg-primary/10 rounded-2xl justify-center items-center">
                            <Text className="text-black/50 font-bold">Description input</Text>
                        </View>
                    </View>

                    <View className="bg-surface p-6 rounded-[32px] mb-6 border border-secondary/10">
                        <Text className="text-xl font-black text-black mb-4">Price & Stock Section</Text>
                        <View className="h-24 bg-primary/10 rounded-2xl justify-center items-center">
                            <Text className="text-black/50 font-bold">Price and quantity inputs</Text>
                        </View>
                    </View>

                    <View className="bg-surface p-6 rounded-[32px] mb-6 border border-secondary/10">
                        <Text className="text-xl font-black text-black mb-4">Additional Section</Text>
                        <View className="h-48 bg-primary/10 rounded-2xl justify-center items-center">
                            <Text className="text-black/50 font-bold">More content here</Text>
                        </View>
                    </View>

                    <View className="bg-surface p-6 rounded-[32px] mb-6 border border-secondary/10">
                        <Text className="text-xl font-black text-black mb-4">Extra Section 1</Text>
                        <View className="h-48 bg-primary/10 rounded-2xl justify-center items-center">
                            <Text className="text-black/50 font-bold">Extra content</Text>
                        </View>
                    </View>

                    <View className="bg-surface p-6 rounded-[32px] mb-6 border border-secondary/10">
                        <Text className="text-xl font-black text-black mb-4">Extra Section 2</Text>
                        <View className="h-48 bg-primary/10 rounded-2xl justify-center items-center">
                            <Text className="text-black/50 font-bold">More extra content</Text>
                        </View>
                    </View>

                    <TouchableOpacity className="bg-black py-5 rounded-2xl items-center mb-8">
                        <Text className="text-white font-black text-xl uppercase tracking-widest">List Product</Text>
                    </TouchableOpacity>
                </WebScrollView>
            </View>
        </View>
    );
}
