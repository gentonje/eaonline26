import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { supabase } from '../lib/supabase';
import { ShoppingBag } from 'lucide-react-native';

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [isLogin, setIsLogin] = useState(true);

    async function signInWithEmail() {
        setLoading(true);
        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });
            if (error) Alert.alert('Error', error.message);
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    }

    async function signUpWithEmail() {
        setLoading(true);
        try {
            const { error } = await supabase.auth.signUp({
                email,
                password,
            });
            if (error) Alert.alert('Error', error.message);
            else Alert.alert('Success', 'Please check your inbox for email verification!');
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <View className="flex-1 bg-white">
            <View className="flex-1 px-6 justify-center bg-primary rounded-b-[50px] shadow-lg">
                <View className="items-center mb-8">
                    <View className="bg-white p-4 rounded-full mb-4 shadow-sm">
                        <ShoppingBag size={64} color="#00A082" />
                    </View>
                    <Text className="text-4xl font-black text-black">Online Store</Text>
                    <Text className="text-black/60 font-bold mt-2">Shopping made easy</Text>
                </View>

                <View className="space-y-4">
                    <View className="bg-white rounded-2xl p-4 shadow-sm">
                        <TextInput
                            placeholder="Email"
                            value={email}
                            onChangeText={setEmail}
                            autoCapitalize="none"
                            className="text-gray-900 h-10"
                        />
                    </View>
                    <View className="bg-white rounded-2xl p-4 shadow-sm mt-4">
                        <TextInput
                            placeholder="Password"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                            className="text-gray-900 h-10"
                        />
                    </View>

                    <TouchableOpacity
                        className="bg-black py-5 rounded-2xl items-center mt-8 shadow-md"
                        onPress={isLogin ? signInWithEmail : signUpWithEmail}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <Text className="text-white font-black text-lg">
                                {isLogin ? 'Sign In' : 'Sign Up'}
                            </Text>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        className="mt-6"
                        onPress={() => setIsLogin(!isLogin)}
                    >
                        <Text className="text-center text-black font-bold">
                            {isLogin ? "Don't have an account? Sign Up" : 'Already have an account? Sign In'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
            <View className="p-8 items-center">
                <Text className="text-gray-400 font-bold">Rwanda's Trusted Marketplace</Text>
            </View>
        </View>
    );
}
