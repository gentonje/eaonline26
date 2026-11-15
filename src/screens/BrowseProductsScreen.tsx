import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, FlatList, ActivityIndicator, TouchableOpacity, ScrollView, TextInput, Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import ProductCard from '../components/ProductCard';
import AutoCompareButton from '../components/AutoCompareButton';
import ScreenHeader from '../components/ScreenHeader';
import { ProductGridSkeleton } from '../components/Skeleton';
import { MapPin, X, Building2, Tag, Store as StoreIcon, Search } from 'lucide-react-native';
import { useColumns } from '../hooks/useColumns';



type RootStackParamList = {
    Dashboard: undefined;
    BrowseProducts: { category?: string } | undefined;
    ProductDetail: { productId: string };
    Store: { storeId: string };
    ProductComparison: undefined;
};

type NavigationProp = StackNavigationProp<RootStackParamList>;

interface Country { id: number; name: string; code: string; }
interface District { id: number; name: string; country_id: number; }

const ITEMS_PER_PAGE = 12;

// Map older listing categories into the canonical taxonomy for browsing.
const LEGACY_CATEGORY_MAP: Record<string, string[]> = {
    'Agriculture & Livestock': [],
    'Automotive & Transport': ['Auto'],
    'Building & Construction': [],
    'Business, Office & Industrial Supplies': [],
    'Cleaning & Facility Care': [],
    'Education & Learning': ['Books'],
    'Electronics & Technology': ['Electronics'],
    'Energy, Solar & Electrical': ['Electronics'],
    'Fashion & Clothing': ['Clothing', 'Fashion'],
    'Food & Groceries': ['Food'],
    'Fitness & Sports': ['Sports'],
    'Home, Furniture & Household': ['Furniture', 'Home', 'Kitchen'],
    'Beauty & Personal Care': ['Beauty'],
    'Pharmaceuticals & Healthcare': [],
    'Animals & Veterinary': [],
    'Tools, Machinery & Equipment': [],
    'Raw Materials & Manufacturing': [],
    'Books, Arts & Entertainment': ['Art', 'Books', 'Handicrafts'],
    'Baby, Children & Toys': ['Children', 'Toys'],
    'Digital Products & Software': [],
    'Professional & Business Services': [],
    'Home & Property Services': [],
    'Wellness & Lifestyle Services': ['Beauty'],
    'Transport & Logistics Services': ['Auto'],
    'Travel, Events & Experiences': [],
    'Other / Specialist': ['Other'],
};

const normaliseCategory = (value: string | null | undefined): string | null => {
    if (!value) return null;
    if (LEGACY_CATEGORY_MAP[value]) return value;
    return Object.entries(LEGACY_CATEGORY_MAP).find(([, legacy]) => legacy.includes(value))?.[0] || value;
};

// Split searches into useful words (brand, model, product type) and ignore
// punctuation so a long listing title does not need to match the whole phrase.
const getSearchKeywords = (value: string) =>
    Array.from(new Set(value.toLowerCase().match(/[a-z0-9]+/g) || []))
        .filter(word => word.length >= 2);

const FLAG_MAP: Record<string, string> = {
    SS: '\u{1F1F8}\u{1F1F8}',
    KE: '\u{1F1F0}\u{1F1EA}',
    UG: '\u{1F1FA}\u{1F1EC}',
    ET: '\u{1F1EA}\u{1F1F9}',
    RW: '\u{1F1F7}\u{1F1FC}',
};

