-- Idempotent Asha search-test catalogue. All image paths below were verified
-- in the public "images" bucket before seeding. Existing marketplace listings
-- are retained; only new EAO Search Test listings are inserted.
with seed(title, description, price, category, taxonomy_node_id, image_path, listing_kind, attributes) as (
 values
 -- Vehicles: a deliberate spread of years, body types, colours and price points.
 ('EAO Test Car | Toyota Premio 2014','Sample used white Toyota Premio sedan for Asha search testing.',1450000,'Automotive & Transport','automotive-transport.passenger-vehicles.sedan','seed/auto/auto_toyota_premio_sedan_white.jpg','physical_product','{"year":2014,"make":"Toyota","model":"Premio","body_type":"sedan","color":"white","fuel_type":"petrol","transmission":"automatic","mileage_km":98000}'::jsonb),
 ('EAO Test Car | Toyota Axio 2015','Sample used silver Toyota Axio sedan.',1320000,'Automotive & Transport','automotive-transport.passenger-vehicles.sedan','seed/auto/auto_toyota_axio_sedan.jpg','physical_product','{"year":2015,"make":"Toyota","model":"Axio","body_type":"sedan","color":"silver","fuel_type":"petrol","transmission":"automatic","mileage_km":87000}'::jsonb),
 ('EAO Test Car | Mazda Axela 2013','Sample used blue Mazda Axela sedan.',1180000,'Automotive & Transport','automotive-transport.passenger-vehicles.sedan','seed/auto/auto_mazda_axela_sedan.jpg','physical_product','{"year":2013,"make":"Mazda","model":"Axela","body_type":"sedan","color":"blue","fuel_type":"petrol","transmission":"automatic","mileage_km":112000}'::jsonb),
 ('EAO Test Car | Nissan Tiida 2012','Sample used grey Nissan Tiida sedan.',790000,'Automotive & Transport','automotive-transport.passenger-vehicles.sedan','seed/auto/auto_nissan_tiida_sedan.jpg','physical_product','{"year":2012,"make":"Nissan","model":"Tiida","body_type":"sedan","color":"grey","fuel_type":"petrol","transmission":"automatic","mileage_km":136000}'::jsonb),
 ('EAO Test Car | Toyota Crown 2016','Sample used black Toyota Crown sedan.',2850000,'Automotive & Transport','automotive-transport.passenger-vehicles.sedan','seed/auto/auto_toyota_crown_sedan.jpg','physical_product','{"year":2016,"make":"Toyota","model":"Crown","body_type":"sedan","color":"black","fuel_type":"petrol","transmission":"automatic","mileage_km":76000}'::jsonb),
 ('EAO Test Car | Toyota Allion 2014','Sample used pearl Toyota Allion sedan.',1250000,'Automotive & Transport','automotive-transport.passenger-vehicles.sedan','seed/auto/auto_toyota_allion_sedan.jpg','physical_product','{"year":2014,"make":"Toyota","model":"Allion","body_type":"sedan","color":"white","fuel_type":"petrol","transmission":"automatic","mileage_km":101000}'::jsonb),
 ('EAO Test SUV | Toyota Prado 2013','Sample used Toyota Land Cruiser Prado SUV.',3650000,'Automotive & Transport','automotive-transport.passenger-vehicles.suv','seed/auto/auto_toyota_land_cruiser_prado.jpg','physical_product','{"year":2013,"make":"Toyota","model":"Land Cruiser Prado","body_type":"suv","color":"silver","fuel_type":"diesel","transmission":"automatic","mileage_km":145000}'::jsonb),
 ('EAO Test SUV | Toyota Land Cruiser V8 2015','Sample used Toyota Land Cruiser V8 SUV.',6900000,'Automotive & Transport','automotive-transport.passenger-vehicles.suv','seed/auto/auto_toyota_land_cruiser_v8.jpg','physical_product','{"year":2015,"make":"Toyota","model":"Land Cruiser V8","body_type":"suv","color":"black","fuel_type":"diesel","transmission":"automatic","mileage_km":93000}'::jsonb),
 ('EAO Test SUV | Toyota Harrier 2014','Sample used Toyota Harrier SUV.',2250000,'Automotive & Transport','automotive-transport.passenger-vehicles.suv','seed/auto/auto_toyota_harrier_suv.jpg','physical_product','{"year":2014,"make":"Toyota","model":"Harrier","body_type":"suv","color":"white","fuel_type":"petrol","transmission":"automatic","mileage_km":108000}'::jsonb),
 ('EAO Test SUV | Honda CR-V 2016','Sample used Honda CR-V SUV.',2450000,'Automotive & Transport','automotive-transport.passenger-vehicles.suv','seed/auto/auto_honda_cr_v_suv.jpg','physical_product','{"year":2016,"make":"Honda","model":"CR-V","body_type":"suv","color":"grey","fuel_type":"petrol","transmission":"automatic","mileage_km":88000}'::jsonb),
 ('EAO Test SUV | Nissan X-Trail 2015','Sample used Nissan X-Trail SUV.',1980000,'Automotive & Transport','automotive-transport.passenger-vehicles.suv','seed/auto/auto_nissan_x_trail_suv.jpg','physical_product','{"year":2015,"make":"Nissan","model":"X-Trail","body_type":"suv","color":"black","fuel_type":"petrol","transmission":"automatic","mileage_km":97000}'::jsonb),
 ('EAO Test SUV | Subaru Forester 2012','Sample used Subaru Forester SUV.',1120000,'Automotive & Transport','automotive-transport.passenger-vehicles.suv','seed/auto/auto_subaru_forester_suv.jpg','physical_product','{"year":2012,"make":"Subaru","model":"Forester","body_type":"suv","color":"green","fuel_type":"petrol","transmission":"automatic","mileage_km":154000}'::jsonb),
 ('EAO Test SUV | Mazda CX-5 2017','Sample used Mazda CX-5 SUV.',2780000,'Automotive & Transport','automotive-transport.passenger-vehicles.suv','seed/auto/auto_mazda_cx_5_suv.jpg','physical_product','{"year":2017,"make":"Mazda","model":"CX-5","body_type":"suv","color":"red","fuel_type":"petrol","transmission":"automatic","mileage_km":71000}'::jsonb),
 ('EAO Test SUV | Mitsubishi Pajero 2013','Sample used Mitsubishi Pajero SUV.',2150000,'Automotive & Transport','automotive-transport.passenger-vehicles.suv','seed/auto/auto_mitsubishi_pajero_suv.jpg','physical_product','{"year":2013,"make":"Mitsubishi","model":"Pajero","body_type":"suv","color":"silver","fuel_type":"diesel","transmission":"automatic","mileage_km":132000}'::jsonb),
 ('EAO Test Pickup | Ford Ranger 2016','Sample used Ford Ranger double-cab pickup.',2650000,'Automotive & Transport','automotive-transport.passenger-vehicles.pickup','seed/auto/auto_ford_ranger_pickup.jpg','physical_product','{"year":2016,"make":"Ford","model":"Ranger","body_type":"pickup","color":"white","fuel_type":"diesel","transmission":"manual","mileage_km":89000}'::jsonb),
 ('EAO Test Pickup | Toyota Hilux 2014','Sample used Toyota Hilux pickup.',2350000,'Automotive & Transport','automotive-transport.passenger-vehicles.pickup','seed/auto/auto_toyota_hilux_pickup_truck.jpg','physical_product','{"year":2014,"make":"Toyota","model":"Hilux","body_type":"pickup","color":"white","fuel_type":"diesel","transmission":"manual","mileage_km":118000}'::jsonb),
 ('EAO Test Pickup | Isuzu D-Max 2013','Sample used Isuzu D-Max pickup.',1950000,'Automotive & Transport','automotive-transport.passenger-vehicles.pickup','seed/auto/auto_isuzu_d_max_pickup.jpg','physical_product','{"year":2013,"make":"Isuzu","model":"D-Max","body_type":"pickup","color":"blue","fuel_type":"diesel","transmission":"manual","mileage_km":142000}'::jsonb),
 ('EAO Test Van | Toyota Hiace 2015','Sample used Toyota Hiace passenger van.',2250000,'Automotive & Transport','automotive-transport.commercial-vehicles.delivery-van','seed/auto/auto_toyota_hiace_van.jpg','physical_product','{"year":2015,"make":"Toyota","model":"Hiace","body_type":"van","color":"white","fuel_type":"diesel","transmission":"manual","mileage_km":123000}'::jsonb),
 ('EAO Test Bus | Toyota Coaster 2012','Sample used Toyota Coaster bus.',3200000,'Automotive & Transport','automotive-transport.commercial-vehicles.bus','seed/auto/auto_toyota_coaster_bus.jpg','physical_product','{"year":2012,"make":"Toyota","model":"Coaster","body_type":"bus","color":"white","fuel_type":"diesel","transmission":"manual","mileage_km":180000}'::jsonb),
 ('EAO Test Truck | Hino 300 2014','Sample used Hino 300 light truck.',2850000,'Automotive & Transport','automotive-transport.commercial-vehicles.cargo-truck','seed/auto/auto_hino_300_truck.jpg','physical_product','{"year":2014,"make":"Hino","model":"300","body_type":"truck","color":"white","fuel_type":"diesel","transmission":"manual","mileage_km":162000}'::jsonb),
 -- Other departments: images are category-specific and stored in the images bucket.
 ('EAO Test | Maize Grain 90kg','Sample bag of maize grain.',4200,'Agriculture & Livestock','agriculture-livestock.crops-produce.maize-grain','seed/agriculture_seeds.jpg','physical_product','{"weight_kg":90,"condition":"new"}'::jsonb),
 ('EAO Test | Cat','Sample domestic cat listing.',6500,'Animals & Veterinary','animals-veterinary.pets.cat','seed/n-e5c1b238-5a68-4da3-b2c6-6515181c2c58.jpg','physical_product','{"animal":"cat","age_months":8}'::jsonb),
 ('EAO Test | Baby Clothing Set','Sample baby clothing set.',1800,'Baby, Children & Toys','baby-children-toys.baby-care.baby-clothing','seed/kids_dress.jpg','physical_product','{"age_group":"0-12 months","material":"cotton"}'::jsonb),
 ('EAO Test | Daily Skincare Set','Sample skincare product set.',2400,'Beauty & Personal Care','beauty-personal-care.beauty-products.skincare','seed/beauty_skincare.jpg','physical_product','{"skin_type":"all"}'::jsonb),
 ('EAO Test | Makeup Kit','Sample cosmetics and makeup kit.',3200,'Beauty & Personal Care','beauty-personal-care.beauty-products.makeup','seed/beauty_cosmetics.jpg','physical_product','{"type":"makeup kit"}'::jsonb),
 ('EAO Test | Musk Perfume 100ml','Sample fragrance bottle.',2800,'Beauty & Personal Care','beauty-personal-care.beauty-products.fragrance','seed/perfume_musk.jpg','physical_product','{"volume_ml":100,"scent":"musk"}'::jsonb),
 ('EAO Test | Fiction Book','Sample paperback fiction book.',950,'Books, Arts & Entertainment','books-arts-entertainment.books-media.fiction-book','seed/books_education.jpg','physical_product','{"format":"paperback"}'::jsonb),
 ('EAO Test | Cement 50kg','Sample 50kg cement bag.',850,'Building & Construction','building-construction.building-materials.cement','seed/n-4774eff5-f9de-4dee-a595-330bf312e36f.jpg','physical_product','{"weight_kg":50,"condition":"new"}'::jsonb),
 ('EAO Test | Office Paper Ream','Sample A4 office paper ream.',650,'Business, Office & Industrial Supplies','business-office-industrial.office-supplies.paper','seed/books_education.jpg','physical_product','{"paper_size":"A4","sheets":500}'::jsonb),
 ('EAO Test | Software Licence','Sample downloadable software licence.',3500,'Digital Products & Software','digital-products.software-subscriptions.downloadable-software-license','seed/electronics_laptop.jpg','digital_product','{"delivery":"digital"}'::jsonb),
 ('EAO Test | School Textbook','Sample school textbook.',1200,'Education & Learning','education-learning.learning-materials.textbook','seed/books_education.jpg','physical_product','{"format":"paperback"}'::jsonb),
 ('EAO Test | Android Smartphone','Sample Android smartphone.',18500,'Electronics & Technology','electronics-technology.phones-computers.smartphone','seed/electronics_phone.jpg','physical_product','{"brand":"Tecno","storage_gb":128,"ram_gb":8,"color":"black"}'::jsonb),
 ('EAO Test | Laptop Computer','Sample laptop computer.',58000,'Electronics & Technology','electronics-technology.phones-computers.laptop','seed/electronics_laptop.jpg','physical_product','{"ram_gb":16,"storage_gb":512,"processor":"Core i5"}'::jsonb),
 ('EAO Test | Solar Panel 200W','Sample 200W solar panel.',14500,'Energy, Solar & Electrical','energy-electrical.solar.solar-panel','seed/solar_panel.jpg','physical_product','{"power_w":200,"condition":"new"}'::jsonb),
 ('EAO Test | Men''s Formal Shirt','Sample men''s formal shirt.',1800,'Fashion & Clothing','fashion-clothing.tops.formal-shirt','seed/shirt_men.jpg','physical_product','{"size":"L","color":"blue","material":"cotton"}'::jsonb),
 ('EAO Test | Football Jersey','Sample football jersey.',1600,'Fitness & Sports','fitness-sports.sportswear.sports-jersey','seed/sports_jersey.jpg','physical_product','{"size":"L","sport":"football"}'::jsonb),
 ('EAO Test | Pure Honey 500g','Sample jar of pure honey.',950,'Agriculture & Livestock','agriculture-livestock.animal-products.honey','seed/food_honey.jpg','physical_product','{"weight_g":500,"type":"pure honey"}'::jsonb),
 ('EAO Test | Coffee Beans 500g','Sample coffee beans pack.',1250,'Food & Groceries','food-groceries.drinks-coffee-tea.coffee','seed/food_coffee.jpg','physical_product','{"weight_g":500,"roast":"medium"}'::jsonb),
 ('EAO Test | African Spice Mix','Sample East African spice mix.',450,'Food & Groceries','food-groceries.spices-seasonings.spices','seed/food_spices.jpg','physical_product','{"weight_g":200,"origin":"East Africa"}'::jsonb),
 ('EAO Test | Wooden Dining Chair','Sample wooden dining chair.',4800,'Home, Furniture & Household','home-household.furniture.chair','seed/furniture_chair.jpg','physical_product','{"material":"wood","seats":1}'::jsonb),
 ('EAO Test | Dining Table','Sample wooden dining table.',12500,'Home, Furniture & Household','home-household.furniture.dining-table','seed/furniture_table.jpg','physical_product','{"material":"wood","seats":6}'::jsonb),
 ('EAO Test | Handmade Sisal Basket','Sample handwoven sisal basket.',2200,'Other / Specialist','other-specialist.handicrafts.woven-basket','seed/handicrafts_basket.jpg','physical_product','{"material":"sisal","handmade":true}'::jsonb),
 ('EAO Test | Agricultural Hand Tools','Sample agricultural hand tool set.',1900,'Tools, Machinery & Equipment','tools-machinery.hand-tools.hammer','seed/agriculture_tools.jpg','physical_product','{"set_size":3,"condition":"new"}'::jsonb),
 ('EAO Test | Local Courier Service','Sample local parcel courier service listing.',500,'Transport & Logistics Services','transport-logistics-services.delivery.local-courier','seed/auto/auto_toyota_hiace_van.jpg','service','{"service_area":"Nairobi","delivery_type":"local"}'::jsonb),
 ('EAO Test | Tour Guide Service','Sample guided local tour service listing.',2500,'Travel, Events & Experiences','travel-events-experiences.travel.tour-guide','seed/auto/auto_toyota_coaster_bus.jpg','service','{"service_area":"Nairobi","group_size":6}'::jsonb),
 ('EAO Test | Yoga Instruction','Sample yoga instruction service listing.',1500,'Wellness & Lifestyle Services','wellness-lifestyle.wellness.yoga-instruction','seed/sports_equipment.jpg','service','{"session_minutes":60,"format":"group"}'::jsonb)
),
resolved as (
 select s.* from seed s
 join public.marketplace_taxonomy_nodes n on n.id=s.taxonomy_node_id and n.node_kind='product_type' and n.is_active
 where exists (select 1 from storage.objects o where o.bucket_id='images' and o.name=s.image_path)
),
inserted as (
 insert into public.products
   (user_id,title,description,price,category,county,product_status,available_quantity,
    listing_kind,taxonomy_node_id,classification_status,storage_path,attributes)
 select
   'ad9fee5e-1950-4a63-b7df-4215f96f8fc4'::uuid,
   r.title,r.description,r.price,r.category,'Nairobi','published',case when r.listing_kind='physical_product' then 4 else 1 end,
   r.listing_kind,r.taxonomy_node_id,'approved',r.image_path,r.attributes
 from resolved r
 where not exists (select 1 from public.products p where p.title=r.title)
 returning id,storage_path
)
insert into public.product_images(product_id,storage_path,is_main,display_order)
select id,storage_path,true,0 from inserted;

