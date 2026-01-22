import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput } from 'react-native';
import { supabase } from '../lib/supabase';
import { Shield, ShieldCheck, User } from 'lucide-react-native';
import ScreenHeader from '../components/ScreenHeader';

interface Profile {
    id: string;
    username: string | null;
    user_type: string;
}

export default function AccountManagementScreen() {
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        fetchProfiles();
    }, []);

    const fetchProfiles = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('profiles')
                .select('id, username, user_type')
                .order('username');

            if (error) throw error;
            setProfiles(data || []);
        } catch (error: any) {
            console.error('Error fetching profiles:', error);
            Alert.alert('Error', 'Failed to load profiles');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateType = async (userId: string, newType: string) => {
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ user_type: newType })
                .eq('id', userId);

            if (error) throw error;
            setProfiles(prev => prev.map(p => p.id === userId ? { ...p, user_type: newType } : p));
            Alert.alert('Success', `Account type updated to ${newType}`);
        } catch (error: any) {
            console.error('Error updating type:', error);
            Alert.alert('Error', 'Failed to update account type');
        }
    };

    const filteredProfiles = profiles.filter(p =>
        (p.username?.toLowerCase() || '').includes(search.toLowerCase())
    );

    return (
        <View className="flex-1 bg-white">
            <ScreenHeader title="Account Management" showDrawerButton={true} />
            <View className="flex-1 p-4">
                <TextInput
                    placeholder="Search usernames..."
                    value={search}
                    onChangeText={setSearch}
                    className="bg-surface p-5 rounded-[32px] border border-secondary/10 mb-6 font-bold"
                />

                {loading ? (
                    <ActivityIndicator size="large" color="#FDB913" />
                ) : (
                    <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                        {filteredProfiles.map((profile) => (
                            <View key={profile.id} className="bg-surface p-5 rounded-[40px] border border-secondary/5 mb-4">
                                <View className="flex-row justify-between items-center">
                                    <View>
                                        <Text className="text-xl font-black text-black">{profile.username || 'Anonymous'}</Text>
                                        <View className="bg-primary/20 px-3 py-1 rounded-full self-start mt-2">
                                            <Text className="text-[10px] font-black uppercase">{profile.user_type}</Text>
                                        </View>
                                    </View>
                                    <View className="flex-row gap-3">
                                        <TouchableOpacity
                                            onPress={() => handleUpdateType(profile.id, 'user')}
                                            className={`p-4 rounded-3xl ${profile.user_type === 'user' ? 'bg-black' : 'bg-white border border-secondary/10'}`}
                                        >
                                            <User size={24} color={profile.user_type === 'user' ? 'white' : '#94a3b8'} />
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            onPress={() => handleUpdateType(profile.id, 'admin')}
                                            className={`p-4 rounded-3xl ${profile.user_type === 'admin' ? 'bg-black' : 'bg-white border border-secondary/10'}`}
                                        >
                                            <Shield size={24} color={profile.user_type === 'admin' ? 'white' : '#94a3b8'} />
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            onPress={() => handleUpdateType(profile.id, 'super_admin')}
                                            className={`p-4 rounded-3xl ${profile.user_type === 'super_admin' ? 'bg-black' : 'bg-white border border-secondary/10'}`}
                                        >
                                            <ShieldCheck size={24} color={profile.user_type === 'super_admin' ? 'white' : '#94a3b8'} />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>
                        ))}
                    </ScrollView>
                )}
            </View>
        </View>
    );
}
