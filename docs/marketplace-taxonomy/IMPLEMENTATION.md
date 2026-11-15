# Marketplace taxonomy implementation — Phase 1

This implementation is additive and intentionally does not change the live database or public listing behaviour.

## Migration order

1. `20261115203000_marketplace_taxonomy_foundation.sql`
2. `20261115203100_taxonomy_seed_safety_and_profile_fixes.sql`
3. `20261115203200_taxonomy_regulatory_and_listing_kind_profiles.sql`

The migration creates:
- A variable-depth taxonomy tree with stable text IDs.
- Reusable attribute definitions and essential/recommended/advanced/regulatory profiles.
- Listing-kind-specific defaults, so condition is requested for physical goods rather than services or digital listings.
- Product-type-to-profile mappings.
- Local language/search aliases.
- Listing kinds for physical products, services, digital products, rentals and RFQs.
- Nullable taxonomy links and classification workflow status on the existing `products` table.

## Compatibility and safety

- Existing `products.category`, `products.attributes`, `condition`, `warranty` and `delivery_terms` remain unchanged.
- Existing product rows are not backfilled or reclassified.
- Existing product RLS policies are not modified.
- Taxonomy tables are readable by marketplace clients; catalogue writes remain server/admin-only.
- Medicines, medical devices, medical consumables, health products and higher-risk crop/veterinary inputs are seeded inactive pending country-specific compliance configuration.
- No AI key or service-role key is required by the client.

## Next implementation phase

1. Add a server-side classification endpoint with deterministic validation first and optional AI suggestions.
2. Add seller confirmation and private draft handling.
3. Load short, type-specific essential fields in Add/Edit Product; expose recommended and advanced fields progressively.
4. Backfill existing products in a review queue rather than guessing their product type.
5. Switch Similar Products and Auto Compare to use compatible taxonomy nodes and comparable attributes.

## Validation notes

- The seed contains 713 taxonomy nodes and 576 product-type leaves; every leaf has at least one profile mapping.
- The profile catalogue contains 80 attribute definitions and 18 profiles. Regulatory fields are now stored separately from ordinary seller attributes.
- The common offer profile no longer makes condition mandatory for services and digital products; physical listings receive condition through the physical-product listing-kind profile.

## Important

Do not apply these migrations to the production Supabase project until the draft PR has been reviewed and the migration has been tested against a non-production database snapshot.
