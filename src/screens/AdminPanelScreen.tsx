import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Search, Settings, User, Save, Crown, Star, Sparkles, ShieldAlert } from 'lucide-react-native';
import ScreenHeader from '../components/ScreenHeader';

interface AccountTypeLimit {
    id: number;
    account_type: string;
    max_products: number;
}

interface UserProfile {
    id: string;
    username: string | null;
    account_type: string;
}

export default function AdminPanelScreen() {
    const { isAdmin, isSuperAdmin } = useAuth();
    const [limits, setLimits] = useState<AccountTypeLimit[]>([]);
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [savingLimits, setSavingLimits] = useState(false);
    const [search, setSearch] = useState('');
    const [editedLimits, setEditedLimits] = useState<{ [key: string]: string }>({});

    useEffect(() => {
        if (isAdmin || isSuperAdmin) {
            fetchData();
        } else {
            setLoading(false);
        }
    }, [isAdmin, isSuperAdmin]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [limitsRes, usersRes] = await Promise.all([
                supabase.from('account_type_limits').select('*').order('max_products', { ascending: true }),
                supabase.from('profiles').select('id, username, account_type').order('username', { ascending: true })
            ]);

            if (limitsRes.error) throw limitsRes.error;
            if (usersRes.error) throw usersRes.error;

            setLimits(limitsRes.data || []);
            setUsers(usersRes.data || []);
            
            const initialEdits: { [key: string]: string } = {};
            (limitsRes.data || []).forEach((l: AccountTypeLimit) => {
                initialEdits[l.account_type] = l.max_products.toString();
            });
            setEditedLimits(initialEdits);
        } catch (error: any) {
            console.error('Error fetching data:', error);
            Alert.alert('Error', 'Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveLimits = async () => {
        const invalidLimits = Object.entries(editedLimits).filter(([_, value]) => {
            const num = parseInt(value || '0', 10);
            return num < 1;
        });

        if (invalidLimits.length > 0) {
            Alert.alert('Invalid Value', 'All limits must be at least 1');
            return;
        }

        try {
            setSavingLimits(true);
            for (const limit of limits) {
                const newValue = parseInt(editedLimits[limit.account_type] || '1', 10);
                if (newValue !== limit.max_products) {
                    const { error } = await supabase
                        .from('account_type_limits')
                        .update({ max_products: newValue, updated_at: new Date().toISOString() })
                        .eq('account_type', limit.account_type);
                    if (error) throw error;
                }
            }
            await fetchData();
            Alert.alert('Success', 'Account limits updated successfully');
        } catch (error: any) {
            console.error('Error saving limits:', error);
            Alert.alert('Error', 'Failed to save limits');
        } finally {
            setSavingLimits(false);
        }
    };

    const handleUpdateAccountType = async (userId: string, newType: string) => {
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ account_type: newType })
                .eq('id', userId);

            if (error) throw error;
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, account_type: newType } : u));
            Alert.alert('Success', `Account type updated to ${newType}`);
        } catch (error: any) {
            console.error('Error updating account type:', error);
            Alert.alert('Error', 'Failed to update account type');
        }
    };

    const getAccountTypeIcon = (type: string) => {
        switch (type) {
            case 'premium':
                return <Crown color="#FFD147" size={18} />;
            case 'starter':
                return <Star color="#00A082" size={18} />;
            default:
                return <Sparkles color="#64748b" size={18} />;
        }
    };

    const getAccountTypeColor = (type: string) => {
        switch (type) {
            case 'premium':
                return 'bg-primary/20';
            case 'starter':
                return 'bg-accent/20';
            default:
                return 'bg-gray-100';
        }
    };

    const filteredUsers = users.filter(user =>
        (user.username?.toLowerCase() || '').includes(search.toLowerCase())
    );

    if (!isAdmin && !isSuperAdmin) {
        return (
            <View className="flex-1 bg-white">
                <ScreenHeader title="Admin Panel" showDrawerButton={true} />
                <View className="flex-1 justify-center items-center p-8">
                    <ShieldAlert color="#ef4444" size={64} />
                    <Text className="text-xl font-black text-black mt-4 text-center">Access Denied</Text>
                    <Text className="text-gray-500 mt-2 text-center">You don't have permission to access this section.</Text>
                </View>
            </View>
        );
    }

    if (loading) {
        return (
            <View className="flex-1 bg-white">
                <ScreenHeader title="Admin Panel" showDrawerButton={true} />
                <View className="flex-1 justify-center items-center">
                    <ActivityIndicator size="large" color="#FDB913" />
                </View>
            </View>
        );
    }

    return (
        <View className="flex-1 bg-white">
            <ScreenHeader title="Admin Panel" showDrawerButton={true} />
            <ScrollView className="flex-1 p-4" showsVerticalScrollIndicator={false}>
                {isSuperAdmin && (
                    <View className="bg-surface p-5 rounded-[32px] border border-secondary/5 mb-6">
                        <View className="flex-row items-center mb-4">
                            <Settings color="#00A082" size={24} />
                            <Text className="text-xl font-black text-black ml-3">Account Type Limits</Text>
                        </View>
                        <Text className="text-gray-500 mb-4 font-medium">
                            Configure the maximum number of products each account type can post
                        </Text>

                        {limits.map((limit) => (
                            <View key={limit.account_type} className="flex-row items-center justify-between mb-4 p-4 bg-white rounded-2xl border border-secondary/10">
                                <View className="flex-row items-center flex-1">
                                    {getAccountTypeIcon(limit.account_type)}
                                    <Text className="text-base font-bold text-black ml-3 capitalize">
                                        {limit.account_type}
                                    </Text>
                                </View>
                                <View className="flex-row items-center">
                                    <TextInput
                                        value={editedLimits[limit.account_type] || ''}
                                        onChangeText={(text) => {
                                            const cleaned = text.replace(/[^0-9]/g, '');
                                            setEditedLimits(prev => ({ ...prev, [limit.account_type]: cleaned }));
                                        }}
                                        keyboardType="numeric"
                                        className="bg-gray-50 px-4 py-2 rounded-xl w-20 text-center font-bold text-black border border-secondary/10"
                                    />
                                    <Text className="text-gray-500 ml-2 font-medium">items</Text>
                                </View>
                            </View>
                        ))}

                        <TouchableOpacity
                            onPress={handleSaveLimits}
                            disabled={savingLimits}
                            className="bg-accent px-6 py-4 rounded-2xl flex-row items-center justify-center mt-2"
                        >
                            {savingLimits ? (
                                <ActivityIndicator color="white" size="small" />
                            ) : (
                                <>
                                    <Save color="white" size={18} />
                                    <Text className="text-white font-black ml-2 text-sm uppercase tracking-wider">Save Limits</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                )}

                <View className="bg-surface p-5 rounded-[32px] border border-secondary/5 mb-6">
                    <View className="flex-row items-center mb-4">
                        <User color="#00A082" size={24} />
                        <Text className="text-xl font-black text-black ml-3">User Account Types</Text>
                    </View>

                    <View className="flex-row items-center bg-white p-4 rounded-2xl border border-secondary/10 mb-4">
                        <Search color="#64748b" size={20} />
                        <TextInput
                            placeholder="Search users..."
                            value={search}
                            onChangeText={setSearch}
                            className="flex-1 ml-2 text-base font-bold text-gray-900"
                        />
                    </View>

                    {filteredUsers.length === 0 ? (
                        <Text className="text-center text-gray-500 py-8 font-bold">No users found</Text>
                    ) : (
                        filteredUsers.map((user) => (
                            <View key={user.id} className="bg-white p-4 rounded-2xl border border-secondary/10 mb-3">
                                <View className="flex-row justify-between items-center mb-3">
                                    <Text className="text-base font-black text-black flex-1">
                                        {user.username || 'No username'}
                                    </Text>
                                    <View className={`px-3 py-1.5 rounded-full flex-row items-center ${getAccountTypeColor(user.account_type || 'basic')}`}>
                                        {getAccountTypeIcon(user.account_type || 'basic')}
                                        <Text className="text-xs font-black text-black ml-1.5 uppercase">
                                            {user.account_type || 'basic'}
                                        </Text>
                                    </View>
                                </View>
                                <View className="flex-row gap-2">
                                    {['basic', 'starter', 'premium'].map((type) => (
                                        <TouchableOpacity
                                            key={type}
                                            onPress={() => handleUpdateAccountType(user.id, type)}
                                            disabled={user.account_type === type}
                                            className={`flex-1 py-2.5 rounded-xl items-center ${user.account_type === type ? 'bg-accent' : 'bg-gray-100'}`}
                                        >
                                            <Text className={`text-xs font-black uppercase ${user.account_type === type ? 'text-white' : 'text-gray-600'}`}>
                                                {type}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        ))
                    )}
                </View>
            </ScrollView>
        </View>
    );
}