-- Correct several obviously mismatched legacy sample images using already uploaded
-- category-specific images. Both image references are kept in sync.
with image_fixes(title,image_path) as (
 values
 ('Sedan - EAO Sample 009','seed/auto/auto_toyota_premio_sedan_white.jpg'),
 ('Hatchback - EAO Sample 010','seed/auto/auto_honda_fit_hatchback.jpg'),
 ('Station Wagon - EAO Sample 011','seed/auto/auto_toyota_probox_station_wagon.jpg'),
 ('Suv - EAO Sample 012','seed/auto/auto_toyota_rav4_suv.jpg'),
 ('Nappy Diaper - EAO Sample 014','seed/kids_dress.jpg'),
 ('Haircare - EAO Sample 019','seed/beauty_skincare2.jpg'),
 ('Fragrance - EAO Sample 020','seed/perfume_musk.jpg'),
 ('Nonfiction Book - EAO Sample 022','seed/books_education.jpg'),
 ('Roofing Sheets - EAO Sample 028','seed/n-4774eff5-f9de-4dee-a595-330bf312e36f.jpg'),
 ('Pens Pencils - EAO Sample 030','seed/books_education.jpg'),
 ('Smartphone - EAO Sample 045','seed/electronics_phone.jpg'),
 ('Formal Shirt - EAO Sample 055','seed/shirt_men.jpg'),
 ('Bed - EAO Sample 070','seed/furniture_chair.jpg')
),
updated as (
 update public.products p set storage_path=f.image_path,updated_at=now()
 from image_fixes f
 where p.title=f.title and exists(select 1 from storage.objects o where o.bucket_id='images' and o.name=f.image_path)
 returning p.id,p.storage_path
)
update public.product_images pi set storage_path=u.storage_path
from updated u where pi.product_id=u.id and pi.is_main=true;


