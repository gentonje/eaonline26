import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, RefreshControl, Modal
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { walletApi, mpesaApi, calculateWalletDiscount, WALLET_DISCOUNT_PERCENT } from '../lib/api';
import {
  Wallet, ArrowDownCircle, ArrowUpCircle, ChevronLeft,
  Phone, DollarSign, Shield, TrendingUp, Gift, Clock, CheckCircle, XCircle, RefreshCw
} from 'lucide-react-native';
import { useFeedback } from '../contexts/FeedbackContext';

export default function WalletScreen() {
  const navigation = useNavigation<any>();
  const { showToast } = useFeedback();
  const [wallet, setWallet] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [depositModalVisible, setDepositModalVisible] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [depositing, setDepositing] = useState(false);
  const [pendingPaymentId, setPendingPaymentId] = useState<number | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [walletData, txData] = await Promise.all([
        walletApi.getWallet(user.id),
        walletApi.getTransactions(user.id)
      ]);

      setWallet(walletData);
      setTransactions(txData);
    } catch (error: any) {
      console.error('Error fetching wallet:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const handleDeposit = async () => {
    const amount = parseFloat(depositAmount);
    if (!amount || amount < 10) {
      Alert.alert('Invalid Amount', 'Minimum deposit is KES 10');
      return;
    }
    if (!phoneNumber || phoneNumber.length < 9) {
      Alert.alert('Invalid Phone', 'Please enter a valid M-Pesa phone number');
      return;
    }

    setDepositing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const result = await mpesaApi.initiateSTKPush({
        phone: phoneNumber,
        amount,
        userId: user.id,
        type: 'deposit'
      });

      setPendingPaymentId(result.paymentId);
      setDepositModalVisible(false);

      if (result.simulated) {
        Alert.alert(
          'Demo Mode',
          'M-Pesa credentials not configured. Tap "Confirm Payment" to simulate a successful deposit.',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => setPendingPaymentId(null) },
            {
              text: 'Confirm Payment',
              onPress: async () => {
                try {
                  await mpesaApi.simulateCallback(result.paymentId, true);
                  showToast(`KES ${amount} deposited to wallet!`, 'success');
                  setPendingPaymentId(null);
                  fetchData();
                } catch (e: any) {
                  showToast(e.message, 'error');
                }
              }
            }
          ]
        );
      } else {
        showToast('Check your phone for M-Pesa prompt', 'info');
        pollPaymentStatus(result.paymentId);
      }
    } catch (error: any) {
      showToast(error.message || 'Deposit failed', 'error');
    } finally {
      setDepositing(false);
      setDepositAmount('');
    }
  };

  const pollPaymentStatus = async (paymentId: number) => {
    setCheckingStatus(true);
    let attempts = 0;
    const maxAttempts = 30;

    const interval = setInterval(async () => {
      attempts++;
      try {
        const status = await mpesaApi.checkPaymentStatus(paymentId);
        if (status.status === 'paid') {
          clearInterval(interval);
          setCheckingStatus(false);
          setPendingPaymentId(null);
          showToast('Deposit successful!', 'success');
          fetchData();
        } else if (status.status === 'failed') {
          clearInterval(interval);
          setCheckingStatus(false);
          setPendingPaymentId(null);
          showToast('Payment failed. Please try again.', 'error');
        } else if (attempts >= maxAttempts) {
          clearInterval(interval);
          setCheckingStatus(false);
          showToast('Payment timeout. Check your M-Pesa messages.', 'info');
        }
      } catch (e) {
        if (attempts >= maxAttempts) {
          clearInterval(interval);
          setCheckingStatus(false);
        }
      }
    }, 3000);
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'deposit': return <ArrowDownCircle color="#16a34a" size={24} />;
      case 'debit': return <ArrowUpCircle color="#dc2626" size={24} />;
      case 'refund': return <RefreshCw color="#2563eb" size={24} />;
      case 'discount': return <Gift color="#9333ea" size={24} />;
      default: return <DollarSign color="#64748b" size={24} />;
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      posted: '#16a34a', pending: '#f59e0b', failed: '#dc2626', reversed: '#6b7280'
    };
    return (
      <View style={{ backgroundColor: `${colors[status] || '#6b7280'}20`, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 }}>
        <Text style={{ color: colors[status] || '#6b7280', fontSize: 11, fontWeight: '600' }}>
          {status.toUpperCase()}
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-gray-50">
        <ActivityIndicator size="large" color="#16a34a" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-green-600 pt-12 pb-8 px-6 rounded-b-3xl">
        <View className="flex-row items-center mb-6">
          <TouchableOpacity onPress={() => navigation.goBack()} className="mr-4">
            <ChevronLeft color="white" size={28} />
          </TouchableOpacity>
          <View className="flex-row items-center">
            <Wallet color="white" size={24} />
            <Text className="text-white text-xl font-bold ml-2">My Wallet</Text>
          </View>
        </View>

        <View className="bg-white/20 rounded-3xl p-6">
          <Text className="text-green-100 text-sm mb-1">Available Balance</Text>
          <Text className="text-white text-4xl font-black">
            KES {parseFloat(wallet?.balance || 0).toLocaleString('en-KE', { minimumFractionDigits: 2 })}
          </Text>
          <View className="flex-row mt-4 space-x-3">
            <TouchableOpacity
              onPress={() => setDepositModalVisible(true)}
              className="flex-1 bg-white rounded-2xl py-3 flex-row items-center justify-center"
            >
              <ArrowDownCircle color="#16a34a" size={20} />
              <Text className="text-green-700 font-bold ml-2">Deposit</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View className="px-6 py-4">
        <View className="flex-row space-x-3">
          <View className="flex-1 bg-white rounded-2xl p-4 border border-gray-100">
            <View className="flex-row items-center mb-2">
              <Gift color="#9333ea" size={18} />
              <Text className="text-purple-700 font-bold ml-2 text-sm">{WALLET_DISCOUNT_PERCENT}% OFF</Text>
            </View>
            <Text className="text-gray-500 text-xs">Discount when paying from wallet</Text>
          </View>
          <View className="flex-1 bg-white rounded-2xl p-4 border border-gray-100">
            <View className="flex-row items-center mb-2">
              <Shield color="#2563eb" size={18} />
              <Text className="text-blue-700 font-bold ml-2 text-sm">Price Lock</Text>
            </View>
            <Text className="text-gray-500 text-xs">Protected from price increases</Text>
          </View>
        </View>
      </View>

      {checkingStatus && (
        <View className="mx-6 mb-3 bg-yellow-50 border border-yellow-200 rounded-2xl p-4 flex-row items-center">
          <ActivityIndicator size="small" color="#f59e0b" />
          <Text className="text-yellow-800 ml-3 font-medium">Waiting for M-Pesa confirmation...</Text>
        </View>
      )}

      <ScrollView
        className="flex-1 px-6"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text className="text-lg font-bold text-gray-900 mb-3">Transaction History</Text>

        {transactions.length === 0 ? (
          <View className="bg-white rounded-2xl p-8 items-center border border-gray-100">
            <Clock color="#94a3b8" size={40} />
            <Text className="text-gray-400 mt-3 text-center">No transactions yet</Text>
            <Text className="text-gray-300 text-sm text-center mt-1">Deposit money to get started</Text>
          </View>
        ) : (
          transactions.map((tx) => (
            <View key={tx.id} className="bg-white rounded-2xl p-4 mb-3 border border-gray-100 flex-row items-center">
              <View className="mr-3">{getTransactionIcon(tx.type)}</View>
              <View className="flex-1">
                <Text className="text-gray-900 font-semibold text-sm">{tx.description || tx.type}</Text>
                <Text className="text-gray-400 text-xs mt-1">
                  {new Date(tx.created_at).toLocaleDateString('en-KE', {
                    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                  })}
                </Text>
              </View>
              <View className="items-end">
                <Text className={`font-bold ${tx.type === 'deposit' || tx.type === 'refund' ? 'text-green-600' : 'text-red-600'}`}>
                  {tx.type === 'deposit' || tx.type === 'refund' ? '+' : '-'}KES {parseFloat(tx.amount).toLocaleString()}
                </Text>
                {getStatusBadge(tx.status)}
              </View>
            </View>
          ))
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal visible={depositModalVisible} animationType="slide" transparent>
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white rounded-t-3xl p-6">
            <View className="flex-row items-center justify-between mb-6">
              <Text className="text-xl font-bold text-gray-900">Deposit via M-Pesa</Text>
              <TouchableOpacity onPress={() => setDepositModalVisible(false)}>
                <XCircle color="#94a3b8" size={28} />
              </TouchableOpacity>
            </View>

            <View className="mb-4">
              <Text className="text-gray-600 mb-2 font-medium">M-Pesa Phone Number</Text>
              <View className="flex-row items-center bg-gray-50 rounded-2xl p-4 border border-gray-200">
                <Phone size={20} color="#16a34a" />
                <TextInput
                  className="flex-1 ml-3 text-base text-gray-900"
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  placeholder="0712345678"
                  keyboardType="phone-pad"
                />
              </View>
            </View>

            <View className="mb-6">
              <Text className="text-gray-600 mb-2 font-medium">Amount (KES)</Text>
              <View className="flex-row items-center bg-gray-50 rounded-2xl p-4 border border-gray-200">
                <DollarSign size={20} color="#16a34a" />
                <TextInput
                  className="flex-1 ml-3 text-base text-gray-900"
                  value={depositAmount}
                  onChangeText={setDepositAmount}
                  placeholder="1000"
                  keyboardType="numeric"
                />
              </View>
              <Text className="text-gray-400 text-xs mt-2">Minimum deposit: KES 10</Text>
            </View>

            <View className="flex-row flex-wrap mb-4 gap-2">
              {[100, 500, 1000, 5000].map((amt) => (
                <TouchableOpacity
                  key={amt}
                  onPress={() => setDepositAmount(String(amt))}
                  className="bg-green-50 border border-green-200 rounded-xl px-4 py-2"
                >
                  <Text className="text-green-700 font-bold">KES {amt.toLocaleString()}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              onPress={handleDeposit}
              disabled={depositing}
              className="bg-green-600 rounded-2xl py-4 flex-row items-center justify-center"
            >
              {depositing ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <ArrowDownCircle color="white" size={22} />
                  <Text className="text-white font-bold text-lg ml-2">Deposit via M-Pesa</Text>
                </>
              )}
            </TouchableOpacity>

            <View className="flex-row items-center justify-center mt-4">
              <Shield color="#16a34a" size={14} />
              <Text className="text-gray-400 text-xs ml-1">Secured by Safaricom M-Pesa</Text>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
