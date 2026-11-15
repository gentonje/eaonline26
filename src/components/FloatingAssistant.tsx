import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, ScrollView, Image,
  ActivityIndicator, Platform, KeyboardAvoidingView,
} from 'react-native';
import { MessageCircle, X, Send, Sparkles, Bell, BellOff } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { assistantApi, AssistantProduct } from '../lib/api';
import { useAssistant } from '../contexts/AssistantContext';
import { getProductMainImage } from '../lib/image-utils';

type Msg = {
  role: 'user' | 'assistant';
  content: string;
  products?: AssistantProduct[];
};

const QUICK_PROMPTS = [
  "What's trending today?",
  'Show me phones under 30,000',
  'Any cars in Kenya?',
  'New arrivals this week',
];

const GREETING: Msg = {
  role: 'assistant',
  content: "What are you shopping for?",
};

export default function FloatingAssistant() {
  const { enabled, subscribed, setSubscribed, markSeen } = useAssistant();
  const navigation = useNavigation<any>();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([GREETING]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }, []);

  useEffect(() => { if (open) scrollToEnd(); }, [messages, open, scrollToEnd]);

  const send = useCallback(async (text: string, selection?: { value: string; original: string; label: string }) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setInput('');
    const next: Msg[] = [...messages, { role: 'user', content: selection ? selection.label : trimmed }];
    setMessages(next);
    setSending(true);
    try {
      const apiHistory = next.map(m => ({ role: m.role, content: m.content }));
      const { reply, products } = await assistantApi.chat(apiHistory);
      setMessages(m => [...m, { role: 'assistant', content: reply, products }]);
    } catch (err: any) {
      setMessages(m => [
        ...m,
        {
          role: 'assistant',
          content:
            "Search unavailable. Try browsing.",
        },
      ]);
    } finally {
      setSending(false);
    }
  }, [messages, sending]);

  const handleOpen = useCallback(() => {
    setOpen(true);
    markSeen();
  }, [markSeen]);

  if (!enabled) return null;

  // Web uses position:fixed so the FAB stays anchored to the viewport.
  // Native uses absolute positioning relative to the root navigator.
  const fixedStyle: any =
    Platform.OS === 'web'
      ? { position: 'fixed', right: 20, bottom: 20, zIndex: 9999 }
      : { position: 'absolute', right: 16, bottom: 80, zIndex: 9999, elevation: 12 };

  if (!open) {
    return (
      <View style={fixedStyle} pointerEvents="box-none">
        <TouchableOpacity
          onPress={handleOpen}
          activeOpacity={0.85}
          accessibilityLabel="Open shopping assistant"
          style={{
            backgroundColor: '#00A082',
            width: 60, height: 60, borderRadius: 30,
            alignItems: 'center', justifyContent: 'center',
            shadowColor: '#000', shadowOpacity: 0.25,
            shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
          }}
        >
          <MessageCircle color="#fff" size={28} />
          <View style={{
            position: 'absolute', top: -2, right: -2,
            width: 18, height: 18, borderRadius: 9,
            backgroundColor: '#FDB913',
            alignItems: 'center', justifyContent: 'center',
            borderWidth: 2, borderColor: '#fff',
          }}>
            <Sparkles color="#000" size={10} />
          </View>
        </TouchableOpacity>
      </View>
    );
  }

  const panelStyle: any =
    Platform.OS === 'web'
      ? {
          position: 'fixed', right: 20, bottom: 20, zIndex: 9999,
          width: 380, maxWidth: 'calc(100vw - 24px)',
          height: 560, maxHeight: 'calc(100vh - 40px)',
        }
      : {
          position: 'absolute', right: 8, bottom: 80, left: 8, top: 40,
          zIndex: 9999, elevation: 12,
        };

  return (
    <View style={panelStyle} pointerEvents="box-none">
      <View
        style={{
          flex: 1,
          backgroundColor: '#fff',
          borderRadius: 18,
          overflow: 'hidden',
          shadowColor: '#000', shadowOpacity: 0.22,
          shadowRadius: 20, shadowOffset: { width: 0, height: 8 },
          borderWidth: 1, borderColor: '#e5e7eb',
        }}
      >
        {/* Header */}
        <View style={{ backgroundColor: '#00A082', paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles color="#FDB913" size={20} />
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>Asha</Text>
            <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11 }}>
              Shopping assistant • Online
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setSubscribed(!subscribed)}
            style={{ padding: 6, marginRight: 4 }}
            accessibilityLabel={subscribed ? 'Unsubscribe from new product alerts' : 'Subscribe to new product alerts'}
          >
            {subscribed
              ? <Bell color="#FDB913" size={20} />
              : <BellOff color="#fff" size={20} />}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setOpen(false)} style={{ padding: 6 }} accessibilityLabel="Close assistant">
            <X color="#fff" size={22} />
          </TouchableOpacity>
        </View>

        {subscribed && (
          <View style={{ backgroundColor: '#FFF8E1', paddingHorizontal: 12, paddingVertical: 6 }}>
            <Text style={{ fontSize: 11, color: '#7a5a00', fontWeight: '600' }}>
              You'll be notified about new products. Tap the bell to turn off.
            </Text>
          </View>
        )}

        {/* Messages */}
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            ref={scrollRef}
            style={{ flex: 1, backgroundColor: '#f8fafc' }}
            contentContainerStyle={{ padding: 12, paddingBottom: 16 }}
            onContentSizeChange={scrollToEnd}
          >
            {messages.map((m, i) => (
              <Bubble
                key={i}
                msg={m}
                onProductPress={(id) => {
                  setOpen(false);
                  navigation.navigate('ProductDetail', { productId: id });
                }}
              />
            ))}

            {sending && (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                <View style={{ backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: '#e5e7eb' }}>
                  <ActivityIndicator size="small" color="#00A082" />
                </View>
              </View>
            )}

            {messages.length === 1 && !sending && (
              <View style={{ marginTop: 8 }}>
                <Text style={{ fontSize: 11, color: '#64748b', fontWeight: '700', marginBottom: 6, marginLeft: 4 }}>
                  TRY ASKING
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {QUICK_PROMPTS.map((p) => (
                    <TouchableOpacity
                      key={p}
                      onPress={() => send(p)}
                      style={{
                        backgroundColor: '#fff', borderWidth: 1, borderColor: '#00A082',
                        borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6,
                        marginRight: 6, marginBottom: 6,
                      }}
                    >
                      <Text style={{ color: '#00A082', fontSize: 12, fontWeight: '700' }}>{p}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </ScrollView>

          <TouchableOpacity
            onPress={() => {
              setOpen(false);
              navigation.navigate('App', { screen: 'BrowseProducts' });
            }}
            style={{ paddingVertical: 9, alignItems: 'center', borderTopWidth: 1, borderTopColor: '#e5e7eb', backgroundColor: '#f8fafc' }}
            accessibilityLabel="Continue shopping manually"
          >
            <Text style={{ color: '#00866e', fontSize: 12, fontWeight: '800' }}>Browse manually</Text>
          </TouchableOpacity>

          {/* Input */}
          <View style={{ flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#e5e7eb', backgroundColor: '#fff', padding: 8 }}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Ask me to find something..."
              placeholderTextColor="#94a3b8"
              onSubmitEditing={() => send(input)}
              returnKeyType="send"
              editable={!sending}
              style={{
                flex: 1, paddingHorizontal: 12, paddingVertical: 10,
                backgroundColor: '#f1f5f9', borderRadius: 20,
                fontSize: 14, color: '#0f172a',
                ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
              }}
            />
            <TouchableOpacity
              onPress={() => send(input)}
              disabled={!input.trim() || sending}
              style={{
                marginLeft: 8, width: 40, height: 40, borderRadius: 20,
                backgroundColor: input.trim() && !sending ? '#00A082' : '#cbd5e1',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Send color="#fff" size={18} />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </View>
  );
}

function Bubble({ msg, onProductPress, onSuggestion }: { msg: Msg; onProductPress: (id: string) => void; onSuggestion: (value: string, label: string) => void }) {
  const isUser = msg.role === 'user';
  return (
    <View style={{ alignItems: isUser ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
      <View
        style={{
          maxWidth: '88%',
          backgroundColor: isUser ? '#00A082' : '#fff',
          borderRadius: 14,
          borderTopRightRadius: isUser ? 4 : 14,
          borderTopLeftRadius: isUser ? 14 : 4,
          paddingHorizontal: 12, paddingVertical: 9,
          borderWidth: isUser ? 0 : 1,
          borderColor: '#e5e7eb',
        }}
      >
        <Text style={{ color: isUser ? '#fff' : '#0f172a', fontSize: 14, lineHeight: 19 }}>
          {msg.content}
        </Text>
      </View>

      {!isUser && msg.summary && (
        <View style={{ alignSelf: 'flex-start', maxWidth: '94%', marginTop: 7, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#eef8f5', borderRadius: 12, borderWidth: 1, borderColor: '#cce9df' }}>
          <Text style={{ color: '#527267', fontSize: 10, fontWeight: '800', marginBottom: 3 }}>LOOKING FOR</Text>
          <Text style={{ color: '#174f42', fontSize: 12, fontWeight: '700', lineHeight: 17 }}>{msg.summary}</Text>
        </View>
      )}

      {!isUser && msg.suggestions && msg.suggestions.length > 0 && (
        <View style={{ alignSelf: 'flex-start', maxWidth: '96%', marginTop: 8 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {msg.suggestions.map((item, index) => (
              <TouchableOpacity
                key={item.value}
                onPress={() => onSuggestion(item.value, item.label)}
                activeOpacity={0.75}
                style={{
                  minWidth: '43%', marginRight: 6, marginBottom: 6,
                  paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12,
                  backgroundColor: index === 0 ? '#e8f5f1' : '#fff',
                  borderWidth: 1, borderColor: index === 0 ? '#8bcbb8' : '#e2e8f0',
                }}
              >
                <Text style={{ color: '#174f42', fontSize: 13, fontWeight: '800' }}>{item.label}</Text>
                <Text numberOfLines={1} style={{ color: '#64748b', fontSize: 10, marginTop: 2 }}>{item.description}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={{ color: '#64748b', fontSize: 11, marginLeft: 2 }}>Or tell me what you meant.</Text>
        </View>
      )}

      {!isUser && msg.products && msg.products.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: 8, alignSelf: 'stretch' }}
          contentContainerStyle={{ paddingRight: 8 }}
        >
          {msg.products.map((p) => (
            <MiniProductCard key={p.id} product={p} onPress={() => onProductPress(p.id)} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function MiniProductCard({ product, onPress }: { product: AssistantProduct; onPress: () => void }) {
  const img = getProductMainImage(product);
  const currency = product.countries?.currency || 'KES';
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        width: 140,
        marginRight: 8,
        backgroundColor: '#fff',
        borderRadius: 12,
        borderWidth: 1, borderColor: '#e5e7eb',
        overflow: 'hidden',
      }}
    >
      <Image
        source={{ uri: img }}
        style={{ width: '100%', height: 100, backgroundColor: '#f1f5f9' }}
        resizeMode="cover"
      />
      <View style={{ padding: 8 }}>
        <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: '700', color: '#0f172a' }}>
          {product.title}
        </Text>
        <Text style={{ fontSize: 13, fontWeight: '900', color: '#00A082', marginTop: 2 }}>
          {currency} {Number(product.price || 0).toLocaleString()}
        </Text>
        {product.county ? (
          <Text numberOfLines={1} style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>
            {product.county}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}
