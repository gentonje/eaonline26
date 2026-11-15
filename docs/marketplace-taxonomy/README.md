# East Africa Online — Marketplace Taxonomy Blueprint

**Version:** 0.1.0 (design draft)  
**Audience:** Product, engineering, catalogue operations and compliance  
**Status:** Blueprint only — no production schema or listing data changed

## Product principle

**Simple on the screen; detailed in the database.** The taxonomy is built for East African sellers and shoppers first, while retaining mappings to international standards.

The catalogue must distinguish:
- **Listing kind:** physical product, service, digital product, rental/hire, or request for quotation (RFQ).
- **Classification:** what the item or service actually is.
- **Attributes:** facts that describe this specific listing.
- **Offer terms:** price, quantity, stock, booking, delivery, hire period and fulfilment.
- **Compliance:** country-specific permissions and restrictions.

A listing has one primary classification node. It may have multiple search tags, but tags must not replace classification.

## Design rules

1. Use a flexible parent-child hierarchy; do not assume every branch has exactly four levels.
2. Give nodes permanent machine IDs. Display names and translations may change without changing IDs.
3. Classify by what the item is, not the seller's industry, sales channel or every possible use.
4. Keep brand, model, variant, size, colour and condition separate from product type.
5. Use type-specific attributes. Reuse common attribute definitions (colour, material, size, condition, weight, capacity, location) where their meaning is the same.
6. Keep the seller form short: essential fields first; recommended and advanced fields progressively disclosed.
7. Store measurement value and unit; normalise units for search and comparison while retaining the seller's entered unit.
8. Use local names and synonyms as search aliases, not as duplicate categories.
9. Separate classification from regulatory approval. A correctly classified medicine is not automatically legal to list or sell.
10. Never let AI invent missing facts. AI suggests; sellers confirm; deterministic server-side rules validate.
11. Preserve taxonomy versions and listing classification history.
12. Do not publish unclassified or non-compliant listings. Private drafts may be saved separately.

## Listing kinds

| Code | Kind | Typical transaction |
|---|---|---|
| physical_product | Physical product | Buy, wholesale, bulk order |
| service | Service | Request, book, quote, pay |
| digital_product | Digital product | Download, licence, subscription |
| rental | Rental / hire | Reserve by time, deposit, hire fee |
| rfq | Request for quotation | Buyer specifies need; suppliers quote |

The listing kind is independent of category. For example, a tractor can be a physical product or rental; the taxonomy node remains Agricultural Machinery > Tractors.

## Customer-facing main categories

The initial navigation is East Africa-oriented. These are entry points, not the complete taxonomy.

1. Agriculture & Livestock
2. Automotive & Transport
3. Building & Construction
4. Business, Office & Industrial Supplies
5. Cleaning & Facility Care
6. Education & Learning
7. Electronics & Technology
8. Energy, Solar & Electrical
9. Fashion & Clothing
10. Food & Groceries
11. Fitness & Sports
12. Home, Furniture & Household
13. Beauty & Personal Care
14. Pharmaceuticals & Healthcare
15. Animals & Veterinary
16. Tools, Machinery & Equipment
17. Raw Materials & Manufacturing
18. Books, Arts & Entertainment
19. Baby, Children & Toys
20. Digital Products & Software
21. Professional & Business Services
22. Home & Property Services
23. Wellness & Lifestyle Services
24. Transport & Logistics Services
25. Travel, Events & Experiences
26. Other / Specialist (controlled fallback; requires review)

Some navigation categories intentionally contain both products and services. The listing-kind field determines the transaction workflow. Categories such as Cleaning & Facility Care and Home & Property Services can contain consumables/equipment as well as service listings, but those listing kinds remain distinct.

## East African catalogue coverage

The accompanying `taxonomy.v1.json` provides the initial node set and starter attribute profiles. It is a practical launch taxonomy, not an attempt to enumerate every SKU or brand.

