-- Complete the attribute-profile model for regulatory fields and listing-kind defaults.
-- Additive and safe to run after the taxonomy foundation migrations.

alter table public.marketplace_attribute_profiles
  add column if not exists regulatory_attributes text[] not null default '{}';

update public.marketplace_attribute_profiles
set regulatory_attributes = array[
  'active_ingredient',
  'strength',
  'dosage_form',
  'pack_size',
  'manufacturer',
  'registration_number',
  'batch_number',
  'expiry_date',
  'storage_conditions',
  'prescription_status'
]
where code = 'medicine_regulated';

update public.marketplace_attribute_profiles
set regulatory_attributes = array[
  'registration_status',
  'intended_use_device'
]
where code = 'medical_device';

update public.marketplace_attribute_profiles
set regulatory_attributes = array['registration_or_approval_if_required']
where code = 'seed_input';

-- Condition is meaningful for physical goods, not for service or digital listings.
-- Keep common offer details reusable, and attach condition through listing kind.
update public.marketplace_attribute_profiles
set essential_attributes = '{}'
where code = 'common_offer';

insert into public.marketplace_attribute_profiles(
  code,
  essential_attributes,
  recommended_attributes,
  advanced_attributes,
  regulatory_attributes
)
values (
  'physical_offer',
  array['condition'],
  '{}',
  '{}',
  '{}'
)
on conflict (code) do update set
  essential_attributes = excluded.essential_attributes,
  recommended_attributes = excluded.recommended_attributes,
  advanced_attributes = excluded.advanced_attributes,
  regulatory_attributes = excluded.regulatory_attributes;

insert into public.marketplace_listing_kind_profiles(listing_kind, profile_code)
values ('physical_product', 'physical_offer')
on conflict do nothing;
