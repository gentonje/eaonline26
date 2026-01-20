import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { Camera, ArrowLeft, Image as ImageIcon, X } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const CATEGORIES = ['Electronics', 'Fashion', 'Home', 'Beauty', 'Sports', 'Books', 'Toys', 'Other'];

export default function AddProductScreen() {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const [loading, setLoading] = useState(false);
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
    const [images, setImages] = useState<Array<{ uri: string; isMain: boolean }>>([]);
    const [countries, setCountries] = useState<any[]>([]);

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        try {
            const { data } = await supabase.from('countries').select('*').order('name');
            setCountries(data || []);
            if (data?.length) {
                setFormData(prev => ({ ...prev, country_id: data[0].id.toString(), county: 'Central' }));
            }
        } catch (error) {
            console.error('Error fetching countries:', error);
        }
    };

    const pickImage = async (isMain: boolean = false) => {
        if (images.length >= 5) {
            Alert.alert('Limit Reached', 'Up to 5 images allowed');
            return;
        }
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.8,
        });
        if (!result.canceled && result.assets[0]) {
            const newImage = { uri: result.assets[0].uri, isMain };
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
            Alert.alert('Error', 'Please fill required fields and add an image');
            return;
        }
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            const uploadedImages = [];
            for (let i = 0; i < images.length; i++) {
                const img = images[i];
                const res = await fetch(img.uri);
                const blob = await res.blob();
                const path = `${user.id}/${Date.now()}-${i}.jpg`;
                const { error: upErr } = await supabase.storage.from('images').upload(path, blob);
                if (upErr) throw upErr;
                uploadedImages.push({ path, isMain: img.isMain });
            }

            const mainPath = uploadedImages.find(i => i.isMain)?.path || uploadedImages[0].path;
            const { data: product, error: prErr } = await supabase.from('products').insert({
                title: formData.title,
                description: formData.description,
                price: parseFloat(formData.price),
                category: formData.category,
                available_quantity: parseInt(formData.available_quantity),
                user_id: user.id,
                storage_path: mainPath,
                country_id: parseInt(formData.country_id),
                county: formData.county
            }).select().single();

            if (prErr) throw prErr;

            await supabase.from('product_images').insert(uploadedImages.map((img, i) => ({
                product_id: product.id,
                storage_path: img.path,
                is_main: img.isMain,
                display_order: i
            })));

            Alert.alert('Success', 'Product listed!');
            navigation.goBack();
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={{ flex: 1 }} className="bg-white">
            <View className="bg-primary pt-12 pb-4 px-4 rounded-b-[30px] flex-row items-center">
                <TouchableOpacity onPress={() => navigation.goBack()} className="p-2 -ml-2">
                    <ArrowLeft size={24} color="black" />
                </TouchableOpacity>
                <Text className="text-2xl font-black text-black ml-2">List Product</Text>
            </View>

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 120 }}
                    showsVerticalScrollIndicator={true}
                    persistentScrollbar={true}
                    keyboardShouldPersistTaps="handled"
                >
                    <View className="mb-8">
                        <View className="flex-row justify-between items-center mb-4">
                            <Text className="text-lg font-black text-black uppercase tracking-widest">Photos ({images.length}/5)</Text>
                            {images.length < 5 && (
                                <TouchableOpacity onPress={() => pickImage(false)} className="flex-row items-center bg-accent/10 px-4 py-2 rounded-full">
                                    <ImageIcon size={16} color="#00A082" /><Text className="text-accent font-black text-xs ml-2">Add More</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                        <TouchableOpacity
                            onPress={() => pickImage(true)}
                            className="w-full aspect-[4/3] bg-surface rounded-[30px] border-2 border-dashed border-secondary/30 justify-center items-center overflow-hidden mb-4"
                        >
                            {images.find(img => img.isMain) ? (
                                <View className="w-full h-full">
                                    <Image source={{ uri: images.find(img => img.isMain)!.uri }} className="w-full h-full" resizeMode="cover" />
                                    <View className="absolute top-4 left-4 bg-secondary px-3 py-1 rounded-full"><Text className="text-white font-black text-[10px]">MAIN</Text></View>
                                    <TouchableOpacity onPress={() => removeImage(images.findIndex(i => i.isMain))} className="absolute top-4 right-4 bg-red-500 p-2 rounded-full"><X size={16} color="white" /></TouchableOpacity>
                                </View>
                            ) : (
                                <View className="items-center"><View className="bg-primary/20 rounded-full p-5 mb-3"><Camera size={32} color="black" /></View><Text className="text-black font-black text-lg">Add Main Photo</Text></View>
                            )}
                        </TouchableOpacity>
                        <View className="flex-row flex-wrap gap-4">
                            {images.filter(img => !img.isMain).map((img, i) => {
                                const idx = images.findIndex(x => x === img);
                                return (
                                    <View key={i} className="w-[47%] aspect-square relative rounded-3xl overflow-hidden shadow-sm">
                                        <Image source={{ uri: img.uri }} className="w-full h-full" resizeMode="cover" />
                                        <TouchableOpacity onPress={() => setAsMain(idx)} className="absolute top-2 left-2 bg-secondary/90 px-2 py-1 rounded-lg"><Text className="text-white font-black text-[8px]">Set Main</Text></TouchableOpacity>
                                        <TouchableOpacity onPress={() => removeImage(idx)} className="absolute top-2 right-2 bg-red-500 p-1.5 rounded-full"><X size={12} color="white" /></TouchableOpacity>
                                    </View>
                                );
                            })}
                        </View>
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

            <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, p: 6 }} className="p-6 bg-white border-t border-gray-50">
                <TouchableOpacity onPress={handleSubmit} disabled={loading} className="bg-black py-5 rounded-2xl items-center">{loading ? <ActivityIndicator color="white" /> : <Text className="text-white font-black text-xl uppercase">List Product</Text>}</TouchableOpacity>
            </View>
        </View>
    );
}
