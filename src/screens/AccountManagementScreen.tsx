import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput } from 'react-native';
import { supabase } from '../lib/supabase';
import { Shield, ShieldCheck, User } from 'lucide-react-native';
import ScreenHeader from '../components/ScreenHeader';

interface Profile {
    id: string;
    username: string | null;
    role: string;
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
                .select('id, username, role')
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

    const handleUpdateRole = async (userId: string, newRole: string) => {
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ role: newRole })
                .eq('id', userId);

            if (error) throw error;
            setProfiles(prev => prev.map(p => p.id === userId ? { ...p, role: newRole } : p));
            Alert.alert('Success', `Role updated to ${newRole}`);
        } catch (error: any) {
            console.error('Error updating role:', error);
            Alert.alert('Error', 'Failed to update role');
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
                                            <Text className="text-[10px] font-black uppercase">{profile.role}</Text>
                                        </View>
                                    </View>
                                    <View className="flex-row gap-3">
                                        <TouchableOpacity
                                            onPress={() => handleUpdateRole(profile.id, 'user')}
                                            className={`p-4 rounded-3xl ${profile.role === 'user' ? 'bg-black' : 'bg-white border border-secondary/10'}`}
                                        >
                                            <User size={24} color={profile.role === 'user' ? 'white' : '#94a3b8'} />
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            onPress={() => handleUpdateRole(profile.id, 'admin')}
                                            className={`p-4 rounded-3xl ${profile.role === 'admin' ? 'bg-black' : 'bg-white border border-secondary/10'}`}
                                        >
                                            <Shield size={24} color={profile.role === 'admin' ? 'white' : '#94a3b8'} />
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            onPress={() => handleUpdateRole(profile.id, 'superadmin')}
                                            className={`p-4 rounded-3xl ${profile.role === 'superadmin' ? 'bg-black' : 'bg-white border border-secondary/10'}`}
                                        >
                                            <ShieldCheck size={24} color={profile.role === 'superadmin' ? 'white' : '#94a3b8'} />
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
