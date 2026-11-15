import React from 'react';
import { View, Text, ScrollView, Image, Pressable, Linking } from 'react-native';
import { Mail, Phone, Globe, Heart } from 'lucide-react-native';
import ScreenHeader from '../components/ScreenHeader';

const ceoImage = require('../../assets/ceo-david-muchai.jpg');
const salesImage = require('../../assets/sales-rael-kalekye.png');

const TEAL = '#00A082';
const YELLOW = '#FDB913';
const INK = '#111827';
const MUTED = '#64748b';

type PersonCardProps = {
    image: any;
    name: string;
    title: string;
    titleColor: string;
    subtitle: string;
    email: string;
    phone: string;
    phoneDisplay: string;
};

function PersonCard({ image, name, title, titleColor, subtitle, email, phone, phoneDisplay }: PersonCardProps) {
    return (
        <View
            style={{
                marginTop: 12,
                backgroundColor: 'white',
                borderRadius: 24,
                padding: 20,
                borderWidth: 1,
                borderColor: '#e5e7eb',
                shadowColor: '#000',
                shadowOpacity: 0.05,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 4 },
                elevation: 3,
            }}
        >
            <View style={{ alignItems: 'center' }}>
                <View
                    style={{
                        width: '100%',
                        aspectRatio: 3 / 4,
                        borderRadius: 20,
                        overflow: 'hidden',
                        backgroundColor: '#f8fafc',
                    }}
                >
                    <Image
                        source={image}
                        style={{ width: '100%', height: '100%' }}
                        resizeMode="cover"
                    />
                </View>
                <View style={{ marginTop: 16, alignItems: 'center' }}>
                    <Text style={{ fontSize: 22, fontWeight: '900', color: INK }}>{name}</Text>
                    <View
                        style={{
                            marginTop: 8,
                            backgroundColor: titleColor,
                            paddingHorizontal: 12,
                            paddingVertical: 5,
                            borderRadius: 999,
                        }}
                    >
                        <Text style={{ color: 'white', fontWeight: '900', fontSize: 11, letterSpacing: 1 }}>
                            {title}
                        </Text>
                    </View>
                    <Text style={{ marginTop: 8, color: MUTED, fontWeight: '600', fontSize: 13 }}>
                        {subtitle}
                    </Text>
                </View>
            </View>

            <View style={{ height: 1, backgroundColor: '#f1f5f9', marginVertical: 16 }} />

            <Pressable
                onPress={() => Linking.openURL(`mailto:${email}`)}
                style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 10,
                    opacity: pressed ? 0.6 : 1,
                })}
            >
                <View
                    style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        backgroundColor: '#ECFDF5',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 12,
                    }}
                >
                    <Mail size={16} color={TEAL} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: '#9ca3af', letterSpacing: 0.8 }}>
                        EMAIL
                    </Text>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: INK, marginTop: 2 }}>
                        {email}
                    </Text>
                </View>
            </Pressable>

            <Pressable
                onPress={() => Linking.openURL(`tel:${phone}`)}
                style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 10,
                    opacity: pressed ? 0.6 : 1,
                })}
            >
                <View
                    style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        backgroundColor: '#FFFBEB',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 12,
                    }}
                >
                    <Phone size={16} color="#B45309" />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: '#9ca3af', letterSpacing: 0.8 }}>
                        TELEPHONE
                    </Text>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: INK, marginTop: 2 }}>
                        {phoneDisplay}
                    </Text>
                </View>
            </Pressable>
        </View>
    );
}

export default function AboutScreen() {
    const openSite = () => Linking.openURL('https://eastafricaonline.com');

    return (
        <View className="flex-1 bg-white">
            <ScreenHeader title="About" subtitle="Who we are" showDrawerButton={true} />
            <ScrollView contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
                {/* Hero */}
                <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
                    <Text style={{ fontSize: 28, fontWeight: '900', color: INK, letterSpacing: -0.5 }}>
                        East Africa Online
                    </Text>
                    <View style={{ height: 4, width: 56, backgroundColor: YELLOW, borderRadius: 2, marginTop: 8 }} />
                    <Text style={{ marginTop: 14, fontSize: 15, lineHeight: 24, color: MUTED, fontWeight: '600' }}>
                        A cross-border marketplace connecting buyers and sellers across South Sudan, Kenya, Uganda,
                        Ethiopia and Rwanda. Shop products near you, pay with M-Pesa or your wallet, and get your
                        order delivered — all in one place.
                    </Text>
                </View>

                {/* Leadership */}
                <View style={{ paddingHorizontal: 20, marginTop: 28 }}>
                    <Text style={{ fontSize: 12, fontWeight: '900', color: '#9ca3af', letterSpacing: 1.4 }}>
                        LEADERSHIP
                    </Text>

                    <PersonCard
                        image={ceoImage}
                        name="David Muchai"
                        title="CHIEF EXECUTIVE OFFICER"
                        titleColor={TEAL}
                        subtitle="Founder & Visionary"
                        email="mngash2005@gmail.com"
                        phone="+254708165802"
                        phoneDisplay="0708 165 802"
                    />
                </View>

                {/* Sales */}
                <View style={{ paddingHorizontal: 20, marginTop: 28 }}>
                    <Text style={{ fontSize: 12, fontWeight: '900', color: '#9ca3af', letterSpacing: 1.4 }}>
                        SALES
                    </Text>

                    <PersonCard
                        image={salesImage}
                        name="Rael Kalekye Kiprop"
                        title="SALES EXECUTIVE"
                        titleColor="#B45309"
                        subtitle="Partnerships & Customer Success"
                        email="raelkalekye@gmail.com"
                        phone="+254701123685"
                        phoneDisplay="0701 123 685"
                    />
                </View>

                {/* Company links */}
                <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
                    <Text style={{ fontSize: 12, fontWeight: '900', color: '#9ca3af', letterSpacing: 1.4 }}>
                        COMPANY
                    </Text>
                    <Pressable
                        onPress={openSite}
                        style={({ pressed }) => ({
                            marginTop: 12,
                            backgroundColor: 'white',
                            borderRadius: 16,
                            paddingVertical: 14,
                            paddingHorizontal: 16,
                            flexDirection: 'row',
                            alignItems: 'center',
                            borderWidth: 1,
                            borderColor: '#e5e7eb',
                            opacity: pressed ? 0.7 : 1,
                        })}
                    >
                        <Globe size={18} color={TEAL} />
                        <Text style={{ marginLeft: 10, fontWeight: '700', color: INK, fontSize: 14, flex: 1 }}>
                            eastafricaonline.com
                        </Text>
                    </Pressable>
                </View>

                {/* Footer */}
                <View style={{ alignItems: 'center', marginTop: 40 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={{ color: MUTED, fontWeight: '700', fontSize: 12 }}>Made with</Text>
                        <Heart size={12} color="#ef4444" fill="#ef4444" style={{ marginHorizontal: 6 }} />
                        <Text style={{ color: MUTED, fontWeight: '700', fontSize: 12 }}>in East Africa</Text>
                    </View>
                    <Text style={{ marginTop: 6, color: '#9ca3af', fontSize: 11, fontWeight: '700' }}>
                        Version 1.0.0
                    </Text>
                </View>
            </ScrollView>
        </View>
    );
}