-- Align legacy sample titles and taxonomy with the category-specific images
-- assigned above, so the displayed item name, taxonomy and image agree.
update public.products set
  title='Baby Clothing - EAO Sample 014',
  taxonomy_node_id='baby-children-toys.baby-care.baby-clothing',
  updated_at=now()
where title='Nappy Diaper - EAO Sample 014';

update public.products set
  title='Office Chair - EAO Sample 070',
  category='Business, Office & Industrial Supplies',
  taxonomy_node_id='business-office-industrial.office-furniture.office-chair',
  updated_at=now()
where title='Bed - EAO Sample 070';

update public.products set
  title='Cement - EAO Sample 028',
  taxonomy_node_id='building-construction.building-materials.cement',
  updated_at=now()
where title='Roofing Sheets - EAO Sample 028';

update public.products set
  title='School Textbook - EAO Sample 030',
  category='Education & Learning',
  taxonomy_node_id='education-learning.learning-materials.textbook',
  updated_at=now()
where title='Pens Pencils - EAO Sample 030';


-- Complete test coverage for the remaining marketplace departments. External
-- image URLs are supported by src/lib/image-utils.ts and point to subject-matched
-- product/service photography; local images remain in the Supabase images bucket.
with seed(title,description,price,category,taxonomy_node_id,image_path,listing_kind,attributes) as (
 values
 ('EAO Test | Tea Coffee Pack','Sample tea and coffee grocery pack.',650,'Food & Groceries','food-groceries.beverages.tea-coffee','seed/food_coffee.jpg','physical_product','{"pack_size":"500g"}'::jsonb),
 ('EAO Test | East African Spice Mix','Sample East African spice mix.',450,'Food & Groceries','food-groceries.staples.spices','seed/food_spices.jpg','physical_product','{"pack_size":"200g"}'::jsonb),
 ('EAO Test | Dried Beans 2kg','Sample dried beans grocery listing.',380,'Food & Groceries','food-groceries.staples.dried-beans','seed/agriculture_seeds.jpg','physical_product','{"weight_kg":2}'::jsonb),
 ('EAO Test | Laundry Detergent 1L','Sample liquid laundry detergent.',650,'Cleaning & Facility Care','cleaning-facility.cleaning-products.detergent','https://images.pexels.com/photos/5217898/pexels-photo-5217898.jpeg?cs=srgb&dl=pexels-shvetsa-5217898.jpg&fm=jpg','physical_product','{"volume_ml":1000,"type":"laundry detergent"}'::jsonb),
 ('EAO Test | Residential Property Listing','Sample residential property and real estate service listing.',5000,'Home & Property Services','home-property-services.property-services.real-estate-agency','https://phimg.reapit.website/5e85c9b0aa955ee683fc96aa8ed32d4ebd26232a','service','{"location":"Nairobi","property_type":"residential"}'::jsonb),
 ('EAO Test | Makonde Wood Sculpture','Sample hand-carved African wooden sculpture.',4800,'Other / Specialist','other-specialist.unclassified.other-product-review','https://i.ebayimg.com/00/s/MTYwMFgxNjAw/z/i8gAAOSwIF9lZ1w-/%24_12.JPG?set_id=880000500F','physical_product','{"material":"ebony wood","handmade":true}'::jsonb),
 ('EAO Test | Telehealth Consultation','Sample remote medical consultation service.',1200,'Pharmaceuticals & Healthcare','pharma-healthcare.health-services.telehealth-consultation','https://static.wixstatic.com/media/fc789b_4bce0902d1e74a1381bd2c5185d20131~mv2.jpg/v1/fill/w_980%2Ch_654%2Cal_c%2Cq_85%2Cusm_0.66_1.00_0.01%2Cenc_avif%2Cquality_auto/fc789b_4bce0902d1e74a1381bd2c5185d20131~mv2.jpg','service','{"service_type":"telehealth consultation","format":"video"}'::jsonb),
 ('EAO Test | Graphic Design Service','Sample graphic design and digital artwork service.',2500,'Professional & Business Services','professional-services.creative-services.graphic-design','https://images.pexels.com/photos/12902996/pexels-photo-12902996.jpeg?cs=srgb&dl=pexels-mizunokozuki-12902996.jpg&fm=jpg','service','{"service_type":"graphic design","delivery":"digital"}'::jsonb),
 ('EAO Test | Kitenge Fabric Roll','Sample roll of East African printed textile fabric.',12000,'Raw Materials & Manufacturing','raw-materials.textile-materials.fabric-roll','seed/kitenge_fabric.jpg','physical_product','{"material":"cotton textile","form":"fabric roll"}'::jsonb)
),
resolved as (
 select s.* from seed s
 join public.marketplace_taxonomy_nodes n on n.id=s.taxonomy_node_id and n.node_kind='product_type' and n.is_active
 where (s.image_path like 'http%' or exists(select 1 from storage.objects o where o.bucket_id='images' and o.name=s.image_path))
),
inserted as (
 insert into public.products
   (user_id,title,description,price,category,county,product_status,available_quantity,
    listing_kind,taxonomy_node_id,classification_status,storage_path,attributes)
 select
   'ad9fee5e-1950-4a63-b7df-4215f96f8fc4'::uuid,
   r.title,r.description,r.price,r.category,'Nairobi','published',
   case when r.listing_kind='physical_product' then 4 else 1 end,
   r.listing_kind,r.taxonomy_node_id,'approved',r.image_path,r.attributes
 from resolved r
 where not exists(select 1 from public.products p where p.title=r.title)
 returning id,storage_path
)
insert into public.product_images(product_id,storage_path,is_main,display_order)
select id,storage_path,true,0 from inserted;

-- Replace the old generic beauty image with a real hair-oil product photograph.
with updated as (
 update public.products
 set storage_path='https://images.pexels.com/photos/4408447/pexels-photo-4408447.jpeg?cs=srgb&dl=pexels-paula-francis-2878334-4408447.jpg&fm=jpg',
     updated_at=now()
 where title='Haircare - EAO Sample 019'
 returning id,storage_path
)
update public.product_images pi set storage_path=u.storage_path
from updated u where pi.product_id=u.id and pi.is_main=true;