Priority local examples include:
- Agriculture: maize, beans, sorghum, millet, cassava, Irish potatoes, sweet potatoes, horticulture, livestock, poultry, animal feeds, seeds, fertiliser, crop protection, irrigation, tractors, posho mills and farm services.
- Automotive: passenger cars (sedan, hatchback, SUV, station wagon, pickup), commercial vehicles (van, minibus, bus, cargo truck, tractor unit), motorcycles, tuk-tuks, bicycles, parts, tyres, batteries, garages and transport services.
- Building: cement, steel, roofing sheets, timber, aggregates, blocks, plumbing, electrical fittings, paints, tiles, doors, windows, construction tools, builders and trades.
- Trade and household: wholesale and retail packs, second-hand/refurbished condition, local delivery, collection, bulk quantities and negotiated quotations.
- Services: cleaning, copywriting, graphic design, accounting, tutoring, repairs, construction, wellness, transport, event services and professional consulting.

Local aliases belong in the alias table (examples: maize/mahindi/corn; beans/maharagwe; panga/machete; jembe/hand hoe; boda boda/motorcycle taxi; matatu/minibus). Validate aliases with local sellers and shoppers before treating them as authoritative. Do not assume one local term means the same thing in every country.

## Attribute tiers and seller experience

- **Essential:** minimum data needed to identify and safely publish a normal listing.
- **Recommended:** improves discovery, buyer confidence and comparison.
- **Advanced:** specialist, institutional, wholesale or technical procurement details.
- **Regulatory:** required by a country's law or regulator; enforced independently of normal merchandising fields.

The mobile listing form should normally show a short first step (title, type, price/quote, quantity or service scope, location, photos). Then show a small number of essential type-specific fields. Put optional and advanced fields behind “Add more details”. Do not make every attribute mandatory.

### Examples

| Type | Short seller form | Additional / specialist details |
|---|---|---|
| Maize grain | Variety, quantity, unit, price, location | Moisture, grade, harvest, packaging |
| Sedan | Make, model, year, condition, price, location | Engine, fuel, transmission, mileage, trim |
| Cargo truck | Make, model, year, payload, condition | Axles, body type, gross vehicle weight, engine |
| T-shirt | Size, colour, price, available sizes | Fabric, fit, sleeve, neckline, care |
| Cleaning service | Service scope, area, property size, price basis | Frequency, supplies included, team size, insurance |
| Copywriting | Content type, language, word count, delivery time | Audience, tone, revisions, specialist subject |

## Search, similar products and comparison

- Hard-filter by compatible leaf product/service type before ranking.
- Do not mix incompatible siblings (e.g. sedan and cargo truck; T-shirt and formal shirt).
- Allow broader category discovery separately from strict “similar products”.
- Rank within compatible types using relevant attributes, brand/model where appropriate, price, location, condition, availability and seller diversity.
- Comparison tables should show only attributes relevant to the selected type; show units and missing values clearly.
- Use explicit compatibility groups only where there is a sound commercial reason (e.g. selected passenger vehicle body styles in a broad discovery mode). Do not treat them as equivalent for precise comparison.

## Database direction (proposal only)

Do not replace the existing `products` table or its current `category` and `attributes` fields in one step. Introduce a parallel, versioned taxonomy and migrate gradually.

| Proposed table | Purpose |
|---|---|
| taxonomy_versions | Published taxonomy versions and status |
| taxonomy_nodes | Main categories, subcategories and leaf product/service types |
| taxonomy_aliases | Local names, spelling variants, synonyms and language |
| attribute_definitions | Reusable typed attribute definitions and units |
| taxonomy_node_attributes | Required/recommended/advanced attributes per type |
| attribute_allowed_values | Controlled values for select/multi-select fields |
| taxonomy_external_mappings | GS1 GPC, UNSPSC and other crosswalk codes |
| listing_classifications | Listing-to-node assignment, version, source, confidence and review state |
| listing_attribute_values | Typed attribute values for a listing |
| listing_compliance | Country-specific checks, evidence, expiry and decision history |
| listing_offers | Buy, wholesale, rental, booking and RFQ terms where separate offers are needed |

Recommended node fields: stable `code`, `parent_id`, `node_kind`, `listing_kind` (where applicable), `name_en`, `description`, `is_leaf`, `status`, `sort_order`, `taxonomy_version_id`, `created_at`, `updated_at`.

Recommended attribute definition fields: stable `code`, label, data type, unit family, allowed values, validation constraints, filterable flag, comparable flag and sensitivity/compliance marker.

