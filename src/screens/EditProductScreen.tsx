import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { Camera, Package, MapPin, Globe, Tag, ArrowLeft, DollarSign, Hash, Check, X, Image as ImageIcon, Edit } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getImageUrl } from '../lib/image-utils';
import ScreenHeader from '../components/ScreenHeader';
import { aiApi } from '../lib/api';
import { CATEGORIES } from '../lib/categories';

async function uriToBlob(uri: string): Promise<Blob> {
    if (uri.startsWith('data:')) {
        const [header, base64] = uri.split(',');
        const mime = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return new Blob([bytes], { type: mime });
    }
    const response = await fetch(uri);
    return response.blob();
}

interface ImageItem {
    uri: string;
    isMain: boolean;
    isExisting?: boolean;
    existingId?: number;
    existingPath?: string;
}

export default function EditProductScreen() {
    const navigation = useNavigation();
    const route = useRoute();
    const insets = useSafeAreaInsets();
    const { productId } = route.params as { productId: string };
    
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [optimizing, setOptimizing] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        price: '',
        category: 'Electronics',
        available_quantity: '1',
        county: '',
        country_id: '',
        validity_period: 'day'
    });
    const [images, setImages] = useState<ImageItem[]>([]);
    const [countries, setCountries] = useState<any[]>([]);

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        try {
            setLoading(true);
            const { data: countriesData } = await supabase.from('countries').select('*').order('name');
            setCountries(countriesData || []);

            const { data: product, error: productError } = await supabase
                .from('products')
                .select(`*, product_images(*)`)
                .eq('id', productId)
                .single();

            if (productError) throw productError;

            setFormData({
                title: product.title || '',
                description: product.description || '',
                price: product.price?.toString() || '',
                category: product.category || 'Electronics',
                available_quantity: product.available_quantity?.toString() || '1',
                county: product.county || '',
                country_id: product.country_id?.toString() || '',
                validity_period: product.validity_period || 'day'
            });

            if (product.product_images && product.product_images.length > 0) {
                const sortedImages = product.product_images.sort((a: any, b: any) => 
                    (a.display_order || 0) - (b.display_order || 0)
                );
                setImages(sortedImages.map((img: any) => ({
                    uri: getImageUrl(img.storage_path),
                    isMain: img.is_main || false,
                    isExisting: true,
                    existingId: img.id,
                    existingPath: img.storage_path
                })));
            } else if (product.storage_path) {
                setImages([{
                    uri: getImageUrl(product.storage_path),
                    isMain: true,
                    isExisting: true,
                    existingPath: product.storage_path
                }]);
            }
        } catch (error: any) {
            console.error('Error fetching product:', error);
            Alert.alert('Error', 'Failed to load product data');
            navigation.goBack();
        } finally {
            setLoading(false);
        }
    };

    const pickImage = async (isMain: boolean = false) => {
        if (images.length >= 5) {
            Alert.alert('Limit Reached', 'Up to 5 images allowed');
            return;
        }
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.8,
        });
        if (!result.canceled && result.assets[0]) {
            const newImage: ImageItem = { uri: result.assets[0].uri, isMain, isExisting: false };
            if (isMain) {
                setImages(prev => [{ ...newImage, isMain: true }, ...prev.map(img => ({ ...img, isMain: false }))]);
            } else {
                setImages(prev => [...prev, newImage]);
            }
        }
    };

    const removeImage = (index: number) => {
        setImages(prev => prev.filter((_, i) => i !== index));
    };

    const setAsMain = (index: number) => {
        setImages(prev => {
            const updated = prev.map((img, i) => ({ ...img, isMain: i === index }));
            const selected = updated.splice(index, 1)[0];
            return [selected, ...updated];
        });
    };

    const handleSubmit = async () => {
        if (!formData.title || !formData.price || images.length === 0) {
            Alert.alert('Error', 'Please fill required fields');
            return;
        }
        try {
            setSaving(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            const uploadedImages = [];
            for (let i = 0; i < images.length; i++) {
                const img = images[i];
                if (img.isExisting) {
                    uploadedImages.push({ path: img.existingPath!, isMain: img.isMain });
                } else {
                    const blob = await uriToBlob(img.uri);
                    const path = `${user.id}/${Date.now()}-${i}.jpg`;
                    const { error: upErr } = await supabase.storage.from('images').upload(path, blob);
                    if (upErr) throw upErr;
                    uploadedImages.push({ path, isMain: img.isMain });
                }
            }

            const mainPath = uploadedImages.find(i => i.isMain)?.path || uploadedImages[0].path;

            // SEO optimization on every edit so updated copy stays aligned
            // with East Africa search trends.
            setOptimizing(true);
            const seo = await aiApi.optimizeListing({
                title: formData.title,
                description: formData.description,
                category: formData.category,
            });
            setOptimizing(false);

            const { error: prErr } = await supabase.from('products').update({
                title: seo.title || formData.title,
                description: seo.description || formData.description,
                price: parseFloat(formData.price),
                category: formData.category,
                available_quantity: parseInt(formData.available_quantity),
                storage_path: mainPath,
            }).eq('id', productId);

            if (prErr) throw prErr;

            await supabase.from('product_images').delete().eq('product_id', productId);
            const { error: imgErr } = await supabase.from('product_images').insert(uploadedImages.map((img, i) => ({
                product_id: productId,
                storage_path: img.path,
                is_main: img.isMain,
                display_order: i
            })));
            if (imgErr) throw imgErr;

            Alert.alert('Success', 'Product updated!');
            navigation.goBack();
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <View className="flex-1 justify-center items-center bg-white">
                <ActivityIndicator size="large" color="#00A082" />
                <Text className="text-black font-black mt-4">Loading product...</Text>
            </View>
        );
    }

    return (
        <View style={{ flex: 1 }} className="bg-white">
            <ScreenHeader title="Edit Product" showBackButton={true} />
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                <ScrollView 
                    style={{ flex: 1 }} 
                    contentContainerStyle={{ padding: 20, paddingBottom: 200 }}
                    showsVerticalScrollIndicator={true}
                    persistentScrollbar={true}
                    keyboardShouldPersistTaps="handled"
                    scrollEnabled={true}
                >
                    <View className="mb-8">
                        <TouchableOpacity onPress={() => pickImage(true)} className="w-full aspect-[4/3] bg-surface rounded-[30px] border-2 border-dashed border-secondary/30 justify-center items-center overflow-hidden mb-4">
                            {images.find(img => img.isMain) ? (
                                <View className="w-full h-full">
                                    <Image source={{ uri: images.find(img => img.isMain)!.uri }} className="w-full h-full" resizeMode="cover" />
                                    <View className="absolute top-4 left-4 bg-secondary px-3 py-1 rounded-full"><Text className="text-white font-black text-[10px]">MAIN</Text></View>
                                </View>
                            ) : (
                                <View className="items-center"><View className="bg-primary/20 rounded-full p-5 mb-3"><Camera size={32} color="black" /></View><Text className="text-black font-black text-lg">Change Main Photo</Text></View>
                            )}
                        </TouchableOpacity>
                    </View>

                    <View className="bg-surface rounded-[40px] p-6 mb-6 border border-secondary/10">
                        <Text className="text-xl font-black text-black mb-6">Info</Text>
                        <View className="mb-6"><Text className="text-xs font-black text-black/40 uppercase mb-2 ml-1">Title</Text><TextInput className="bg-white rounded-2xl border border-secondary/20 p-4 font-bold" placeholder="Title" value={formData.title} onChangeText={t => setFormData(p => ({ ...p, title: t }))} /></View>
                        <View className="mb-6"><Text className="text-xs font-black text-black/40 uppercase mb-2 ml-1">Category</Text><ScrollView horizontal showsHorizontalScrollIndicator={false}>{CATEGORIES.map(c => <TouchableOpacity key={c} onPress={() => setFormData(p => ({ ...p, category: c }))} className={`px-5 py-3 rounded-full border mr-3 ${formData.category === c ? 'bg-black' : 'bg-white'}`}><Text className={`font-black text-xs ${formData.category === c ? 'text-white' : 'text-black'}`}>{c}</Text></TouchableOpacity>)}</ScrollView></View>
                        <View><Text className="text-xs font-black text-black/40 uppercase mb-2 ml-1">Description</Text><TextInput className="bg-white rounded-2xl border border-secondary/20 p-4 font-bold min-h-[120]" multiline placeholder="Description" value={formData.description} onChangeText={t => setFormData(p => ({ ...p, description: t }))} /></View>
                    </View>

                    <View className="bg-surface rounded-[40px] p-6 mb-6 border border-secondary/10">
                        <Text className="text-xl font-black text-black mb-6">Price & Stock</Text>
                        <View className="flex-row space-x-4">
                            <View className="flex-1"><Text className="text-xs font-black text-black/40 uppercase mb-2 ml-1">Price</Text><TextInput className="bg-white rounded-2xl border border-secondary/20 p-4 font-bold" keyboardType="decimal-pad" value={formData.price} onChangeText={t => setFormData(p => ({ ...p, price: t }))} /></View>
                            <View className="flex-1"><Text className="text-xs font-black text-black/40 uppercase mb-2 ml-1">Qty</Text><TextInput className="bg-white rounded-2xl border border-secondary/20 p-4 font-bold" keyboardType="number-pad" value={formData.available_quantity} onChangeText={t => setFormData(p => ({ ...p, available_quantity: t }))} /></View>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>

            <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }} className="p-6 bg-white border-t border-gray-50">
                <TouchableOpacity onPress={handleSubmit} disabled={saving} className="bg-black py-5 rounded-2xl items-center">
                    {saving ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <ActivityIndicator color="white" />
                            <Text className="text-white font-black text-base uppercase tracking-widest" style={{ marginLeft: 10 }}>
                                {optimizing ? 'Optimizing for search…' : 'Updating…'}
                            </Text>
                        </View>
                    ) : (
                        <Text className="text-white font-black text-xl uppercase tracking-widest">Update Product</Text>
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );
}