export default function BrowseProductsScreen() {
    const route = useRoute<any>();
    const navigation = useNavigation<NavigationProp>();
    const numColumns = useColumns();

    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [page, setPage] = useState(0);
    const isFetchingRef = useRef(false);

    const [countries, setCountries] = useState<Country[]>([]);\n    const [taxonomyNodes, setTaxonomyNodes] = useState<any[]>([]);
    const [districts, setDistricts] = useState<District[]>([]);
    const [selectedCountry, setSelectedCountry] = useState<number | null>(null);
    const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(
        normaliseCategory(route.params?.category)
    );

    // Unified search — products + stores
    const [searchQuery, setSearchQuery] = useState('');
    const [storeResults, setStoreResults] = useState<{ id: string; name: string }[]>([]);
    const [searchingStores, setSearchingStores] = useState(false);
    // debouncedSearch drives product filtering; stored in a ref so fetchProducts
    // can always read the latest value without stale-closure issues.
    const debouncedRef = useRef('');
    const debounceTimer = useRef<any>(null);

    // When navigated with a category param, apply it and consume it
    useEffect(() => {
        const incoming = route.params?.category;
        if (incoming !== undefined) {
            setSelectedCategory(normaliseCategory(incoming));
            navigation.setParams({ category: undefined } as any);
        }
    }, [route.params?.category]);

    useEffect(() => { fetchCountries(); fetchTaxonomy(); }, []);

    useEffect(() => {
        if (selectedCountry !== null) {
            fetchDistricts(selectedCountry);
        } else {
            setDistricts([]);
        }
        setSelectedDistrict(null);
    }, [selectedCountry]);

    // Debounce the raw search query: after 300 ms of no typing, commit it
    // to the ref and re-run the product fetch + store lookup.
    useEffect(() => {
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(() => {
            const q = searchQuery.trim();
            debouncedRef.current = q;

            // Refetch products with the new search term
            setProducts([]);
            setPage(0);
            setHasMore(true);
            fetchProducts(0, true);

            // Store suggestions are a separate lookup from product search.
            // Match any useful keyword in the store name (e.g. a brand/store term).
            const keywords = getSearchKeywords(q);
            setStoreResults([]);
            if (keywords.length > 0) {
                setSearchingStores(true);
                const storeFilter = keywords
                    .map(word => `name.ilike.%${word}%`)
                    .join(',');
                supabase
                    .from('stores')
                    .select('id, name')
                    .or(storeFilter)
                    .limit(8)
                    .then(({ data, error }) => {
                        if (!error) setStoreResults(data || []);
                        setSearchingStores(false);
                    }, () => setSearchingStores(false));
            } else {
                setSearchingStores(false);
            }
        }, 300);
        return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
    }, [searchQuery]);

    // Re-fetch when filters change (search is handled by its own debounce above)
    useEffect(() => {
        setProducts([]);
        setPage(0);
        setHasMore(true);
        fetchProducts(0, true);
    }, [selectedCountry, selectedDistrict, selectedCategory]);

    useFocusEffect(
        useCallback(() => {
            fetchProducts(0, true);
        }, [selectedCountry, selectedDistrict, selectedCategory])
    );

    async function fetchTaxonomy() {
        try {
            const { data, error } = await supabase
                .from('marketplace_taxonomy_nodes')
                .select('id, parent_id, label, node_kind, is_active, sort_order')
                .eq('is_active', true)
                .order('sort_order');
            if (error) throw error;
            setTaxonomyNodes(data || []);
        } catch (e) {
            console.error('Error fetching marketplace taxonomy:', e);
        }
    }

    const getCategoryNodeIds = (mainCategoryLabel: string): string[] => {
        const main = taxonomyNodes.find(n => n.node_kind === 'main_category' && n.label === mainCategoryLabel);
        if (!main) return [];
        const descendants = new Set<string>([main.id]);
        let changed = true;
        while (changed) {
            changed = false;
            taxonomyNodes.forEach(node => {
                if (node.parent_id && descendants.has(node.parent_id) && !descendants.has(node.id)) {
                    descendants.add(node.id);
                    changed = true;
                }
            });
        }
        return Array.from(descendants);
    };

    async function fetchCountries() {
        try {
            const { data, error } = await supabase
                .from('countries').select('id, name, code').order('name');
            if (error) throw error;
            setCountries(data || []);
        } catch (e) { console.error('Error fetching countries:', e); }
    }

    async function fetchDistricts(countryId: number) {
        try {
            const { data, error } = await supabase
                .from('districts').select('id, name, country_id')
                .eq('country_id', countryId).order('name');
            if (error) throw error;
            setDistricts(data || []);
        } catch (e) { console.error('Error fetching districts:', e); }
    }

    async function fetchProducts(pageNum: number, isRefresh = false) {
        if (isFetchingRef.current && !isRefresh) return;
        isFetchingRef.current = true;
        try {
            if (isRefresh) setLoading(true); else setLoadingMore(true);
            const from = pageNum * ITEMS_PER_PAGE;
            const to = from + ITEMS_PER_PAGE - 1;

            let query = supabase
                .from('products')
                .select('*, product_images(*), countries(id, name, currency)')
                .eq('product_status', 'published')
                .order('created_at', { ascending: false })
                .range(from, to);

            if (selectedCountry !== null) query = query.eq('country_id', selectedCountry);
            if (selectedDistrict !== null) query = query.eq('county', selectedDistrict);
            const combinedFilters: string[] = [];

            if (selectedCategory !== null) {
                const taxonomyIds = getCategoryNodeIds(selectedCategory);
                const legacyCategories = Array.from(new Set([
                    selectedCategory,
                    ...(LEGACY_CATEGORY_MAP[selectedCategory] || []),
                ]));
                const categoryClauses: string[] = [];
                if (taxonomyIds.length) categoryClauses.push(`taxonomy_node_id.in.(${taxonomyIds.join(',')})`);
                if (legacyCategories.length) {
                    const quoted = legacyCategories.map(value => `"${value.replace(/"/g, '\\"')}"`).join(',');
                    categoryClauses.push(`category.in.(${quoted})`);
                }
                if (categoryClauses.length) combinedFilters.push(`or(${categoryClauses.join(',')})`);
            }

            // Every search keyword must match the title or description.
            const keywords = getSearchKeywords(debouncedRef.current);
            if (keywords.length > 0) {
                const keywordGroups = keywords.map(word =>
                    `or(title.ilike.%${word}%,description.ilike.%${word}%)`
                );
                combinedFilters.push(`and(${keywordGroups.join(',')})`);
            }

            // Apply category and keyword conditions together in one filter.
            if (combinedFilters.length) query = query.or(`and(${combinedFilters.join(',')})`);

            const { data, error } = await query;
            if (error) throw error;
            const newProducts = data || [];
            if (isRefresh) setProducts(newProducts);
            else setProducts(prev => [...prev, ...newProducts]);
            setHasMore(newProducts.length === ITEMS_PER_PAGE);
            setPage(pageNum);
        } catch (e) {
            console.error('Error fetching products:', e);
        } finally {
            setLoading(false);
            setLoadingMore(false);
            isFetchingRef.current = false;
        }
    }

    const handleLoadMore = useCallback(() => {
        if (!loadingMore && hasMore) fetchProducts(page + 1);
    }, [loadingMore, hasMore, page]);

    const handleSelectCountry = (id: number) =>
        setSelectedCountry(prev => (prev === id ? null : id));
    const handleSelectDistrict = (name: string) =>
        setSelectedDistrict(prev => (prev === name ? null : name));
    const handleSelectCategory = (cat: string) =>
        setSelectedCategory(prev => (prev === cat ? null : cat));

    const clearSearch = () => {
        setSearchQuery('');
        setStoreResults([]);
        debouncedRef.current = '';
    };



    const selectedCountryName = countries.find(c => c.id === selectedCountry)?.name;
    const hasActiveFilters = selectedCountry !== null || selectedDistrict !== null || selectedCategory !== null;
    const hasSearch = searchQuery.trim().length > 0;

    const renderProduct = useCallback(({ item }: { item: any }) => (
        <View style={{ width: `${(100 / numColumns).toFixed(4)}%` as any, padding: 4 }}>
            <ProductCard product={item} actions={<AutoCompareButton product={item} compact />} />
        </View>
    ), [numColumns]);

    const renderFooter = () => !loadingMore ? null : (
        <View className="py-4"><ActivityIndicator size="small" color="#00A082" /></View>
    );

    const renderHeader = () => (
        <View className="mb-2">
            {/* ── Category filter ── */}
            <View className="px-1 pb-2">
                <View className="flex-row items-center mb-2">
                    <Tag size={14} color="#00A082" />
                    <Text className="text-xs font-black text-black/50 uppercase ml-1.5 tracking-widest">
                        Category
                    </Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity
                            onPress={() => setSelectedCategory(null)}
                            className={`px-4 py-2.5 rounded-2xl border ${
                                selectedCategory === null ? 'bg-accent border-accent' : 'bg-white border-gray-200'
                            }`}
                        >
                            <Text className={`text-sm font-black ${
                                selectedCategory === null ? 'text-white' : 'text-gray-600'
                            }`}>All</Text>
                        </TouchableOpacity>
                        {taxonomyNodes.filter(node => node.node_kind === 'main_category').map(cat => (
                            <TouchableOpacity
                                key={cat.id}
                                onPress={() => handleSelectCategory(cat.label)}
                                className={`px-4 py-2.5 rounded-2xl border ${
                                    selectedCategory === cat.label ? 'bg-accent border-accent' : 'bg-white border-gray-200'
                                }`}
                            >
                                <Text className={`text-sm font-black ${
                                    selectedCategory === cat.label ? 'text-white' : 'text-gray-600'
                                }`}>{cat.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </ScrollView>
            </View>

            {/* ── Country filter ── */}
            <View className="px-1 pb-2">
                <View className="flex-row items-center mb-2">
                    <MapPin size={16} color="#00A082" />
                    <Text className="text-xs font-black text-black/50 uppercase ml-1.5 tracking-widest">
                        Country
                    </Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity
                            onPress={() => setSelectedCountry(null)}
                            className={`px-4 py-2.5 rounded-2xl border ${
                                selectedCountry === null ? 'bg-accent border-accent' : 'bg-white border-gray-200'
                            }`}
                        >
                            <Text className={`text-sm font-black ${
                                selectedCountry === null ? 'text-white' : 'text-gray-600'
                            }`}>All</Text>
                        </TouchableOpacity>
                        {countries.map(country => (
                            <TouchableOpacity
                                key={country.id}
                                onPress={() => handleSelectCountry(country.id)}
                                className={`px-4 py-2.5 rounded-2xl border flex-row items-center ${
                                    selectedCountry === country.id ? 'bg-accent border-accent' : 'bg-white border-gray-200'
                                }`}
                            >
                                <Text className="mr-1.5">{FLAG_MAP[country.code] || ''}</Text>
                                <Text className={`text-sm font-black ${
                                    selectedCountry === country.id ? 'text-white' : 'text-gray-600'
                                }`}>{country.name}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </ScrollView>
            </View>

            {/* ── District filter ── */}
            {selectedCountry !== null && districts.length > 0 && (
                <View className="px-1 pb-2">
                    <View className="flex-row items-center mb-2">
                        <Building2 size={14} color="#64748b" />
                        <Text className="text-xs font-black text-black/40 uppercase ml-1.5 tracking-widest">
                            District / City
                        </Text>
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                            <TouchableOpacity
                                onPress={() => setSelectedDistrict(null)}
                                className={`px-3 py-2 rounded-xl border ${
                                    selectedDistrict === null ? 'bg-black border-black' : 'bg-white border-gray-200'
                                }`}
                            >
                                <Text className={`text-xs font-bold ${
                                    selectedDistrict === null ? 'text-white' : 'text-gray-500'
                                }`}>All Cities</Text>
                            </TouchableOpacity>
                            {districts.map(district => (
                                <TouchableOpacity
                                    key={district.id}
                                    onPress={() => handleSelectDistrict(district.name)}
                                    className={`px-3 py-2 rounded-xl border ${
                                        selectedDistrict === district.name ? 'bg-black border-black' : 'bg-white border-gray-200'
                                    }`}
                                >
                                    <Text className={`text-xs font-bold ${
                                        selectedDistrict === district.name ? 'text-white' : 'text-gray-500'
                                    }`}>{district.name}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </ScrollView>
                </View>
            )}

            {/* ── Active filter / search pills ── */}
            {(hasActiveFilters || hasSearch) && (
                <View className="px-1 pb-2 flex-row flex-wrap" style={{ gap: 6 }}>
                    {hasSearch && (
                        <TouchableOpacity
                            onPress={clearSearch}
                            className="flex-row items-center bg-accent/10 px-3 py-1.5 rounded-full"
                        >
                            <Search size={12} color="#00A082" />
                            <Text className="text-accent font-bold text-xs ml-1" numberOfLines={1}>
                                "{searchQuery.trim()}"
                            </Text>
                            <X size={12} color="#00A082" style={{ marginLeft: 4 }} />
                        </TouchableOpacity>
                    )}
                    {selectedCategory !== null && (
                        <TouchableOpacity
                            onPress={() => setSelectedCategory(null)}
                            className="flex-row items-center bg-accent/10 px-3 py-1.5 rounded-full"
                        >
                            <Tag size={12} color="#00A082" />
                            <Text className="text-accent font-bold text-xs ml-1">{selectedCategory}</Text>
                            <X size={12} color="#00A082" style={{ marginLeft: 4 }} />
                        </TouchableOpacity>
                    )}
                    {selectedCountry !== null && (
                        <TouchableOpacity
                            onPress={() => setSelectedCountry(null)}
                            className="flex-row items-center bg-accent/10 px-3 py-1.5 rounded-full"
                        >
                            <MapPin size={12} color="#00A082" />
                            <Text className="text-accent font-bold text-xs ml-1">{selectedCountryName}</Text>
                            <X size={12} color="#00A082" style={{ marginLeft: 4 }} />
                        </TouchableOpacity>
                    )}
                    {selectedDistrict !== null && (
                        <TouchableOpacity
                            onPress={() => setSelectedDistrict(null)}
                            className="flex-row items-center bg-black/10 px-3 py-1.5 rounded-full"
                        >
                            <Building2 size={12} color="#333" />
                            <Text className="text-black font-bold text-xs ml-1">{selectedDistrict}</Text>
                            <X size={12} color="#333" style={{ marginLeft: 4 }} />
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity
                        onPress={() => {
                            setSelectedCountry(null);
                            setSelectedDistrict(null);
                            setSelectedCategory(null);
                            clearSearch();
                        }}
                        className="flex-row items-center bg-red-50 px-3 py-1.5 rounded-full"
                    >
                        <X size={12} color="#ef4444" />
                        <Text className="text-red-500 font-bold text-xs ml-1">Clear all</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );

    // Search bar rendered outside FlatList so keyboard focus is never
    // disturbed by FlatList re-renders when searchQuery state changes.
    const renderSearchBar = () => (
        <View style={{ paddingHorizontal: 6, paddingTop: 8, paddingBottom: 2, backgroundColor: '#fff', zIndex: 10 }}>
            <View
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: '#f8fafc',
                    borderRadius: 18,
                    borderWidth: hasSearch ? 1.5 : 1,
                    borderColor: hasSearch ? '#00A082' : '#e2e8f0',
                    paddingHorizontal: 12,
                }}
            >
                <Search size={17} color={hasSearch ? '#00A082' : '#94a3b8'} />
                <TextInput
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Search products or stores…"
                    placeholderTextColor="#9ca3af"
                    style={{ flex: 1, paddingHorizontal: 10, paddingVertical: 12, fontSize: 14, fontWeight: '700', color: '#000', outlineStyle: 'none' } as any}
                    returnKeyType="search"
                    autoCorrect={false}
                    autoCapitalize="none"
                />
                {(searchingStores && hasSearch) && (
                    <ActivityIndicator size="small" color="#00A082" style={{ marginRight: 6 }} />
                )}
                {hasSearch && (
                    <TouchableOpacity onPress={clearSearch} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <X size={16} color="#94a3b8" />
                    </TouchableOpacity>
                )}
            </View>

            {/* Store suggestions dropdown — sits below the bar, above the list */}
            {storeResults.length > 0 && (
                <View
                    style={{
                        marginTop: 6,
                        backgroundColor: '#fff',
                        borderRadius: 18,
                        borderWidth: 1,
                        borderColor: '#f1f5f9',
                        overflow: 'hidden',
                        shadowColor: '#000',
                        shadowOpacity: 0.07,
                        shadowRadius: 8,
                        shadowOffset: { width: 0, height: 3 },
                        elevation: 4,
                    }}
                >
                    {storeResults.length > 0 && (
                        <View style={{ paddingHorizontal: 12, paddingTop: 10, paddingBottom: 4, flexDirection: 'row', alignItems: 'center' }}>
                            <StoreIcon size={11} color="#00A082" />
                            <Text style={{ fontSize: 10, fontWeight: '900', color: 'rgba(0,0,0,0.3)', marginLeft: 4, letterSpacing: 1, textTransform: 'uppercase' }}>Stores</Text>
                        </View>
                    )}
                    {storeResults.map((s, idx) => (
                        <TouchableOpacity
                            key={s.id}
                            onPress={() => { clearSearch(); navigation.navigate('Store', { storeId: s.id }); }}
                            style={{
                                paddingHorizontal: 12,
                                paddingVertical: 12,
                                flexDirection: 'row',
                                alignItems: 'center',
                                borderTopWidth: idx > 0 ? 1 : 0,
                                borderTopColor: '#f8fafc',
                            }}
                        >
                            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,160,130,0.08)', alignItems: 'center', justifyContent: 'center' }}>
                                <StoreIcon size={14} color="#00A082" />
                            </View>
                            <Text style={{ marginLeft: 10, fontWeight: '900', color: '#000', fontSize: 14, flex: 1 }} numberOfLines={1}>{s.name}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            )}
        </View>
    );

    if (loading && products.length === 0) {
        return (
            <View style={{ flex: 1 }} className="bg-white">
                <ScreenHeader title="Browse Products" showDrawerButton={true} />
                {renderSearchBar()}
                <View style={{ flex: 1, paddingHorizontal: 6, paddingTop: 4 }}>
                    {renderHeader()}
                    <ProductGridSkeleton count={numColumns * 2} numColumns={numColumns} />
                </View>
            </View>
        );
    }

    return (
        <View style={{ flex: 1 }} className="bg-white">
            <ScreenHeader title="Browse Products" showDrawerButton={true} />
            {renderSearchBar()}
            <FlatList
                key={numColumns}
                data={products}
                renderItem={renderProduct}
                keyExtractor={(item) => item.id.toString()}
                numColumns={numColumns}
                contentContainerStyle={{ paddingBottom: 100, paddingHorizontal: 6, paddingTop: 8 }}
                showsVerticalScrollIndicator={false}
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.5}
                ListHeaderComponent={renderHeader}
                ListFooterComponent={renderFooter}
                ListEmptyComponent={
                    <View className="flex-1 justify-center items-center py-20">
                        <Search size={48} color="#d1d5db" />
                        <Text className="text-black/40 font-bold text-lg mt-4">No products found</Text>
                        <Text className="text-black/30 font-bold text-sm mt-1 text-center px-8">
                            {hasSearch
                                ? `No products match "${searchQuery.trim()}"${selectedCountryName ? ` in ${selectedCountryName}` : ''}`
                                : selectedCategory
                                    ? `No ${selectedCategory} products${selectedCountryName ? ` in ${selectedCountryName}` : ''}`
                                    : selectedDistrict
                                        ? `No products in ${selectedDistrict}`
                                        : selectedCountry !== null
                                            ? `No products available in ${selectedCountryName}`
                                            : 'No products available yet'}
                        </Text>
                        {(hasActiveFilters || hasSearch) && (
                            <TouchableOpacity
                                onPress={() => {
                                    setSelectedCountry(null);
                                    setSelectedDistrict(null);
                                    setSelectedCategory(null);
                                    clearSearch();
                                }}
                                className="mt-4 bg-accent px-6 py-3 rounded-2xl"
                            >
                                <Text className="text-white font-black text-sm">Clear Filters</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                }
                columnWrapperStyle={numColumns > 1 ? { marginHorizontal: -4 } : undefined}
            />
        </View>
    );
}