Use UUID primary keys plus stable human-readable codes. Avoid using display labels as database keys. Use a controlled set of measurement units with conversion factors. Keep original entered values for display and audit.

### Migration approach

1. Add taxonomy tables and seed the approved taxonomy; do not alter public product behaviour yet.
2. Add nullable `taxonomy_node_id` and `listing_kind` to listings only after schema review.
3. Keep old `category` and JSONB `attributes` during transition.
4. Classify existing listings in batches; uncertain items remain review-needed.
5. Update Add/Edit listing to write both old and new fields during a short compatibility period.
6. Move search, Similar Products and Auto Compare to taxonomy-aware matching after data quality is adequate.
7. Retire old category strings only after usage and migration checks.

## Classification agent and publication gate

The agent returns structured suggestions: listing kind, taxonomy node, confidence, extracted attributes, missing required fields, contradictions, duplicate candidates and country-specific compliance flags.

Outcomes:
- `approved`: seller confirmation and deterministic checks passed.
- `needs_correction`: missing or contradictory information.
- `manual_review`: low confidence, suspicious content or regulated listing requiring review.

The agent must not make final regulatory decisions or fabricate facts. Server-side validation is authoritative. Store agent/model version, taxonomy version, input summary, output, reviewer and timestamps for audit. If AI is unavailable, manual selection plus deterministic validation remains available.

## Pharmaceuticals and other regulated categories

Regulation is a separate country layer, not just another attribute. For Kenya, pharmaceutical/health listings must be checked against applicable Pharmacy and Poisons Board requirements and relevant official registers. Other countries need their own regulator configuration. Seller licensing, premises authorisation, product registration, prescription status, recalls, storage and expiry requirements must be enforced as applicable. Some products/services must be blocked from online sale or restricted to eligible licensed sellers.

Do not enable medicine transactions merely because the taxonomy node exists. Launch regulated categories only after country-specific legal and operational rules have been reviewed.

## Governance and versioning

- Taxonomy version uses semantic versioning: patch for spelling/alias corrections; minor for additive nodes/attributes; major for breaking moves or meaning changes.
- Never delete a node used by listings; deprecate it and provide a replacement mapping.
- Taxonomy changes require an admin proposal, impact preview, approval and audit log.
- Maintain a country/locale overlay for names, aliases, units, required attributes and legal rules.
- Review “Other” listings regularly and promote recurring patterns into proper nodes.
- Keep taxonomy administration separate from ordinary seller permissions.

## International interoperability

Use external mappings as crosswalks, not as the customer-facing navigation:
- **GS1 GPC:** product grouping and global trade data interoperability.
- **UNSPSC:** products and services, especially procurement and institutional buyers.
- **Shopify Standard Product Taxonomy:** practical category/attribute design and marketplace integration reference.

Store the external scheme name, release/version, external code and mapping confidence. A mapping may be one-to-many or unresolved; never force an inaccurate code.

## Acceptance criteria for v1

- Every active listing has one primary taxonomy node and a listing kind before public publication.
- A seller can complete a basic listing on a mobile phone without filling advanced fields.
- Similar Products and Auto Compare never mix incompatible leaf types.
- Attribute filters and comparison fields are defined per leaf type.
- Aliases improve search without creating duplicate category nodes.
- Country compliance can block or restrict a listing independently of classification.
- Admins can add nodes and attribute definitions without a frontend code release.
- Existing product rows and their current attributes remain intact during migration.

## Research references

- Shopify Standard Product Taxonomy and category metafields: https://help.shopify.com/en/manual/products/details/product-category
- Shopify taxonomy source and mappings: https://github.com/Shopify/product-taxonomy
- Shopify taxonomy GraphQL model: https://shopify.dev/docs/api/admin-graphql/latest/objects/taxonomycategory
- GS1 GPC: https://www.gs1.org/standards/gpc
- GS1 GPC principles: https://support.gs1.org/support/solutions/articles/43000733391-what-are-the-gpc-hierarchy-principles-
- UNSPSC: https://www.undp.org/unspsc
- Kenya Pharmacy and Poisons Board product registers: https://ppb.go.ke/products

---
This document is a design baseline. It is not a legal opinion, a complete regulator checklist, or authorisation to activate regulated sales.
