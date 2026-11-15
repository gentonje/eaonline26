import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Pressable, TextInput,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Modal
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { useShopping } from '../hooks/useShopping';
import { mpesaApi, walletApi, calculateWalletDiscount, WALLET_DISCOUNT_PERCENT } from '../lib/api';
import {
  MapPin, Phone, User as UserIcon, CreditCard, ChevronLeft,
  Wallet, Shield, Gift, CheckCircle, Clock, ArrowRight
} from 'lucide-react-native';
import { useFeedback } from '../contexts/FeedbackContext';
import ScreenHeader from '../components/ScreenHeader';

type PaymentMethod = 'mpesa' | 'wallet' | null;

export default function CheckoutScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { total } = route.params as { total: number };
  const { placeOrder } = useShopping();
  const { showToast } = useFeedback();

  const [loading, setLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [formData, setFormData] = useState({
    full_name: '',
    address: '',
    phone: '',
  });
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(null);
  const [mpesaPhone, setMpesaPhone] = useState('');
  const [walletBalance, setWalletBalance] = useState(0);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [paymentStep, setPaymentStep] = useState<'shipping' | 'payment' | 'processing'>('shipping');

  const walletDiscount = calculateWalletDiscount(total);
  const walletTotal = total - walletDiscount;
  const hasEnoughBalance = walletBalance >= walletTotal;

  useEffect(() => {
    fetchProfile();
    fetchWallet();
  }, []);

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('profiles')
        .select('full_name, address, phone_number')
        .eq('id', user.id)
        .maybeSingle();

      if (data) {
        setFormData({
          full_name: data.full_name || '',
          address: data.address || '',
          phone: data.phone_number || '',
        });
        setMpesaPhone(data.phone_number || '');
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setProfileLoading(false);
    }
  };

  const fetchWallet = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const wallet = await walletApi.getWallet(user.id);
      setWalletBalance(parseFloat(wallet.balance || 0));
    } catch (error) {
      console.error('Error fetching wallet:', error);
    }
  };

  const handleContinueToPayment = () => {
    if (!formData.full_name || !formData.address || !formData.phone) {
      Alert.alert('Missing Information', 'Please fill in all shipping details.');
      return;
    }
    setPaymentStep('payment');
  };

  const handlePayWithMpesa = async () => {
    if (!mpesaPhone || mpesaPhone.length < 9) {
      Alert.alert('Invalid Phone', 'Please enter a valid M-Pesa phone number');
      return;
    }

    setProcessingPayment(true);
    setPaymentStep('processing');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const order = await placeOrder({
        ...formData,
        total_amount: total,
      });

      if (!order) throw new Error('Failed to create order');

      await supabase.from('orders').update({
        payment_method: 'mpesa',
        payment_status: 'pending'
      }).eq('id', order.id);

      const result = await mpesaApi.initiateSTKPush({
        phone: mpesaPhone,
        amount: total,
        userId: user.id,
        orderId: order.id,
        type: 'payment'
      });

      if (result.simulated) {
        Alert.alert(
          'Demo Mode',
          'M-Pesa credentials not configured. Tap "Confirm" to simulate payment.',
          [
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => {
                setProcessingPayment(false);
                setPaymentStep('payment');
              }
            },
            {
              text: 'Confirm Payment',
              onPress: async () => {
                try {
                  await mpesaApi.simulateCallback(result.paymentId, true);
                  showToast('Payment successful!', 'success');
                  navigation.navigate('OrderSuccess', { orderId: order.id });
                } catch (e: any) {
                  showToast(e.message, 'error');
                  setProcessingPayment(false);
                  setPaymentStep('payment');
                }
              }
            }
          ]
        );
      } else {
        showToast('Check your phone for M-Pesa prompt', 'info');
        pollPaymentAndNavigate(result.paymentId, order.id);
      }
    } catch (error: any) {
      showToast(error.message || 'Payment failed', 'error');
      setProcessingPayment(false);
      setPaymentStep('payment');
    }
  };

  const handlePayWithWallet = async () => {
    if (!hasEnoughBalance) {
      Alert.alert('Insufficient Balance', `You need KES ${walletTotal.toLocaleString()} but have KES ${walletBalance.toLocaleString()}`);
      return;
    }

    setProcessingPayment(true);
    setPaymentStep('processing');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const order = await placeOrder({
        ...formData,
        total_amount: total,
      });

      if (!order) throw new Error('Failed to create order');

      const result = await walletApi.payWithWallet({
        userId: user.id,
        orderId: order.id,
        amount: total,
        discount: walletDiscount
      });

      showToast(`Paid KES ${walletTotal.toLocaleString()} from wallet. Saved KES ${walletDiscount.toLocaleString()}!`, 'success');
      navigation.navigate('OrderSuccess', { orderId: order.id });
    } catch (error: any) {
      showToast(error.message || 'Wallet payment failed', 'error');
      setProcessingPayment(false);
      setPaymentStep('payment');
    }
  };

  const pollPaymentAndNavigate = async (paymentId: number, orderId: number) => {
    let attempts = 0;
    const maxAttempts = 40;

    const interval = setInterval(async () => {
      attempts++;
      try {
        const status = await mpesaApi.checkPaymentStatus(paymentId);
        if (status.status === 'paid') {
          clearInterval(interval);
          showToast('Payment successful!', 'success');
          navigation.navigate('OrderSuccess', { orderId });
        } else if (status.status === 'failed') {
          clearInterval(interval);
          setProcessingPayment(false);
          setPaymentStep('payment');
          showToast('Payment failed. Please try again.', 'error');
        } else if (attempts >= maxAttempts) {
          clearInterval(interval);
          setProcessingPayment(false);
          setPaymentStep('payment');
          showToast('Payment timeout. Check your M-Pesa messages.', 'info');
        }
      } catch (e) {
        if (attempts >= maxAttempts) {
          clearInterval(interval);
          setProcessingPayment(false);
          setPaymentStep('payment');
        }
      }
    }, 3000);
  };

  if (profileLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-gray-50">
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  const handleBack = () => {
    if (paymentStep === 'payment') setPaymentStep('shipping');
    else navigation.goBack();
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-gray-50"
    >
      <ScreenHeader
        title={paymentStep === 'shipping' ? 'Shipping Details' : paymentStep === 'payment' ? 'Payment Method' : 'Processing...'}
        showBackButton={true}
        backIconType="chevron"
        onBack={handleBack}
      />
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 24 }}>
        <View className="flex-row mx-6 mt-4 mb-2">
          {['shipping', 'payment', 'processing'].map((step, idx) => (
            <View key={step} className="flex-1 flex-row items-center">
              <View style={{
                width: 32, height: 32, borderRadius: 16,
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: paymentStep === step ? '#00A082' :
                  ['shipping', 'payment', 'processing'].indexOf(paymentStep) > idx ? '#00A082' : '#e5e7eb'
              }}>
                {['shipping', 'payment', 'processing'].indexOf(paymentStep) > idx ? (
                  <CheckCircle color="white" size={16} />
                ) : (
                  <Text style={{ color: paymentStep === step || ['shipping', 'payment', 'processing'].indexOf(paymentStep) > idx ? 'white' : '#64748b', fontWeight: '700', fontSize: 14 }}>{idx + 1}</Text>
                )}
              </View>
              {idx < 2 && <View style={{
                flex: 1, height: 4, marginHorizontal: 4,
                backgroundColor: ['shipping', 'payment', 'processing'].indexOf(paymentStep) > idx ? '#00A082' : '#e5e7eb'
              }} />}
            </View>
          ))}
        </View>

        {paymentStep === 'shipping' && (
          <View className="p-6">
            <Text className="text-lg font-bold text-gray-900 mb-4">Shipping Information</Text>

            <View className="space-y-4">
              <View>
                <Text className="text-gray-600 mb-1 ml-1 text-sm font-medium">Full Name</Text>
                <View className="flex-row items-center bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                  <UserIcon size={20} color="#94a3b8" />
                  <TextInput
                    className="flex-1 ml-3 text-base text-gray-900"
                    value={formData.full_name}
                    onChangeText={(t) => setFormData(p => ({ ...p, full_name: t }))}
                    placeholder="John Doe"
                  />
                </View>
              </View>

              <View>
                <Text className="text-gray-600 mb-1 ml-1 text-sm font-medium">Phone Number</Text>
                <View className="flex-row items-center bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                  <Phone size={20} color="#94a3b8" />
                  <TextInput
                    className="flex-1 ml-3 text-base text-gray-900"
                    value={formData.phone}
                    onChangeText={(t) => setFormData(p => ({ ...p, phone: t }))}
                    placeholder="0712345678"
                    keyboardType="phone-pad"
                  />
                </View>
              </View>

              <View>
                <Text className="text-gray-600 mb-1 ml-1 text-sm font-medium">Shipping Address</Text>
                <View className="flex-row items-start bg-white p-4 rounded-2xl border border-gray-100 shadow-sm min-h-[100px]">
                  <MapPin size={20} color="#94a3b8" style={{ marginTop: 4 }} />
                  <TextInput
                    className="flex-1 ml-3 text-base text-gray-900"
                    value={formData.address}
                    onChangeText={(t) => setFormData(p => ({ ...p, address: t }))}
                    placeholder="123 Shopping Lane, Nairobi"
                    multiline
                    textAlignVertical="top"
                  />
                </View>
              </View>
            </View>

          </View>
        )}

        {paymentStep === 'payment' && (
          <View className="p-6">
            <View className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm mb-6">
              <Text className="text-lg font-bold text-gray-900 mb-3">Order Summary</Text>
              <View className="flex-row justify-between mb-2">
                <Text className="text-gray-500">Subtotal</Text>
                <Text className="text-gray-900 font-bold">KES {total.toLocaleString()}</Text>
              </View>
              <View className="flex-row justify-between mb-2">
                <Text className="text-gray-500">Shipping</Text>
                <Text className="text-green-600 font-bold">FREE</Text>
              </View>
              {paymentMethod === 'wallet' && walletDiscount > 0 && (
                <View className="flex-row justify-between mb-2">
                  <View className="flex-row items-center">
                    <Gift color="#9333ea" size={14} />
                    <Text className="text-purple-600 ml-1">Wallet Discount ({WALLET_DISCOUNT_PERCENT}%)</Text>
                  </View>
                  <Text className="text-purple-600 font-bold">-KES {walletDiscount.toLocaleString()}</Text>
                </View>
              )}
              <View className="h-[1px] bg-gray-100 my-3" />
              <View className="flex-row justify-between items-center">
                <Text className="text-xl font-bold text-gray-900">Total</Text>
                <Text className="text-2xl font-black text-orange-600">
                  KES {(paymentMethod === 'wallet' ? walletTotal : total).toLocaleString()}
                </Text>
              </View>
            </View>

            <Text className="text-lg font-bold text-gray-900 mb-4">Choose Payment Method</Text>

            <Pressable
              onPress={() => setPaymentMethod('mpesa')}
              style={({ pressed }) => ({
                backgroundColor: 'white',
                borderRadius: 16,
                padding: 20,
                borderWidth: 2,
                borderColor: paymentMethod === 'mpesa' ? '#00A082' : '#f1f5f9',
                marginBottom: 12,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <View className="flex-row items-center">
                <View style={{ backgroundColor: '#dcfce7', width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                  <Phone color="#16a34a" size={24} />
                </View>
                <View className="flex-1">
                  <Text className="text-gray-900 font-bold text-lg">M-Pesa</Text>
                  <Text className="text-gray-500 text-sm">Pay via STK Push to your phone</Text>
                </View>
                {paymentMethod === 'mpesa' && <CheckCircle color="#00A082" size={24} />}
              </View>
            </Pressable>

            <Pressable
              onPress={() => setPaymentMethod('wallet')}
              style={({ pressed }) => ({
                backgroundColor: 'white',
                borderRadius: 16,
                padding: 20,
                borderWidth: 2,
                borderColor: paymentMethod === 'wallet' ? '#00A082' : '#f1f5f9',
                marginBottom: 12,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <View className="flex-row items-center">
                <View className="bg-blue-100 w-12 h-12 rounded-full items-center justify-center mr-4">
                  <Wallet color="#2563eb" size={24} />
                </View>
                <View className="flex-1">
                  <Text className="text-gray-900 font-bold text-lg">Wallet</Text>
                  <Text className="text-gray-500 text-sm">
                    Balance: KES {walletBalance.toLocaleString()}
                  </Text>
                  {walletDiscount > 0 && (
                    <View className="flex-row items-center mt-1">
                      <Gift color="#9333ea" size={12} />
                      <Text className="text-purple-600 text-xs font-medium ml-1">
                        Save KES {walletDiscount.toLocaleString()} ({WALLET_DISCOUNT_PERCENT}% discount)
                      </Text>
                    </View>
                  )}
                  {!hasEnoughBalance && (
                    <Text className="text-red-500 text-xs mt-1">Insufficient balance</Text>
                  )}
                </View>
                {paymentMethod === 'wallet' && <CheckCircle color="#00A082" size={24} />}
              </View>
            </Pressable>

            {paymentMethod === 'mpesa' && (
              <View className="bg-white rounded-2xl p-5 border border-gray-100 mt-4">
                <Text className="text-gray-600 mb-2 font-medium">M-Pesa Phone Number</Text>
                <View className="flex-row items-center bg-gray-50 rounded-2xl p-4 border border-gray-200">
                  <Phone size={20} color="#16a34a" />
                  <TextInput
                    className="flex-1 ml-3 text-base text-gray-900"
                    value={mpesaPhone}
                    onChangeText={setMpesaPhone}
                    placeholder="0712345678"
                    keyboardType="phone-pad"
                  />
                </View>
                <View className="flex-row items-center mt-3">
                  <Shield color="#16a34a" size={14} />
                  <Text className="text-gray-400 text-xs ml-1">Secured by Safaricom Daraja</Text>
                </View>
              </View>
            )}

            {paymentMethod === 'wallet' && hasEnoughBalance && (
              <View className="bg-green-50 rounded-2xl p-4 border border-green-200 mt-4">
                <View className="flex-row items-center">
                  <Shield color="#16a34a" size={16} />
                  <Text className="text-green-800 font-medium ml-2">Price Lock Active</Text>
                </View>
                <Text className="text-green-700 text-sm mt-1">
                  Your price is locked at KES {walletTotal.toLocaleString()}. Protected from future price changes.
                </Text>
              </View>
            )}

          </View>
        )}

        {paymentStep === 'processing' && (
          <View className="p-6 items-center justify-center" style={{ minHeight: 400 }}>
            <ActivityIndicator size="large" color="#16a34a" />
            <Text className="text-gray-900 font-bold text-xl mt-6">Processing Payment</Text>
            <Text className="text-gray-500 text-center mt-2">
              {paymentMethod === 'mpesa'
                ? 'Please check your phone and enter your M-Pesa PIN to complete the payment.'
                : 'Processing your wallet payment...'}
            </Text>
            <View className="bg-yellow-50 rounded-2xl p-4 border border-yellow-200 mt-6 w-full">
              <View className="flex-row items-center">
                <Clock color="#f59e0b" size={20} />
                <Text className="text-yellow-800 font-medium ml-2">Waiting for confirmation...</Text>
              </View>
              <Text className="text-yellow-700 text-sm mt-2">
                Do not close this page. The payment will be confirmed automatically.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {paymentStep !== 'processing' && (
        <View
          style={{
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: Math.max(insets.bottom, 12) + 12,
            backgroundColor: 'white',
            borderTopWidth: 1,
            borderTopColor: '#e5e7eb',
            shadowColor: '#000',
            shadowOpacity: 0.06,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: -2 },
            elevation: 8,
          }}
        >
          {paymentStep === 'shipping' ? (
            <Pressable
              onPress={handleContinueToPayment}
              style={({ pressed }) => ({
                backgroundColor: '#00A082',
                paddingVertical: 16,
                borderRadius: 16,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text style={{ color: 'white', fontWeight: '800', fontSize: 17, marginRight: 8 }}>Continue to Payment</Text>
              <ArrowRight color="white" size={22} />
            </Pressable>
          ) : (
            <Pressable
              onPress={paymentMethod === 'mpesa' ? handlePayWithMpesa : handlePayWithWallet}
              disabled={!paymentMethod || (paymentMethod === 'wallet' && !hasEnoughBalance)}
              style={({ pressed }) => ({
                backgroundColor: !paymentMethod || (paymentMethod === 'wallet' && !hasEnoughBalance) ? '#cbd5e1' : '#00A082',
                paddingVertical: 16,
                borderRadius: 16,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.85 : 1,
              })}
            >
              {paymentMethod === 'mpesa' ? (
                <>
                  <Phone color="white" size={22} />
                  <Text style={{ color: 'white', fontWeight: '800', fontSize: 17, marginLeft: 8 }}>Pay KES {total.toLocaleString()} with M-Pesa</Text>
                </>
              ) : paymentMethod === 'wallet' ? (
                <>
                  <Wallet color="white" size={22} />
                  <Text style={{ color: 'white', fontWeight: '800', fontSize: 17, marginLeft: 8 }}>Pay KES {walletTotal.toLocaleString()} from Wallet</Text>
                </>
              ) : (
                <Text style={{ color: 'white', fontWeight: '800', fontSize: 17 }}>Select Payment Method</Text>
              )}
            </Pressable>
          )}
        </View>
      )}
    </KeyboardAvoidingView>
  );
}
