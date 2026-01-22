import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, TextInput, Image, Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { Camera, Plus, X, Star } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenHeader from '../components/ScreenHeader';
import WebScrollView from '../components/WebScrollView';

const CATEGORIES = ['Electronics', 'Fashion', 'Home', 'Beauty', 'Sports', 'Books', 'Toys', 'Food', 'Other'];
const CURRENCIES = ['SSP', 'USD', 'KES', 'UGX'];

interface ImageItem {
    uri: string;
    isMain: boolean;
}

export default function AddProductScreen() {
    const navigation = useNavigation<any>();
    const insets = useSafeAreaInsets();
    
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        price: '',
        currency: 'SSP',
        category: 'Electronics',
        available_quantity: '1',
    });
    const [images, setImages] = useState<ImageItem[]>([]);

    const pickImage = async (isMain: boolean = false) => {
        if (images.length >= 5) {
            Alert.alert('Limit Reached', 'You can add up to 5 images only');
            return;
        }
        
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                aspect: [4, 3],
                quality: 0.8,
            });
            
            if (!result.canceled && result.assets[0]) {
                const newImage: ImageItem = { uri: result.assets[0].uri, isMain };
                if (isMain || images.length === 0) {
                    setImages(prev => [{ ...newImage, isMain: true }, ...prev.map(img => ({ ...img, isMain: false }))]);
                } else {
                    setImages(prev => [...prev, newImage]);
                }
            }
        } catch (error) {
            console.error('Error picking image:', error);
        }
    };

    const removeImage = (index: number) => {
        setImages(prev => {
            const updated = prev.filter((_, i) => i !== index);
            if (updated.length > 0 && !updated.some(img => img.isMain)) {
                updated[0].isMain = true;
            }
            return updated;
        });
    };

    const setAsMain = (index: number) => {
        setImages(prev => {
            const updated = prev.map((img, i) => ({ ...img, isMain: i === index }));
            const selected = updated.splice(index, 1)[0];
            return [selected, ...updated];
        });
    };

    const handleSubmit = async () => {
        if (!formData.title.trim()) {
            Alert.alert('Required', 'Please enter a product title');
            return;
        }
        if (!formData.price || parseFloat(formData.price) <= 0) {
            Alert.alert('Required', 'Please enter a valid price');
            return;
        }
        if (images.length === 0) {
            Alert.alert('Required', 'Please add at least one product image');
            return;
        }

        try {
            setSaving(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                Alert.alert('Error', 'Please login to list a product');
                return;
            }

            const uploadedImages: { path: string; isMain: boolean }[] = [];
            
            for (let i = 0; i < images.length; i++) {
                const img = images[i];
                const response = await fetch(img.uri);
                const blob = await response.blob();
                const fileName = `${user.id}/${Date.now()}-${i}.jpg`;
                
                const { error: uploadError } = await supabase.storage
                    .from('images')
                    .upload(fileName, blob, { contentType: 'image/jpeg' });
                
                if (uploadError) throw uploadError;
                uploadedImages.push({ path: fileName, isMain: img.isMain });
            }

            const mainImagePath = uploadedImages.find(img => img.isMain)?.path || uploadedImages[0].path;

            const { data: product, error: productError } = await supabase
                .from('products')
                .insert({
                    user_id: user.id,
                    title: formData.title.trim(),
                    description: formData.description.trim(),
                    price: parseFloat(formData.price),
                    currency: formData.currency,
                    category: formData.category,
                    available_quantity: parseInt(formData.available_quantity) || 1,
                    storage_path: mainImagePath,
                    product_status: 'published',
                })
                .select()
                .single();

            if (productError) throw productError;

            const imageRecords = uploadedImages.map((img, index) => ({
                product_id: product.id,
                storage_path: img.path,
                is_main: img.isMain,
                display_order: index,
            }));

            const { error: imagesError } = await supabase
                .from('product_images')
                .insert(imageRecords);

            if (imagesError) throw imagesError;

            Alert.alert('Success', 'Your product has been listed!', [
                { text: 'OK', onPress: () => navigation.goBack() }
            ]);
        } catch (error: any) {
            console.error('Error creating product:', error);
            Alert.alert('Error', error.message || 'Failed to create product');
        } finally {
            setSaving(false);
        }
    };

    const mainImage = images.find(img => img.isMain);
    const additionalImages = images.filter(img => !img.isMain);

    return (
        <View style={{ flex: 1, display: 'flex', flexDirection: 'column' }} className="bg-white">
            <ScreenHeader title="List Product" showBackButton={true} />
            
            <View style={{ flex: 1, position: 'relative' }}>
                <WebScrollView contentPadding={20}>
                    <View className="mb-6">
                        <Text className="text-xs font-black text-black/40 uppercase mb-3 tracking-widest">Main Photo *</Text>
                        <TouchableOpacity 
                            onPress={() => pickImage(true)} 
                            className="w-full aspect-[4/3] bg-surface rounded-[32px] border-2 border-dashed border-secondary/30 justify-center items-center overflow-hidden"
                        >
                            {mainImage ? (
                                <View className="w-full h-full">
                                    <Image source={{ uri: mainImage.uri }} className="w-full h-full" resizeMode="cover" />
                                    <View className="absolute top-4 left-4 bg-accent px-3 py-1 rounded-full">
                                        <Text className="text-white font-black text-[10px] uppercase">Main</Text>
                                    </View>
                                    <TouchableOpacity 
                                        onPress={() => removeImage(0)} 
                                        className="absolute top-4 right-4 bg-black/50 w-8 h-8 rounded-full justify-center items-center"
                                    >
                                        <X size={16} color="white" />
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <View className="items-center">
                                    <View className="bg-primary/30 rounded-full p-5 mb-3">
                                        <Camera size={32} color="black" />
                                    </View>
                                    <Text className="text-black font-black text-lg">Add Main Photo</Text>
                                    <Text className="text-black/40 font-bold text-sm mt-1">Tap to select</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    </View>

                    <View className="mb-6">
                        <Text className="text-xs font-black text-black/40 uppercase mb-3 tracking-widest">
                            Additional Photos ({additionalImages.length}/4)
                        </Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                            {additionalImages.map((img, idx) => (
                                <View key={idx} style={{ width: 80, height: 80 }}>
                                    <Image 
                                        source={{ uri: img.uri }} 
                                        style={{ width: 80, height: 80, borderRadius: 16 }} 
                                        resizeMode="cover" 
                                    />
                                    <TouchableOpacity 
                                        onPress={() => setAsMain(images.indexOf(img))}
                                        className="absolute bottom-1 left-1 bg-black/60 px-2 py-0.5 rounded-full"
                                    >
                                        <Text className="text-[8px] text-white font-black">SET MAIN</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity 
                                        onPress={() => removeImage(images.indexOf(img))} 
                                        className="absolute -top-2 -right-2 bg-red-500 w-6 h-6 rounded-full justify-center items-center"
                                    >
                                        <X size={12} color="white" />
                                    </TouchableOpacity>
                                </View>
                            ))}
                            {images.length < 5 && mainImage && (
                                <TouchableOpacity 
                                    onPress={() => pickImage(false)}
                                    style={{ width: 80, height: 80 }}
                                    className="bg-surface border-2 border-dashed border-secondary/30 rounded-2xl justify-center items-center"
                                >
                                    <Plus size={24} color="#00A082" />
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>

                    <View className="bg-surface rounded-[32px] p-6 mb-6 border border-secondary/10">
                        <Text className="text-xl font-black text-black mb-6">Product Info</Text>
                        
                        <View className="mb-5">
                            <Text className="text-xs font-black text-black/40 uppercase mb-2 ml-1 tracking-widest">Title *</Text>
                            <TextInput 
                                className="bg-white rounded-2xl border border-secondary/20 p-4 font-bold text-black"
                                placeholder="Enter product title"
                                placeholderTextColor="#9ca3af"
                                value={formData.title}
                                onChangeText={(text) => setFormData(prev => ({ ...prev, title: text }))}
                            />
                        </View>

                        <View className="mb-5">
                            <Text className="text-xs font-black text-black/40 uppercase mb-3 ml-1 tracking-widest">Category</Text>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                {CATEGORIES.map((cat) => (
                                    <TouchableOpacity 
                                        key={cat}
                                        onPress={() => setFormData(prev => ({ ...prev, category: cat }))}
                                        className={`px-4 py-2 rounded-full border ${formData.category === cat ? 'bg-black border-black' : 'bg-white border-secondary/20'}`}
                                    >
                                        <Text className={`font-black text-xs ${formData.category === cat ? 'text-white' : 'text-black'}`}>
                                            {cat}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        <View>
                            <Text className="text-xs font-black text-black/40 uppercase mb-2 ml-1 tracking-widest">Description</Text>
                            <TextInput 
                                className="bg-white rounded-2xl border border-secondary/20 p-4 font-bold text-black"
                                placeholder="Describe your product..."
                                placeholderTextColor="#9ca3af"
                                value={formData.description}
                                onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
                                multiline
                                numberOfLines={4}
                                style={{ minHeight: 120, textAlignVertical: 'top' }}
                            />
                        </View>
                    </View>

                    <View className="bg-surface rounded-[32px] p-6 mb-6 border border-secondary/10">
                        <Text className="text-xl font-black text-black mb-6">Pricing & Stock</Text>
                        
                        <View className="mb-5">
                            <Text className="text-xs font-black text-black/40 uppercase mb-3 ml-1 tracking-widest">Currency</Text>
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                {CURRENCIES.map((curr) => (
                                    <TouchableOpacity 
                                        key={curr}
                                        onPress={() => setFormData(prev => ({ ...prev, currency: curr }))}
                                        className={`px-5 py-3 rounded-full border ${formData.currency === curr ? 'bg-accent border-accent' : 'bg-white border-secondary/20'}`}
                                    >
                                        <Text className={`font-black text-sm ${formData.currency === curr ? 'text-white' : 'text-black'}`}>
                                            {curr}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        <View style={{ flexDirection: 'row', gap: 16 }}>
                            <View style={{ flex: 1 }}>
                                <Text className="text-xs font-black text-black/40 uppercase mb-2 ml-1 tracking-widest">Price *</Text>
                                <TextInput 
                                    className="bg-white rounded-2xl border border-secondary/20 p-4 font-bold text-black"
                                    placeholder="0.00"
                                    placeholderTextColor="#9ca3af"
                                    keyboardType="decimal-pad"
                                    value={formData.price}
                                    onChangeText={(text) => setFormData(prev => ({ ...prev, price: text }))}
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text className="text-xs font-black text-black/40 uppercase mb-2 ml-1 tracking-widest">Quantity</Text>
                                <TextInput 
                                    className="bg-white rounded-2xl border border-secondary/20 p-4 font-bold text-black"
                                    placeholder="1"
                                    placeholderTextColor="#9ca3af"
                                    keyboardType="number-pad"
                                    value={formData.available_quantity}
                                    onChangeText={(text) => setFormData(prev => ({ ...prev, available_quantity: text }))}
                                />
                            </View>
                        </View>
                    </View>

                    <TouchableOpacity 
                        onPress={handleSubmit} 
                        disabled={saving}
                        className="bg-black py-5 rounded-2xl items-center mb-8"
                        style={{ opacity: saving ? 0.7 : 1 }}
                    >
                        {saving ? (
                            <View className="flex-row items-center">
                                <ActivityIndicator color="white" size="small" />
                                <Text className="text-white font-black text-xl uppercase tracking-widest ml-3">Listing...</Text>
                            </View>
                        ) : (
                            <Text className="text-white font-black text-xl uppercase tracking-widest">List Product</Text>
                        )}
                    </TouchableOpacity>
                </WebScrollView>
            </View>
        </View>
    );
}
