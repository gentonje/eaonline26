import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import { UserCheck, UserX, Search, Shield } from 'lucide-react-native';
import ScreenHeader from '../components/ScreenHeader';

interface User {
    id: string;
    username: string | null;
    user_type: string;
}

export default function AdminPanelScreen() {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('profiles')
                .select('id, username, user_type')
                .order('username', { ascending: true });

            if (error) throw error;
            setUsers(data as User[]);
        } catch (error: any) {
            console.error('Error fetching users:', error);
            Alert.alert('Error', 'Failed to load users');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateUserRole = async (userId: string, newRole: 'user' | 'admin') => {
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ user_type: newRole })
                .eq('id', userId);

            if (error) throw error;

            // Update local state
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, user_type: newRole } : u));
            Alert.alert('Success', `User role updated to ${newRole}`);
        } catch (error: any) {
            console.error('Error updating role:', error);
            Alert.alert('Error', 'Failed to update user role');
        }
    };

    const filteredUsers = users.filter(user =>
        (user.username?.toLowerCase() || '').includes(search.toLowerCase())
    );

    return (
        <View className="flex-1 bg-white">
            <ScreenHeader title="Admin Panel" showDrawerButton={true} />
            <View className="flex-1 p-4">
                <View className="flex-row items-center bg-surface p-4 rounded-3xl border border-secondary/10 mb-6">
                    <Search color="#64748b" size={20} />
                    <TextInput
                        placeholder="Search users..."
                        value={search}
                        onChangeText={setSearch}
                        className="flex-1 ml-2 text-base font-bold text-gray-900"
                    />
                </View>

                {loading ? (
                    <View className="flex-1 justify-center items-center">
                        <ActivityIndicator size="large" color="#FDB913" />
                    </View>
                ) : (
                    <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                        {filteredUsers.length === 0 ? (
                            <Text className="text-center text-gray-500 mt-10 font-bold">No users found</Text>
                        ) : (
                            filteredUsers.map((user) => (
                                <View key={user.id} className="bg-surface p-5 rounded-[32px] border border-secondary/5 mb-4">
                                    <View className="flex-row justify-between items-center">
                                        <View className="flex-1">
                                            <Text className="text-xl font-black text-black">
                                                {user.username || 'No username'}
                                            </Text>
                                            <View className="flex-row items-center mt-2">
                                                <View className={`px-4 py-1.5 rounded-full ${user.user_type === 'super_admin' ? 'bg-purple-100' :
                                                    user.user_type === 'admin' ? 'bg-primary/20' : 'bg-gray-100'
                                                    }`}>
                                                    <Text className={`text-[10px] font-black ${user.user_type === 'super_admin' ? 'text-purple-700' :
                                                        user.user_type === 'admin' ? 'text-black' : 'text-gray-700'
                                                        }`}>
                                                        {user.user_type.toUpperCase()}
                                                    </Text>
                                                </View>
                                            </View>
                                        </View>

                                        <View>
                                            {user.user_type === 'user' && (
                                                <TouchableOpacity
                                                    onPress={() => handleUpdateUserRole(user.id, 'admin')}
                                                    className="bg-accent px-5 py-3 rounded-2xl flex-row items-center"
                                                >
                                                    <UserCheck color="white" size={16} />
                                                    <Text className="text-white font-black ml-2 text-xs uppercase tracking-wider">Make Admin</Text>
                                                </TouchableOpacity>
                                            )}
                                            {user.user_type === 'admin' && (
                                                <TouchableOpacity
                                                    onPress={() => handleUpdateUserRole(user.id, 'user')}
                                                    className="bg-red-500 px-5 py-3 rounded-2xl flex-row items-center"
                                                >
                                                    <UserX color="white" size={16} />
                                                    <Text className="text-white font-black ml-2 text-xs uppercase tracking-wider">Remove Admin</Text>
                                                </TouchableOpacity>
                                            )}
                                            {user.user_type === 'super_admin' && (
                                                <Shield color="#6b21a8" size={32} />
                                            )}
                                        </View>
                                    </View>
                                </View>
                            ))
                        )}
                    </ScrollView>
                )}
            </View>
        </View>
    );
}
