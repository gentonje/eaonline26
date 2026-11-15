import React, { useState, useEffect } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, ActivityIndicator,
    ScrollView, Image, useWindowDimensions, Modal, KeyboardAvoidingView,
    Platform, TouchableWithoutFeedback, Keyboard,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { ShoppingBag, Mail, Lock, ArrowRight, ShieldCheck, Truck, Wallet, Sparkles, X } from 'lucide-react-native';
import Animated, {
    useSharedValue, useAnimatedStyle, withTiming, withSpring,
    withDelay, withRepeat, withSequence, Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const heroImage = require('../../assets/splash-hero.png');

export default function LoginScreen() {
    const { width, height } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const isWide = width >= 768;

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [isLogin, setIsLogin] = useState(true);
    const [authError, setAuthError] = useState('');
    const [showAuth, setShowAuth] = useState(false);

    // Animations
    const fadeIn  = useSharedValue(0);
    const slideUp = useSharedValue(30);
    const ctaScale = useSharedValue(0.92);
    const ctaPulse = useSharedValue(1);

    useEffect(() => {
        fadeIn.value  = withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) });
        slideUp.value = withSpring(0, { damping: 14, stiffness: 90 });
        ctaScale.value = withDelay(400, withSpring(1, { damping: 12, stiffness: 120 }));
        ctaPulse.value = withDelay(1200, withRepeat(
            withSequence(
                withTiming(1.03, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
                withTiming(1,    { duration: 1400, easing: Easing.inOut(Easing.ease) })
            ), -1, false
        ));
    }, []);

    const heroStyle = useAnimatedStyle(() => ({
        opacity: fadeIn.value,
        transform: [{ translateY: slideUp.value }],
    }));
    const ctaStyle = useAnimatedStyle(() => ({
        opacity: fadeIn.value,
        transform: [{ scale: ctaScale.value * ctaPulse.value }],
    }));

    async function signInWithEmail() {
        setAuthError('');
        setLoading(true);
        try {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) setAuthError(error.message);
        } catch (e: any) {
            setAuthError(e.message);
        } finally {
            setLoading(false);
        }
    }

    async function signUpWithEmail() {
        setAuthError('');
        setLoading(true);
        try {
            const { error } = await supabase.auth.signUp({ email, password });
            if (error) setAuthError(error.message);
            else setAuthError('Check your inbox for a verification email.');
        } catch (e: any) {
            setAuthError(e.message);
        } finally {
            setLoading(false);
        }
    }

    function openSignIn()  { setIsLogin(true);  setAuthError(''); setShowAuth(true); }
    function openSignUp()  { setIsLogin(false); setAuthError(''); setShowAuth(true); }
    function closeAuth()   { setShowAuth(false); Keyboard.dismiss(); }

    const features = [
        { icon: ShieldCheck, title: 'Secure Payments',   desc: 'M-Pesa & wallet protected' },
        { icon: Truck,        title: 'Fast Delivery',     desc: 'Across 5 East African nations' },
        { icon: Wallet,       title: 'Wallet Discounts',  desc: 'Save 5% on every purchase' },
    ];

    // ── Image sizing — compact on mobile so all content fits ──────────────
    const imgW = isWide ? Math.min(width * 0.42, 400) : Math.min(width * 0.44, 180);
    const imgH = isWide ? imgW * 1.3                  : imgW * 1.25;

    return (
        <>
            <ScrollView
                className="flex-1 bg-white"
                contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {/* ── HERO ─────────────────────────────────────────────────── */}
                <View style={{
                    backgroundColor: '#FDB913',
                    paddingTop: Math.max(insets.top + 8, 24),
                    paddingHorizontal: 20,
                    paddingBottom: isWide ? 48 : 32,
                    borderBottomLeftRadius: 40,
                    borderBottomRightRadius: 40,
                }}>
                    {/* Brand bar */}
                    <View className="flex-row items-center justify-between mb-5">
                        <View className="flex-row items-center">
                            <View className="bg-white p-2 rounded-2xl mr-2" style={{ elevation: 3 }}>
                                <ShoppingBag size={20} color="#00A082" />
                            </View>
                            <Text className="text-black font-black" style={{ fontSize: 16 }}>East Africa Online</Text>
                        </View>
                        <View style={{ backgroundColor: 'rgba(255,255,255,0.35)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, flexDirection: 'row', alignItems: 'center' }}>
                            <Sparkles size={11} color="#1a1a1a" />
                            <Text className="text-black font-black text-xs ml-1">LIVE</Text>
                        </View>
                    </View>

                    {/* Text + Image — always side-by-side, image on the right */}
                    <Animated.View style={[heroStyle, { flexDirection: 'row', alignItems: 'center', gap: isWide ? 32 : 16 }]}>
                        {/* Text column */}
                        <View style={{ flex: 1 }}>
                            <Text
                                className="text-black font-black leading-tight"
                                style={{ fontSize: isWide ? 46 : 28 }}
                            >
                                Shop the{'\n'}
                                <Text style={{ color: '#00A082' }}>heart of{'\n'}Africa</Text>
                            </Text>
                            <Text
                                className="text-black font-bold mt-2"
                                style={{ fontSize: isWide ? 16 : 13, lineHeight: isWide ? 24 : 19, opacity: 0.72 }}
                            >
                                From Nairobi to Juba — buy &amp; sell across East Africa with secure M-Pesa payments.
                            </Text>

                            {/* CTAs */}
                            <Animated.View style={[ctaStyle, { marginTop: isWide ? 28 : 18 }]}>
                                <TouchableOpacity
                                    onPress={openSignUp}
                                    activeOpacity={0.85}
                                    style={{
                                        backgroundColor: '#1a1a1a',
                                        borderRadius: 16,
                                        paddingVertical: isWide ? 18 : 14,
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        elevation: 6,
                                    }}
                                >
                                    <Text style={{ color: '#fff', fontWeight: '900', fontSize: isWide ? 17 : 15, marginRight: 6 }}>Get Started</Text>
                                    <ArrowRight size={isWide ? 20 : 16} color="#fff" />
                                </TouchableOpacity>

                                <TouchableOpacity onPress={openSignIn} style={{ marginTop: 10, alignItems: 'center' }}>
                                    <Text style={{ color: '#1a1a1a', fontWeight: '700', fontSize: 13 }}>
                                        Have an account?{' '}
                                        <Text style={{ color: '#00A082' }}>Sign in</Text>
                                    </Text>
                                </TouchableOpacity>
                            </Animated.View>
                        </View>

                        {/* Hero image */}
                        <View style={{
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 10 },
                            shadowOpacity: 0.25,
                            shadowRadius: 20,
                            elevation: 14,
                            borderRadius: 24,
                            overflow: 'hidden',
                            flexShrink: 0,
                        }}>
                            <Image
                                source={heroImage}
                                style={{ width: imgW, height: imgH, borderRadius: 24 }}
                                resizeMode="cover"
                            />
                        </View>
                    </Animated.View>
                </View>

                {/* ── FEATURES ─────────────────────────────────────────────── */}
                <View style={{ paddingHorizontal: 20, paddingTop: 28, paddingBottom: 12 }}>
                    <Text className="text-black font-black text-xl text-center mb-1">Why East Africa Online?</Text>
                    <Text className="text-black/50 font-bold text-sm text-center mb-5">Built for our community</Text>

                    <View style={{ flexDirection: isWide ? 'row' : 'column', gap: 10 }}>
                        {features.map((f, i) => (
                            <View
                                key={i}
                                style={{
                                    flex: isWide ? 1 : undefined,
                                    backgroundColor: '#F8F9FA',
                                    borderRadius: 20,
                                    padding: 16,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 12,
                                }}
                            >
                                <View style={{ backgroundColor: 'rgba(0,160,130,0.1)', padding: 10, borderRadius: 14 }}>
                                    <f.icon size={22} color="#00A082" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text className="text-black font-black" style={{ fontSize: 14 }}>{f.title}</Text>
                                    <Text className="text-black/50 font-bold" style={{ fontSize: 12, marginTop: 2 }}>{f.desc}</Text>
                                </View>
                            </View>
                        ))}
                    </View>

                    {/* Country chips */}
                    <View style={{ marginTop: 24, alignItems: 'center' }}>
                        <Text style={{ color: '#9ca3af', fontWeight: '800', fontSize: 11, letterSpacing: 1.5, marginBottom: 10 }}>SERVING</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
                            {[
                                { flag: '🇸🇸', name: 'South Sudan' },
                                { flag: '🇰🇪', name: 'Kenya' },
                                { flag: '🇺🇬', name: 'Uganda' },
                                { flag: '🇪🇹', name: 'Ethiopia' },
                                { flag: '🇷🇼', name: 'Rwanda' },
                            ].map((c) => (
                                <View
                                    key={c.name}
                                    style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, flexDirection: 'row', alignItems: 'center' }}
                                >
                                    <Text style={{ fontSize: 15, marginRight: 5 }}>{c.flag}</Text>
                                    <Text style={{ color: '#1a1a1a', fontWeight: '700', fontSize: 12 }}>{c.name}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                </View>

                {/* Footer */}
                <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                    <Text style={{ color: '#9ca3af', fontWeight: '600', fontSize: 12 }}>
                        © 2026 East Africa Online · eastafricaonline.com
                    </Text>
                </View>
            </ScrollView>

            {/* ── AUTH MODAL (proper Modal so it always shows fully) ────── */}
            <Modal
                visible={showAuth}
                transparent
                animationType="slide"
                onRequestClose={closeAuth}
                statusBarTranslucent
            >
                <TouchableWithoutFeedback onPress={closeAuth}>
                    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}>
                        <TouchableWithoutFeedback onPress={() => {}}>
                            <KeyboardAvoidingView
                                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                            >
                                <View style={{
                                    backgroundColor: '#fff',
                                    borderTopLeftRadius: 32,
                                    borderTopRightRadius: 32,
                                    paddingHorizontal: 24,
                                    paddingTop: 12,
                                    paddingBottom: Math.max(insets.bottom + 16, 28),
                                }}>
                                    {/* Drag handle */}
                                    <View style={{ width: 40, height: 4, backgroundColor: '#e5e7eb', borderRadius: 2, alignSelf: 'center', marginBottom: 20 }} />

                                    {/* Header */}
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                        <Text style={{ fontSize: 24, fontWeight: '900', color: '#1a1a1a' }}>
                                            {isLogin ? 'Welcome back' : 'Create account'}
                                        </Text>
                                        <TouchableOpacity
                                            onPress={closeAuth}
                                            style={{ width: 36, height: 36, backgroundColor: '#f3f4f6', borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}
                                        >
                                            <X size={18} color="#1a1a1a" />
                                        </TouchableOpacity>
                                    </View>

                                    <Text style={{ color: '#64748b', fontWeight: '600', fontSize: 14, marginBottom: 22 }}>
                                        {isLogin ? 'Sign in to continue shopping' : 'Join East Africa Online today'}
                                    </Text>

                                    {/* Email */}
                                    <View style={{ backgroundColor: '#F8F9FA', borderRadius: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                                        <Mail size={18} color="#9ca3af" />
                                        <TextInput
                                            placeholder="Email address"
                                            value={email}
                                            onChangeText={setEmail}
                                            autoCapitalize="none"
                                            keyboardType="email-address"
                                            placeholderTextColor="#9ca3af"
                                            style={{ flex: 1, color: '#111827', marginLeft: 12, paddingVertical: 16, fontSize: 15, outlineWidth: 0 } as any}
                                        />
                                    </View>

                                    {/* Password */}
                                    <View style={{ backgroundColor: '#F8F9FA', borderRadius: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', marginBottom: authError ? 12 : 0 }}>
                                        <Lock size={18} color="#9ca3af" />
                                        <TextInput
                                            placeholder="Password"
                                            value={password}
                                            onChangeText={setPassword}
                                            secureTextEntry
                                            placeholderTextColor="#9ca3af"
                                            style={{ flex: 1, color: '#111827', marginLeft: 12, paddingVertical: 16, fontSize: 15, outlineWidth: 0 } as any}
                                        />
                                    </View>

                                    {/* Error */}
                                    {authError ? (
                                        <View style={{ backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 12, padding: 12, marginBottom: 4 }}>
                                            <Text style={{ color: '#B91C1C', fontWeight: '600', fontSize: 13, textAlign: 'center' }}>{authError}</Text>
                                        </View>
                                    ) : null}

                                    {/* Submit */}
                                    <TouchableOpacity
                                        onPress={isLogin ? signInWithEmail : signUpWithEmail}
                                        disabled={loading}
                                        activeOpacity={0.85}
                                        style={{
                                            backgroundColor: '#00A082',
                                            borderRadius: 16,
                                            paddingVertical: 17,
                                            alignItems: 'center',
                                            marginTop: 18,
                                            elevation: 4,
                                        }}
                                    >
                                        {loading
                                            ? <ActivityIndicator color="#fff" />
                                            : <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>
                                                {isLogin ? 'Sign In' : 'Create Account'}
                                              </Text>
                                        }
                                    </TouchableOpacity>

                                    {/* Toggle */}
                                    <TouchableOpacity
                                        onPress={() => { setIsLogin(!isLogin); setAuthError(''); }}
                                        style={{ marginTop: 16, alignItems: 'center' }}
                                    >
                                        <Text style={{ color: '#6b7280', fontWeight: '600', fontSize: 14 }}>
                                            {isLogin ? "Don't have an account? " : 'Already have an account? '}
                                            <Text style={{ color: '#00A082', fontWeight: '800' }}>
                                                {isLogin ? 'Sign Up' : 'Sign In'}
                                            </Text>
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </KeyboardAvoidingView>
                        </TouchableWithoutFeedback>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>
        </>
    );
}
