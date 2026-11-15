import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { Bell, Lock, Eye, Moon, Languages, HelpCircle, Info, ChevronRight, Sparkles, MessageCircle } from 'lucide-react-native';
import ScreenHeader from '../components/ScreenHeader';
import { useAssistant } from '../contexts/AssistantContext';

export default function SettingsScreen() {
    const { enabled: assistantEnabled, setEnabled: setAssistantEnabled, subscribed, setSubscribed } = useAssistant();
    return (
        <View className="flex-1 bg-white">
            <ScreenHeader title="Settings" showDrawerButton={true} />
            <ScrollView
                className="flex-1 bg-white"
                contentContainerStyle={{ paddingBottom: 60 }}
            >
                <View className="p-4">
                    <Text className="text-sm font-black text-black/40 ml-4 mb-2 uppercase tracking-widest">Shopping Assistant</Text>
                    <View className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-6 shadow-sm">
                        <SettingItem
                            icon={<MessageCircle size={20} color="#00A082" />}
                            label="Floating Assistant (Asha)"
                            hasSwitch
                            value={assistantEnabled}
                            onValueChange={setAssistantEnabled}
                        />
                        <SettingItem
                            icon={<Sparkles size={20} color="#FDB913" />}
                            label="Notify me of new products"
                            hasSwitch
                            value={subscribed}
                            onValueChange={setSubscribed}
                            isLast
                        />
                    </View>

                    <View className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-6 shadow-sm">
                        <SettingItem
                            icon={<Bell size={20} color="#00A082" />}
                            label="Notifications"
                            hasSwitch
                            initialValue={true}
                        />
                        <SettingItem
                            icon={<Moon size={20} color="#00A082" />}
                            label="Dark Mode"
                            hasSwitch
                            initialValue={false}
                        />
                        <SettingItem
                            icon={<Languages size={20} color="#00A082" />}
                            label="Language"
                            value="English"
                        />
                    </View>

                    <Text className="text-sm font-black text-black/40 ml-4 mb-2 uppercase tracking-widest">Security</Text>
                    <View className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-6 shadow-sm">
                        <SettingItem
                            icon={<Lock size={20} color="#64748b" />}
                            label="Change Password"
                        />
                        <SettingItem
                            icon={<Eye size={20} color="#64748b" />}
                            label="Privacy Settings"
                        />
                    </View>

                    <Text className="text-sm font-black text-black/40 ml-4 mb-2 uppercase tracking-widest">Support</Text>
                    <View className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-10 shadow-sm">
                        <SettingItem
                            icon={<HelpCircle size={20} color="#64748b" />}
                            label="Help Center"
                        />
                        <SettingItem
                            icon={<Info size={20} color="#64748b" />}
                            label="About App"
                            isLast
                        />
                    </View>
                </View>
            </ScrollView>
        </View>
    );
}

function SettingItem({ icon, label, value, hasSwitch, initialValue, onValueChange, isLast }: any) {
    const isControlled = hasSwitch && typeof value === 'boolean';
    const [internal, setInternal] = React.useState<boolean>(!!initialValue);
    const isEnabled = isControlled ? value : internal;
    const handleChange = (v: boolean) => {
        if (onValueChange) onValueChange(v);
        if (!isControlled) setInternal(v);
    };

    const showValueText = !hasSwitch && typeof value === 'string' && value.length > 0;

    return (
        <TouchableOpacity
            className={`flex-row items-center p-4 ${!isLast ? 'border-b border-gray-50' : ''}`}
            disabled={hasSwitch}
        >
            <View className="w-10 h-10 bg-gray-50 rounded-full items-center justify-center mr-3">
                {icon}
            </View>
            <Text className="flex-1 text-base text-black font-bold">{label}</Text>
            {showValueText && <Text className="text-black/50 font-bold mr-2">{value}</Text>}
            {hasSwitch ? (
                <Switch
                    value={isEnabled}
                    onValueChange={handleChange}
                    trackColor={{ false: "#e2e8f0", true: "#00A082" }}
                    thumbColor={isEnabled ? "#FFD147" : "#f8fafc"}
                />
            ) : (
                <ChevronRight size={20} color="#cbd5e1" />
            )}
        </TouchableOpacity>
    );
}
