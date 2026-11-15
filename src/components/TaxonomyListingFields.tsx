import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { supabase } from '../lib/supabase';

type Node = { id: string; parent_id: string | null; label: string; node_kind: string; is_active: boolean; sort_order: number };
type Definition = { code: string; label: string; data_type: string; tier: string; config: Record<string, any> };
type Selection = { nodeId: string | null; listingKind: string; attributes: Record<string, string> };
type Props = { initialNodeId?: string | null; initialListingKind?: string; initialAttributes?: Record<string, any>; onChange: (value: Selection) => void };

const kinds = [
  { code: 'physical_product', label: 'Physical product' },
  { code: 'service', label: 'Service' },
  { code: 'digital_product', label: 'Digital product' },
  { code: 'rental', label: 'Rental / hire' },
  { code: 'rfq', label: 'Request for quotation' },
];

export default function TaxonomyListingFields({ initialNodeId = null, initialListingKind = 'physical_product', initialAttributes = {}, onChange }: Props) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [definitions, setDefinitions] = useState<Record<string, Definition>>({});
  const [requiredCodes, setRequiredCodes] = useState<string[]>([]);
  const [optionalCodes, setOptionalCodes] = useState<string[]>([]);
  const [showOptional, setShowOptional] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mainId, setMainId] = useState<string | null>(null);
  const [subId, setSubId] = useState<string | null>(null);
  const [typeId, setTypeId] = useState<string | null>(initialNodeId);
  const [listingKind, setListingKind] = useState(initialListingKind);
  const [attributes, setAttributes] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(initialAttributes || {}).map(([k, v]) => [k, String(v ?? '')]))
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data, error } = await supabase.from('marketplace_taxonomy_nodes').select('id,parent_id,label,node_kind,is_active,sort_order').eq('is_active', true).order('sort_order');
        if (error) throw error;
        if (alive) setNodes((data || []) as Node[]);
      } catch (e) {
        console.warn('Could not load marketplace taxonomy', e);
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  const mains = useMemo(() => nodes.filter(n => n.node_kind === 'main_category'), [nodes]);
  const subs = useMemo(() => nodes.filter(n => n.node_kind === 'subcategory' && n.parent_id === mainId), [nodes, mainId]);
  const types = useMemo(() => nodes.filter(n => n.node_kind === 'product_type' && n.parent_id === subId), [nodes, subId]);

  useEffect(() => {
    if (!initialNodeId || !nodes.length) return;
    const leaf = nodes.find(n => n.id === initialNodeId);
    if (!leaf) return;
    const parent = nodes.find(n => n.id === leaf.parent_id);
    const main = parent && nodes.find(n => n.id === parent.parent_id);
    setTypeId(leaf.id); setSubId(parent?.id || null); setMainId(main?.id || null);
  }, [initialNodeId, nodes]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!typeId) { setRequiredCodes([]); setOptionalCodes([]); return; }
      try {
        const [{ data: maps, error: mapError }, { data: kindMaps, error: kindError }] = await Promise.all([
          supabase.from('marketplace_taxonomy_node_profiles').select('profile_code').eq('node_id', typeId),
          supabase.from('marketplace_listing_kind_profiles').select('profile_code').eq('listing_kind', listingKind),
        ]);
        if (mapError) throw mapError;
        if (kindError) throw kindError;
        const codes = Array.from(new Set([...(maps || []).map((x: any) => x.profile_code), ...(kindMaps || []).map((x: any) => x.profile_code)]));
        if (!codes.length) { if (alive) { setRequiredCodes([]); setOptionalCodes([]); } return; }
        const { data: profiles, error: profileError } = await supabase.from('marketplace_attribute_profiles').select('*').in('code', codes);
        if (profileError) throw profileError;
        const required = Array.from(new Set((profiles || []).flatMap((p: any) => p.essential_attributes || [])));
        const optional = Array.from(new Set((profiles || []).flatMap((p: any) => [...(p.recommended_attributes || []), ...(p.advanced_attributes || [])])));
        const all = Array.from(new Set([...required, ...optional]));
        const { data: defs, error: defsError } = await supabase.from('marketplace_attribute_definitions').select('code,label,data_type,tier,config').in('code', all).eq('is_active', true);
        if (defsError) throw defsError;
        if (!alive) return;
        setRequiredCodes(required.filter(c => defs?.some((d: any) => d.code === c)));
        setOptionalCodes(optional.filter(c => defs?.some((d: any) => d.code === c && !required.includes(c))));
        setDefinitions(Object.fromEntries((defs || []).map((d: any) => [d.code, d])));
      } catch (e) { console.warn('Could not load listing attributes', e); }
    })();
    return () => { alive = false; };
  }, [typeId, listingKind]);

  useEffect(() => { onChange({ nodeId: typeId, listingKind, attributes }); }, [typeId, listingKind, attributes]);

  const updateAttribute = (code: string, value: string) => setAttributes(prev => ({ ...prev, [code]: value }));
  const chips = (items: Node[], selected: string | null, onSelect: (id: string) => void) => (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
      {items.map(item => <TouchableOpacity key={item.id} onPress={() => onSelect(item.id)} style={{ paddingHorizontal: 12, paddingVertical: 9, borderRadius: 18, borderWidth: 1, borderColor: selected === item.id ? '#111827' : '#d1d5db', backgroundColor: selected === item.id ? '#111827' : '#fff' }}>
        <Text style={{ color: selected === item.id ? '#fff' : '#111827', fontSize: 12, fontWeight: '700' }}>{item.label}</Text>
      </TouchableOpacity>)}
    </View>
  );
  const renderFields = (codes: string[]) => codes.map(code => {
    const def = definitions[code]; if (!def) return null;
    const values = Array.isArray(def.config?.values) ? def.config.values : null;
    return <View key={code} style={{ marginTop: 12 }}>
      <Text style={{ fontSize: 12, fontWeight: '700', color: '#374151', marginBottom: 6 }}>{def.label}</Text>
      {values ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {values.map((v: string) => <TouchableOpacity key={v} onPress={() => updateAttribute(code, v)} style={{ paddingHorizontal: 10, paddingVertical: 7, borderRadius: 14, borderWidth: 1, borderColor: attributes[code] === v ? '#111827' : '#d1d5db', backgroundColor: attributes[code] === v ? '#111827' : '#fff' }}><Text style={{ color: attributes[code] === v ? '#fff' : '#111827', fontSize: 11 }}>{v.replace(/_/g, ' ')}</Text></TouchableOpacity>)}
      </View> : <TextInput value={attributes[code] || ''} onChangeText={v => updateAttribute(code, v)} placeholder={def.config?.unit ? 'Enter value (' + def.config.unit + ')' : 'Enter ' + def.label.toLowerCase()} keyboardType={['integer','number','decimal','percentage','measurement'].includes(def.data_type) ? 'numeric' : 'default'} style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 12, color: '#111827' }} />}
    </View>;
  });

  return <View style={{ backgroundColor: '#f8fafc', borderRadius: 22, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#e5e7eb' }}>
    <Text style={{ fontSize: 18, fontWeight: '900', color: '#111827' }}>What are you listing?</Text>
    <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>Choose the closest match. This helps buyers find your listing.</Text>
    {loading ? <ActivityIndicator style={{ margin: 18 }} color="#00A082" /> : <>
      <Text style={{ fontWeight: '800', fontSize: 12, color: '#374151', marginTop: 16 }}>Listing type</Text>
      {chips(kinds.map(k => ({ ...k, id: k.code, parent_id: null, node_kind: 'listing_kind', is_active: true, sort_order: 0 } as Node)), listingKind, setListingKind)}
      <Text style={{ fontWeight: '800', fontSize: 12, color: '#374151', marginTop: 16 }}>Main category</Text>
      {chips(mains, mainId, id => { setMainId(id); setSubId(null); setTypeId(null); setAttributes({}); })}
      {mainId && <><Text style={{ fontWeight: '800', fontSize: 12, color: '#374151', marginTop: 16 }}>Subcategory</Text>{chips(subs, subId, id => { setSubId(id); setTypeId(null); setAttributes({}); })}</>}
      {subId && <><Text style={{ fontWeight: '800', fontSize: 12, color: '#374151', marginTop: 16 }}>Specific product or service</Text>{chips(types, typeId, id => { setTypeId(id); setAttributes({}); })}</>}
      {typeId && <>
        <View style={{ marginTop: 18, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#e5e7eb' }}>
          <Text style={{ fontWeight: '900', color: '#111827' }}>Key details</Text>
          <Text style={{ fontSize: 11, color: '#6b7280', marginTop: 3 }}>Only the important details are shown first. Add more if useful.</Text>
          {requiredCodes.length ? renderFields(requiredCodes) : <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 10 }}>No extra required details for this listing type.</Text>}
          {!!optionalCodes.length && <TouchableOpacity onPress={() => setShowOptional(v => !v)} style={{ marginTop: 14, padding: 11, borderRadius: 12, backgroundColor: '#e5e7eb' }}><Text style={{ fontWeight: '800', color: '#111827', textAlign: 'center' }}>{showOptional ? 'Hide additional details' : 'Add recommended details'}</Text></TouchableOpacity>}
          {showOptional && renderFields(optionalCodes)}
        </View>
      </>}
    </>}
  </View>;
}
