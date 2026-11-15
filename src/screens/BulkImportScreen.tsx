import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Pressable, ActivityIndicator, Alert, TextInput,
  Image, ScrollView, Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Sparkles, Upload, X, RefreshCw, Camera, ChevronDown, Check } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { aiApi } from '../lib/api';
import ScreenHeader from '../components/ScreenHeader';
import WebScrollView from '../components/WebScrollView';
import { CATEGORIES } from '../lib/categories';

interface Country { id: number; name: string; code: string; currency: string; }
interface District { id: number; name: string; country_id: number; }

type DraftStatus = 'queued' | 'analyzing' | 'ready' | 'error' | 'uploading' | 'uploaded' | 'failed';

interface Draft {
  id: string;
  uri: string;
  base64: string;
  mimeType: string;
  status: DraftStatus;
  error?: string;
  title: string;
  description: string;
  category: string;
  price: string;
  quantity: string;
  confidence: number;
}

async function uriToBase64(uri: string): Promise<{ base64: string; mimeType: string }> {
  if (uri.startsWith('data:')) {
    const [header, b64] = uri.split(',');
    const mime = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
    return { base64: b64, mimeType: mime };
  }
  const res = await fetch(uri);
  const blob = await res.blob();
  const reader = new FileReader();
  return new Promise((resolve, reject) => {
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const [header, b64] = dataUrl.split(',');
      const mime = header.match(/:(.*?);/)?.[1] || blob.type || 'image/jpeg';
      resolve({ base64: b64, mimeType: mime });
    };
    reader.onerror = () => reject(new Error('Failed to read image'));
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

export default function BulkImportScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [filteredDistricts, setFilteredDistricts] = useState<District[]>([]);
  const [countryId, setCountryId] = useState<string>('');
  const [districtId, setDistrictId] = useState<string>('');
  const [bulkUploading, setBulkUploading] = useState(false);
  const [showCategoryPickerFor, setShowCategoryPickerFor] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: c } = await supabase.from('countries').select('*').order('name');
      const { data: d } = await supabase.from('districts').select('*').order('name');
      setCountries(c || []);
      setDistricts(d || []);
      const ke = (c || []).find((x: Country) => x.code === 'KE');
      if (ke) setCountryId(ke.id.toString());
    })();
  }, []);

  useEffect(() => {
    if (!countryId) { setFilteredDistricts([]); return; }
    setFilteredDistricts(districts.filter(d => d.country_id === parseInt(countryId)));
    setDistrictId('');
  }, [countryId, districts]);

  const selectedCountry = countries.find(c => c.id.toString() === countryId);
  const currency = selectedCountry?.currency || 'USD';

  const updateDraft = (id: string, patch: Partial<Draft>) => {
    setDrafts(prev => prev.map(d => (d.id === id ? { ...d, ...patch } : d)));
  };

  async function analyzeOne(draft: Draft) {
    updateDraft(draft.id, { status: 'analyzing' });
    try {
      const result = await aiApi.analyzeImage(draft.base64, draft.mimeType);
      // Convert USD price to local currency rough multiplier
      const fxToLocal: Record<string, number> = {
        USD: 1, KES: 130, UGX: 3700, RWF: 1300, ETB: 57, SSP: 1300,
      };
      const localPrice = (result.price_usd * (fxToLocal[currency] || 1)).toFixed(0);
      updateDraft(draft.id, {
        status: 'ready',
        title: result.title || '',
        description: result.description || '',
        category: result.category || 'Other',
        price: localPrice,
        quantity: String(result.available_quantity || 1),
        confidence: result.confidence || 0,
      });
    } catch (e: any) {
      updateDraft(draft.id, { status: 'error', error: e.message || 'Analysis failed' });
    }
  }

  async function pickImages() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 10,
      quality: 0.7,
    });
    if (result.canceled) return;

    const newDrafts: Draft[] = [];
    for (const asset of result.assets) {
      try {
        const { base64, mimeType } = await uriToBase64(asset.uri);
        newDrafts.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          uri: asset.uri,
          base64,
          mimeType,
          status: 'queued',
          title: '',
          description: '',
          category: 'Other',
          price: '',
          quantity: '1',
          confidence: 0,
        });
      } catch (e) {
        console.error('Failed to read image', e);
      }
    }
    setDrafts(prev => [...prev, ...newDrafts]);

    // Analyze sequentially to avoid hammering the API
    for (const d of newDrafts) {
      // eslint-disable-next-line no-await-in-loop
      await analyzeOne(d);
    }
  }

  const removeDraft = (id: string) => setDrafts(prev => prev.filter(d => d.id !== id));

  const reanalyze = (d: Draft) => analyzeOne(d);

  async function uploadAll() {
    if (!countryId) { Alert.alert('Required', 'Please pick a country'); return; }
    const ready = drafts.filter(d => d.status === 'ready');
    if (ready.length === 0) { Alert.alert('Nothing to upload', 'No products are ready'); return; }

    const invalid = ready.filter(d => !d.title.trim() || !d.price || parseFloat(d.price) <= 0);
    if (invalid.length > 0) {
      Alert.alert('Missing info', `${invalid.length} item(s) need a title and price.`);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { Alert.alert('Error', 'Please log in'); return; }

    // Account-type limit check
    const { data: profile } = await supabase
      .from('profiles').select('account_type').eq('id', user.id).maybeSingle();
    const accountType = profile?.account_type || 'basic';
    const { data: limitData } = await supabase
      .from('account_type_limits').select('max_products').eq('account_type', accountType).maybeSingle();
    const maxProducts = limitData?.max_products || 3;
    const { count: currentCount } = await supabase
      .from('products').select('*', { count: 'exact', head: true }).eq('user_id', user.id);
    if ((currentCount || 0) + ready.length > maxProducts) {
      Alert.alert(
        'Limit Reached',
        `Your ${accountType} account allows ${maxProducts} products total. ` +
          `You have ${currentCount || 0} and are trying to add ${ready.length}.`
      );
      return;
    }

    setBulkUploading(true);
    const districtName = districts.find(d => d.id.toString() === districtId)?.name || null;
    const countryName = countries.find(c => c.id.toString() === countryId)?.name || '';
    let success = 0, failed = 0;

    // Run all SEO optimizations in parallel BEFORE the sequential upload loop
    // — saves ~N×3s of waiting on bulk imports of 10-30 items.
    const seoResults = await Promise.all(
      ready.map(d => aiApi.optimizeListing({
        title: d.title.trim(),
        description: d.description.trim(),
        category: d.category,
        country: countryName,
        county: districtName || '',
      }).catch(() => ({ title: d.title.trim(), description: d.description.trim(), keywords: [], optimized: false })))
    );
    const seoByDraftId = new Map(ready.map((d, i) => [d.id, seoResults[i]]));

    for (const d of ready) {
      updateDraft(d.id, { status: 'uploading' });
      try {
        const fileName = `${user.id}/${Date.now()}-${d.id}.jpg`;
        const blob = base64ToBlob(d.base64, d.mimeType);
        const { error: upErr } = await supabase.storage
          .from('images').upload(fileName, blob, { contentType: d.mimeType });
        if (upErr) throw upErr;

        const seo = seoByDraftId.get(d.id) || { title: d.title.trim(), description: d.description.trim() };

        const { data: prod, error: prodErr } = await supabase.from('products').insert({
          user_id: user.id,
          title: seo.title || d.title.trim(),
          description: seo.description || d.description.trim(),
          price: parseFloat(d.price),
          category: d.category,
          available_quantity: parseInt(d.quantity, 10) || 1,
          storage_path: fileName,
          product_status: 'draft',
          country_id: parseInt(countryId, 10),
          county: districtName,
        }).select('id').single();
        if (prodErr) throw prodErr;

        await supabase.from('product_images').insert({
          product_id: prod.id,
          storage_path: fileName,
          is_main: true,
          display_order: 0,
        });

        updateDraft(d.id, { status: 'uploaded' });
        success++;
      } catch (e: any) {
        console.error('Upload failed for', d.id, e);
        updateDraft(d.id, { status: 'failed', error: e.message || 'Upload failed' });
        failed++;
      }
    }

    setBulkUploading(false);
    Alert.alert(
      'Bulk Import Complete',
      `${success} product(s) saved as drafts. ${failed > 0 ? `${failed} failed.` : ''}\n\nThey are pending admin approval.`,
      [{ text: 'OK', onPress: () => navigation.navigate('MyProducts') }]
    );
  }

  const readyCount = drafts.filter(d => d.status === 'ready').length;
  const analyzingCount = drafts.filter(d => d.status === 'analyzing').length;

  return (
    <View style={{ flex: 1, display: 'flex', flexDirection: 'column' }} className="bg-white">
      <ScreenHeader title="Bulk Import" subtitle="AI fills the details — you review" showBackButton={true} />

      <View style={{ flex: 1, position: 'relative' }}>
        <WebScrollView contentPadding={16}>
          {/* Country picker */}
          <View className="bg-surface rounded-3xl p-5 mb-4 border border-secondary/10">
            <Text className="text-xs font-black text-black/40 uppercase mb-3 tracking-widest">Country *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {countries.map(c => (
                  <TouchableOpacity
                    key={c.id}
                    onPress={() => setCountryId(c.id.toString())}
                    className={`px-4 py-2 rounded-2xl border ${countryId === c.id.toString() ? 'bg-accent border-accent' : 'bg-white border-secondary/20'}`}
                  >
                    <Text className={`font-black text-xs ${countryId === c.id.toString() ? 'text-white' : 'text-black'}`}>
                      {c.name} · {c.currency}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {filteredDistricts.length > 0 && (
              <View className="mt-3">
                <Text className="text-xs font-black text-black/40 uppercase mb-2 tracking-widest">District</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {filteredDistricts.map(d => (
                      <TouchableOpacity
                        key={d.id}
                        onPress={() => setDistrictId(d.id.toString())}
                        className={`px-3 py-1.5 rounded-full border ${districtId === d.id.toString() ? 'bg-black border-black' : 'bg-white border-secondary/20'}`}
                      >
                        <Text className={`font-black text-[11px] ${districtId === d.id.toString() ? 'text-white' : 'text-black'}`}>
                          {d.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}
          </View>

          {/* Add images button */}
          <TouchableOpacity
            onPress={pickImages}
            disabled={bulkUploading}
            className="bg-primary/30 border-2 border-dashed border-accent/40 rounded-3xl p-6 mb-4 flex-row items-center justify-center"
          >
            <Camera size={22} color="#00A082" />
            <Text className="text-black font-black ml-3">
              {drafts.length === 0 ? 'Pick product photos (up to 10)' : 'Add more photos'}
            </Text>
          </TouchableOpacity>

          {drafts.length === 0 && (
            <View className="bg-secondary/5 rounded-3xl p-6 mb-4">
              <View className="flex-row items-center mb-2">
                <Sparkles size={18} color="#FDB913" />
                <Text className="font-black text-black ml-2">How it works</Text>
              </View>
              <Text className="text-black/60 font-medium leading-relaxed">
                1. Pick several product photos at once.{'\n'}
                2. AI looks at each photo and fills in title, description, category, price and quantity.{'\n'}
                3. You review and edit anything you want.{'\n'}
                4. Tap Upload All — products are saved as drafts pending admin approval.
              </Text>
            </View>
          )}

          {/* Draft cards */}
          {drafts.map((d) => (
            <View key={d.id} className="bg-white border border-secondary/15 rounded-3xl p-4 mb-3">
              <View className="flex-row">
                <View style={{ position: 'relative' }}>
                  <Image source={{ uri: d.uri }} style={{ width: 90, height: 90, borderRadius: 16 }} />
                  <TouchableOpacity
                    onPress={() => removeDraft(d.id)}
                    disabled={bulkUploading || d.status === 'uploading'}
                    style={{ position: 'absolute', top: -6, right: -6 }}
                    className="bg-red-500 w-6 h-6 rounded-full justify-center items-center"
                  >
                    <X size={12} color="white" />
                  </TouchableOpacity>
                </View>

                <View style={{ flex: 1, marginLeft: 12 }}>
                  {d.status === 'analyzing' && (
                    <View className="flex-row items-center">
                      <ActivityIndicator size="small" color="#00A082" />
                      <Text className="ml-2 font-bold text-black/60 text-xs">Analyzing with AI…</Text>
                    </View>
                  )}
                  {d.status === 'queued' && <Text className="font-bold text-black/40 text-xs">Queued</Text>}
                  {d.status === 'error' && (
                    <View>
                      <Text className="font-black text-red-600 text-xs mb-1">Analysis failed</Text>
                      <Text className="text-red-500 text-[11px] mb-2" numberOfLines={2}>{d.error}</Text>
                      <TouchableOpacity onPress={() => reanalyze(d)} className="bg-black px-3 py-1.5 rounded-full self-start flex-row items-center">
                        <RefreshCw size={12} color="white" />
                        <Text className="text-white font-black text-[11px] ml-1">Retry</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  {(d.status === 'ready' || d.status === 'uploading' || d.status === 'uploaded' || d.status === 'failed') && (
                    <>
                      <View className="flex-row items-center mb-1">
                        {d.status === 'uploaded' && (
                          <View className="bg-green-100 px-2 py-0.5 rounded-full flex-row items-center mr-2">
                            <Check size={10} color="#16a34a" />
                            <Text className="text-green-700 font-black text-[10px] ml-0.5">SAVED</Text>
                          </View>
                        )}
                        {d.status === 'uploading' && (
                          <View className="bg-amber-100 px-2 py-0.5 rounded-full mr-2">
                            <Text className="text-amber-700 font-black text-[10px]">UPLOADING…</Text>
                          </View>
                        )}
                        {d.status === 'failed' && (
                          <View className="bg-red-100 px-2 py-0.5 rounded-full mr-2">
                            <Text className="text-red-700 font-black text-[10px]">FAILED</Text>
                          </View>
                        )}
                        {d.status === 'ready' && d.confidence > 0 && (
                          <View className={`px-2 py-0.5 rounded-full mr-2 ${d.confidence >= 0.7 ? 'bg-green-100' : 'bg-amber-100'}`}>
                            <Text className={`font-black text-[10px] ${d.confidence >= 0.7 ? 'text-green-700' : 'text-amber-700'}`}>
                              AI · {Math.round(d.confidence * 100)}%
                            </Text>
                          </View>
                        )}
                        <TouchableOpacity onPress={() => reanalyze(d)} disabled={bulkUploading}>
                          <RefreshCw size={14} color="#00A082" />
                        </TouchableOpacity>
                      </View>

                      <TextInput
                        value={d.title}
                        onChangeText={(t) => updateDraft(d.id, { title: t })}
                        placeholder="Product title"
                        placeholderTextColor="#9ca3af"
                        editable={d.status === 'ready'}
                        className="font-black text-black text-sm bg-surface rounded-xl px-3 py-2 mb-2"
                      />

                      <TouchableOpacity
                        onPress={() => setShowCategoryPickerFor(showCategoryPickerFor === d.id ? null : d.id)}
                        className="bg-surface rounded-xl px-3 py-2 mb-2 flex-row items-center justify-between"
                      >
                        <Text className="font-bold text-black text-xs">{d.category}</Text>
                        <ChevronDown size={14} color="#666" />
                      </TouchableOpacity>
                      {showCategoryPickerFor === d.id && (
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }} className="mb-2">
                          {CATEGORIES.map(cat => (
                            <TouchableOpacity
                              key={cat}
                              onPress={() => { updateDraft(d.id, { category: cat }); setShowCategoryPickerFor(null); }}
                              className={`px-2 py-1 rounded-full border ${d.category === cat ? 'bg-black border-black' : 'bg-white border-secondary/20'}`}
                            >
                              <Text className={`font-black text-[10px] ${d.category === cat ? 'text-white' : 'text-black'}`}>{cat}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}

                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        <View style={{ flex: 2 }}>
                          <TextInput
                            value={d.price}
                            onChangeText={(t) => updateDraft(d.id, { price: t.replace(/[^0-9.]/g, '') })}
                            placeholder={`Price (${currency})`}
                            placeholderTextColor="#9ca3af"
                            keyboardType="decimal-pad"
                            editable={d.status === 'ready'}
                            className="font-bold text-black text-xs bg-surface rounded-xl px-3 py-2"
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <TextInput
                            value={d.quantity}
                            onChangeText={(t) => updateDraft(d.id, { quantity: t.replace(/[^0-9]/g, '') })}
                            placeholder="Qty"
                            placeholderTextColor="#9ca3af"
                            keyboardType="number-pad"
                            editable={d.status === 'ready'}
                            className="font-bold text-black text-xs bg-surface rounded-xl px-3 py-2"
                          />
                        </View>
                      </View>
                    </>
                  )}
                </View>
              </View>

              {(d.status === 'ready' || d.status === 'uploading' || d.status === 'uploaded' || d.status === 'failed') && (
                <TextInput
                  value={d.description}
                  onChangeText={(t) => updateDraft(d.id, { description: t })}
                  placeholder="Description"
                  placeholderTextColor="#9ca3af"
                  editable={d.status === 'ready'}
                  multiline
                  numberOfLines={3}
                  style={{ minHeight: 70, textAlignVertical: 'top' }}
                  className="font-medium text-black text-xs bg-surface rounded-xl px-3 py-2 mt-3"
                />
              )}
            </View>
          ))}

          {drafts.length > 0 && <View style={{ height: 160 + insets.bottom }} />}
        </WebScrollView>

        {/* Sticky footer */}
        {drafts.length > 0 && (
          <View
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: 'white',
              borderTopWidth: 1,
              borderTopColor: '#e5e7eb',
              paddingHorizontal: 16,
              paddingTop: 12,
              paddingBottom: Math.max(insets.bottom, 12) + 12,
              shadowColor: '#000',
              shadowOpacity: 0.06,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: -2 },
              elevation: 8,
              zIndex: 50,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={{ fontWeight: '900', color: '#111827', fontSize: 12 }}>
                {readyCount} ready
                {analyzingCount > 0 && ` · ${analyzingCount} analyzing`}
              </Text>
              {readyCount === 0 && analyzingCount === 0 && (
                <Text style={{ color: '#9ca3af', fontWeight: '700', fontSize: 11 }}>Waiting for AI…</Text>
              )}
            </View>
            <Pressable
              onPress={uploadAll}
              disabled={bulkUploading || readyCount === 0 || analyzingCount > 0}
              style={({ pressed }) => ({
                backgroundColor:
                  bulkUploading || readyCount === 0 || analyzingCount > 0 ? '#cbd5e1' : '#00A082',
                borderRadius: 16,
                paddingVertical: 16,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.85 : 1,
              })}
            >
              {bulkUploading ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Upload size={18} color="white" />
                  <Text style={{ color: 'white', fontWeight: '900', marginLeft: 8, fontSize: 15 }}>
                    Upload {readyCount} Product{readyCount === 1 ? '' : 's'}
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}
