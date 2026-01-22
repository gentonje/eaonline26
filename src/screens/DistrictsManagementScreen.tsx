import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput, Modal } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { confirmAction } from '../lib/alerts';
import { Plus, Trash2, Edit2, MapPin, Globe } from 'lucide-react-native';
import ScreenHeader from '../components/ScreenHeader';

interface District {
    id: number;
    name: string;
    country_id: number;
    country_name?: string;
}

interface Country {
    id: number;
    name: string;
}

export default function DistrictsManagementScreen() {
    const { isAdmin } = useAuth();
    const [districts, setDistricts] = useState<District[]>([]);
    const [countries, setCountries] = useState<Country[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingDistrict, setEditingDistrict] = useState<District | null>(null);
    const [newName, setNewName] = useState('');
    const [selectedCountryId, setSelectedCountryId] = useState<number | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [districtsRes, countriesRes] = await Promise.all([
                supabase.from('districts').select('*, countries(name)').order('name'),
                supabase.from('countries').select('*').order('name')
            ]);

            if (districtsRes.error) throw districtsRes.error;
            if (countriesRes.error) throw countriesRes.error;

            setDistricts(districtsRes.data.map((d: any) => ({
                ...d,
                country_name: d.countries?.name
            })) || []);
            setCountries(countriesRes.data || []);
        } catch (error: any) {
            console.error('Error fetching districts:', error);
            Alert.alert('Error', 'Failed to load districts data');
        } finally {
            setLoading(false);
        }
    };

    const handleAddOrEdit = async () => {
        if (!newName.trim() || !selectedCountryId) {
            Alert.alert('Validation', 'Please provide a name and select a country');
            return;
        }

        try {
            let result;
            if (editingDistrict) {
                result = await supabase
                    .from('districts')
                    .update({ name: newName, country_id: selectedCountryId })
                    .eq('id', editingDistrict.id);
            } else {
                result = await supabase
                    .from('districts')
                    .insert({ name: newName, country_id: selectedCountryId });
            }

            if (result.error) throw result.error;

            setModalVisible(false);
            setEditingDistrict(null);
            setNewName('');
            setSelectedCountryId(null);
            fetchData();
            Alert.alert('Success', `District ${editingDistrict ? 'updated' : 'added'} successfully`);
        } catch (error: any) {
            console.error('Error saving district:', error);
            Alert.alert('Error', error.message || 'Failed to save district');
        }
    };

    const handleDelete = async (id: number) => {
        confirmAction({
            title: "Delete District",
            message: "Are you sure you want to delete this district?",
            confirmText: "Delete",
            style: "destructive",
            onConfirm: async () => {
                try {
                    const result = await supabase.from('districts').delete().eq('id', id);
                    if (result.error) throw result.error;
                    fetchData();
                    Alert.alert('Success', 'District deleted successfully');
                } catch (error: any) {
                    console.error('Error deleting district:', error);
                    Alert.alert('Error', error.message || 'Failed to delete district');
                }
            }
        });
    };

    return (
        <View className="flex-1 bg-white">
            <ScreenHeader title="Districts" showDrawerButton={true} />
            <View className="flex-1 p-4">
                <View className="flex-row justify-between items-center mb-6">
                    <View>
                        <Text className="text-black/50 font-black uppercase text-[10px] tracking-widest">Manage locations</Text>
                    </View>
                    <TouchableOpacity
                        onPress={() => {
                            setEditingDistrict(null);
                            setNewName('');
                            setSelectedCountryId(countries[0]?.id || null);
                            setModalVisible(true);
                        }}
                        className="bg-black p-4 rounded-[24px]"
                    >
                        <Plus color="white" size={24} />
                    </TouchableOpacity>
                </View>

                {loading ? (
                    <ActivityIndicator size="large" color="#FDB913" />
                ) : (
                    <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                        {districts.map((district) => (
                            <View key={district.id} className="bg-surface p-5 rounded-[40px] border border-secondary/5 mb-4 flex-row justify-between items-center">
                                <View>
                                    <Text className="text-xl font-black text-black">{district.name}</Text>
                                    <View className="flex-row items-center mt-1">
                                        <Globe size={14} color="#00A082" />
                                        <Text className="text-accent font-black text-[10px] ml-1 uppercase">{district.country_name}</Text>
                                    </View>
                                </View>
                                <View className="flex-row gap-3">
                                    <TouchableOpacity
                                        onPress={() => {
                                            setEditingDistrict(district);
                                            setNewName(district.name);
                                            setSelectedCountryId(district.country_id);
                                            setModalVisible(true);
                                        }}
                                        className="p-4 bg-primary/10 rounded-3xl"
                                    >
                                        <Edit2 size={20} color="#FDB913" />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => isAdmin ? handleDelete(district.id) : Alert.alert('Permission Denied', 'Only admins can delete districts')}
                                        className={`p-4 rounded-3xl ${isAdmin ? 'bg-red-50' : 'bg-gray-50 opacity-50'}`}
                                    >
                                        <Trash2 size={20} color={isAdmin ? "#ef4444" : "#94a3b8"} />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))}
                    </ScrollView>
                )}

                <Modal
                    animationType="slide"
                    transparent={true}
                    visible={modalVisible}
                    onRequestClose={() => setModalVisible(false)}
                >
                    <View className="flex-1 justify-end bg-black/60">
                        <View className="bg-white p-8 rounded-t-[50px] h-[70%] shadow-2xl">
                            <Text className="text-3xl font-black text-black mb-8">{editingDistrict ? 'Edit District' : 'Add District'}</Text>

                            <View className="mb-6">
                                <Text className="text-[10px] font-black text-black/40 uppercase mb-2 ml-1 tracking-widest">District Name</Text>
                                <TextInput
                                    value={newName}
                                    onChangeText={setNewName}
                                    placeholder="Enter name"
                                    className="bg-surface p-5 rounded-[24px] text-lg font-bold border border-secondary/10"
                                />
                            </View>

                            <View className="flex-1 mb-8">
                                <Text className="text-[10px] font-black text-black/40 uppercase mb-2 ml-1 tracking-widest">Country</Text>
                                <ScrollView showsVerticalScrollIndicator={false}>
                                    {countries.map(c => (
                                        <TouchableOpacity
                                            key={c.id}
                                            onPress={() => setSelectedCountryId(c.id)}
                                            className={`p-5 rounded-[24px] mb-3 border ${selectedCountryId === c.id ? 'bg-primary border-primary' : 'bg-surface border-secondary/10'}`}
                                        >
                                            <Text className={`font-black uppercase text-xs tracking-wider ${selectedCountryId === c.id ? 'text-black' : 'text-gray-400'}`}>{c.name}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>

                            <View className="flex-row gap-4">
                                <TouchableOpacity
                                    onPress={() => setModalVisible(false)}
                                    className="flex-1 bg-surface py-5 rounded-[24px] items-center border border-secondary/10"
                                >
                                    <Text className="font-black text-black/40 uppercase tracking-widest">Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={handleAddOrEdit}
                                    className="flex-1 bg-black py-5 rounded-[24px] items-center"
                                >
                                    <Text className="font-black text-white uppercase tracking-widest">Save</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
            </View>
        </View>
    );
}
