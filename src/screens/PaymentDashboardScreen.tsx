import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { paymentsApi, walletApi } from '../lib/api';
import {
  ChevronLeft, CreditCard, Wallet, Package,
  CheckCircle, Clock, XCircle, Truck, TrendingUp
} from 'lucide-react-native';

export default function PaymentDashboardScreen() {
  const navigation = useNavigation<any>();
  const [payments, setPayments] = useState<any[]>([]);
  const [wallet, setWallet] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string>('all');

  const fetchData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [paymentData, walletData] = await Promise.all([
        paymentsApi.getUserPayments(user.id),
        walletApi.getWallet(user.id)
      ]);

      setPayments(paymentData);
      setWallet(walletData);
    } catch (error: any) {
      console.error('Error fetching payment data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const filteredPayments = payments.filter(p => {
    if (filter === 'all') return true;
    if (filter === 'paid') return p.status === 'paid';
    if (filter === 'pending') return p.status === 'pending' || p.status === 'initiated';
    if (filter === 'failed') return p.status === 'failed';
    return true;
  });

  const stats = {
    total: payments.length,
    paid: payments.filter(p => p.status === 'paid').length,
    pending: payments.filter(p => p.status === 'pending' || p.status === 'initiated').length,
    totalAmount: payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + parseFloat(p.amount), 0),
    awaiting: payments.filter(p => p.status === 'paid' && p.orders && p.orders.status !== 'delivered').length,
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid': return <CheckCircle color="#16a34a" size={20} />;
      case 'pending':
      case 'initiated': return <Clock color="#f59e0b" size={20} />;
      case 'failed': return <XCircle color="#dc2626" size={20} />;
      default: return <CreditCard color="#64748b" size={20} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return { bg: '#dcfce7', text: '#16a34a' };
      case 'pending':
      case 'initiated': return { bg: '#fef3c7', text: '#f59e0b' };
      case 'failed': return { bg: '#fee2e2', text: '#dc2626' };
      default: return { bg: '#f1f5f9', text: '#64748b' };
    }
  };

  const getOrderStatus = (payment: any) => {
    if (!payment.orders) return null;
    const status = payment.orders.status;
    switch (status) {
      case 'confirmed': return { label: 'Processing', color: '#2563eb', icon: <Package color="#2563eb" size={14} /> };
      case 'shipped': return { label: 'Shipped', color: '#7c3aed', icon: <Truck color="#7c3aed" size={14} /> };
      case 'delivered': return { label: 'Delivered', color: '#16a34a', icon: <CheckCircle color="#16a34a" size={14} /> };
      default: return { label: status, color: '#64748b', icon: <Clock color="#64748b" size={14} /> };
    }
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-gray-50">
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-blue-600 pt-12 pb-6 px-6">
        <View className="flex-row items-center mb-4">
          <TouchableOpacity onPress={() => navigation.goBack()} className="mr-4">
            <ChevronLeft color="white" size={28} />
          </TouchableOpacity>
          <View className="flex-row items-center">
            <CreditCard color="white" size={24} />
            <Text className="text-white text-xl font-bold ml-2">Payments</Text>
          </View>
        </View>

        <View className="flex-row space-x-3">
          <View className="flex-1 bg-white/20 rounded-2xl p-4">
            <Text className="text-blue-100 text-xs">Total Paid</Text>
            <Text className="text-white text-xl font-black">
              KES {stats.totalAmount.toLocaleString('en-KE', { minimumFractionDigits: 0 })}
            </Text>
          </View>
          <View className="flex-1 bg-white/20 rounded-2xl p-4">
            <Text className="text-blue-100 text-xs">Wallet</Text>
            <Text className="text-white text-xl font-black">
              KES {parseFloat(wallet?.balance || 0).toLocaleString('en-KE', { minimumFractionDigits: 0 })}
            </Text>
          </View>
        </View>

        <View className="flex-row mt-3 space-x-2">
          <View className="bg-white/20 rounded-xl px-3 py-2 items-center">
            <Text className="text-white text-lg font-bold">{stats.paid}</Text>
            <Text className="text-blue-100 text-xs">Paid</Text>
          </View>
          <View className="bg-white/20 rounded-xl px-3 py-2 items-center">
            <Text className="text-white text-lg font-bold">{stats.pending}</Text>
            <Text className="text-blue-100 text-xs">Pending</Text>
          </View>
          <View className="bg-white/20 rounded-xl px-3 py-2 items-center">
            <Text className="text-white text-lg font-bold">{stats.awaiting}</Text>
            <Text className="text-blue-100 text-xs">Awaiting</Text>
          </View>
        </View>
      </View>

      <View className="px-6 py-3 flex-row space-x-2">
        {['all', 'paid', 'pending', 'failed'].map((f) => (
          <TouchableOpacity
            key={f}
            onPress={() => setFilter(f)}
            className={`px-4 py-2 rounded-full ${filter === f ? 'bg-blue-600' : 'bg-white border border-gray-200'}`}
          >
            <Text className={`text-sm font-medium ${filter === f ? 'text-white' : 'text-gray-600'}`}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        className="flex-1 px-6"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {filteredPayments.length === 0 ? (
          <View className="bg-white rounded-2xl p-8 items-center border border-gray-100 mt-4">
            <CreditCard color="#94a3b8" size={40} />
            <Text className="text-gray-400 mt-3 text-center">No payments found</Text>
          </View>
        ) : (
          filteredPayments.map((payment) => {
            const statusColor = getStatusColor(payment.status);
            const orderStatus = getOrderStatus(payment);

            return (
              <View key={payment.id} className="bg-white rounded-2xl p-4 mb-3 border border-gray-100">
                <View className="flex-row items-start">
                  <View className="mr-3 mt-1">{getStatusIcon(payment.status)}</View>
                  <View className="flex-1">
                    <View className="flex-row items-center justify-between">
                      <Text className="text-gray-900 font-bold">
                        {payment.order_id ? `Order #${payment.order_id}` : 'Wallet Deposit'}
                      </Text>
                      <Text className="text-gray-900 font-black">
                        KES {parseFloat(payment.amount).toLocaleString()}
                      </Text>
                    </View>

                    <View className="flex-row items-center mt-2 space-x-2">
                      <View style={{ backgroundColor: statusColor.bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 }}>
                        <Text style={{ color: statusColor.text, fontSize: 11, fontWeight: '600' }}>
                          {payment.status.toUpperCase()}
                        </Text>
                      </View>

                      <View style={{ backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 }}>
                        <Text style={{ color: '#64748b', fontSize: 11, fontWeight: '600' }}>
                          {payment.method === 'mpesa' ? 'M-PESA' : 'WALLET'}
                        </Text>
                      </View>

                      {orderStatus && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: `${orderStatus.color}15`, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 }}>
                          {orderStatus.icon}
                          <Text style={{ color: orderStatus.color, fontSize: 11, fontWeight: '600', marginLeft: 4 }}>
                            {orderStatus.label}
                          </Text>
                        </View>
                      )}
                    </View>

                    <View className="flex-row items-center justify-between mt-2">
                      <Text className="text-gray-400 text-xs">
                        {new Date(payment.created_at).toLocaleDateString('en-KE', {
                          day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}
                      </Text>
                      {payment.mpesa_receipt && (
                        <Text className="text-gray-400 text-xs">Ref: {payment.mpesa_receipt}</Text>
                      )}
                    </View>

                    {payment.discount_applied > 0 && (
                      <View className="bg-purple-50 rounded-xl px-3 py-1 mt-2 flex-row items-center">
                        <TrendingUp color="#9333ea" size={12} />
                        <Text className="text-purple-700 text-xs font-medium ml-1">
                          Saved KES {parseFloat(payment.discount_applied).toLocaleString()} with wallet
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            );
          })
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}
