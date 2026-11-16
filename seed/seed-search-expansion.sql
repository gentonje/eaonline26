-- Idempotent expansion pack: one additional realistic search target in every major department.
-- All entries are clearly marked as test listings and reuse subject-matched images.
with seed(title,description,price,category,taxonomy_node_id,image_path,listing_kind,attributes) as (
 values
 ('EAO Search Test | Sorghum Grain 50kg','Test listing for sorghum grain in a 50kg bag.',3200,'Agriculture & Livestock','agriculture-livestock.crops-produce.sorghum','seed/p-2e3287ca-5905-4151-80e1-d3a962ae57f3.jpg','physical_product','{"weight_kg":50}'::jsonb),
 ('EAO Search Test | Family Dog','Test listing for a family dog.',8500,'Animals & Veterinary','animals-veterinary.pets.dog','seed/n-277d32fe-5169-449a-be40-951028e97a4c.jpg','physical_product','{"animal":"dog"}'::jsonb),
 ('EAO Search Test | Toyota Vitz 2016','Test used Toyota Vitz hatchback, 2016 model.',980000,'Automotive & Transport','automotive-transport.passenger-vehicles.hatchback','seed/auto/auto_toyota_vitz_hatchback.jpg','physical_product','{"year":2016,"make":"Toyota","model":"Vitz","body_type":"hatchback","color":"silver"}'::jsonb),
 ('EAO Search Test | Baby Clothing Pack','Test cotton clothing pack for infants.',1400,'Baby, Children & Toys','baby-children-toys.baby-care.baby-clothing','seed/kids_dress.jpg','physical_product','{"age_group":"0-12 months","material":"cotton"}'::jsonb),
 ('EAO Search Test | Hair Oil Treatment','Test hair oil and care treatment product.',950,'Beauty & Personal Care','beauty-personal-care.beauty-products.haircare','https://images.pexels.com/photos/4408447/pexels-photo-4408447.jpeg?cs=srgb&dl=pexels-paula-francis-2878334-4408447.jpg&fm=jpg','physical_product','{"type":"hair oil"}'::jsonb),
 ('EAO Search Test | Novel Paperback','Test paperback novel.',780,'Books, Arts & Entertainment','books-arts-entertainment.books-media.fiction-book','seed/books_education.jpg','physical_product','{"format":"paperback"}'::jsonb),
 ('EAO Search Test | Cement Bag 50kg','Test 50kg cement bag for construction.',900,'Building & Construction','building-construction.building-materials.cement','seed/n-4774eff5-f9de-4dee-a595-330bf312e36f.jpg','physical_product','{"weight_kg":50}'::jsonb),
 ('EAO Search Test | Office Chair','Test ergonomic office chair.',7200,'Business, Office & Industrial Supplies','business-office-industrial.office-furniture.office-chair','seed/furniture_chair.jpg','physical_product','{"type":"office chair"}'::jsonb),
 ('EAO Search Test | Laundry Detergent','Test household laundry detergent.',650,'Cleaning & Facility Care','cleaning-facility.cleaning-products.detergent','https://images.pexels.com/photos/5217898/pexels-photo-5217898.jpeg?cs=srgb&dl=pexels-shvetsa-5217898.jpg&fm=jpg','physical_product','{"volume_ml":1000}'::jsonb),
 ('EAO Search Test | Office Software Licence','Test downloadable software licence.',2400,'Digital Products & Software','digital-products.software-subscriptions.downloadable-software-license','seed/electronics_laptop.jpg','digital_product','{"delivery":"digital"}'::jsonb),
 ('EAO Search Test | Mathematics Textbook','Test secondary school mathematics textbook.',1100,'Education & Learning','education-learning.learning-materials.textbook','seed/books_education.jpg','physical_product','{"subject":"mathematics","format":"paperback"}'::jsonb),
 ('EAO Search Test | Android Smartphone 128GB','Test Android smartphone with 128GB storage.',18900,'Electronics & Technology','electronics-technology.phones-computers.smartphone','seed/electronics_phone.jpg','physical_product','{"brand":"Tecno","storage_gb":128,"color":"black"}'::jsonb),
 ('EAO Search Test | Solar Panel 200W','Test 200W solar panel.',14500,'Energy, Solar & Electrical','energy-electrical.solar.solar-panel','seed/solar_panel.jpg','physical_product','{"power_w":200}'::jsonb),
 ('EAO Search Test | Men Formal Shirt','Test cotton formal shirt for men.',1900,'Fashion & Clothing','fashion-clothing.tops.formal-shirt','seed/shirt_men.jpg','physical_product','{"size":"L","color":"blue","material":"cotton"}'::jsonb),
 ('EAO Search Test | Dumbbell Pair 10kg','Test pair of 10kg dumbbells.',4200,'Fitness & Sports','fitness-sports.fitness-equipment.dumbbell','seed/sports_equipment.jpg','physical_product','{"weight_kg":10}'::jsonb),
 ('EAO Search Test | Dried Beans 2kg','Test dried beans grocery pack.',380,'Food & Groceries','food-groceries.staples.dried-beans','seed/agriculture_seeds.jpg','physical_product','{"weight_kg":2}'::jsonb),
 ('EAO Search Test | Property Inspection','Test property inspection service in Nairobi.',2500,'Home & Property Services','home-property-services.property-services.property-inspection','https://images.pexels.com/photos/9976121/pexels-photo-9976121.jpeg?cs=srgb&dl=pexels-jonathanborba-9976121.jpg&fm=jpg','service','{"service_area":"Nairobi"}'::jsonb),
 ('EAO Search Test | Dining Table','Test six-seater wooden dining table.',12500,'Home, Furniture & Household','home-household.furniture.dining-table','seed/furniture_table.jpg','physical_product','{"material":"wood","seats":6}'::jsonb),
 ('EAO Search Test | Hand-carved Wood Sculpture','Test handmade wooden sculpture.',4800,'Other / Specialist','other-specialist.unclassified.other-product-review','seed/wooden_carving.jpg','physical_product','{"material":"wood","handmade":true}'::jsonb),
 ('EAO Search Test | Telehealth Consultation','Test remote healthcare consultation service.',1200,'Pharmaceuticals & Healthcare','pharma-healthcare.health-services.telehealth-consultation','https://images.pexels.com/photos/8376239/pexels-photo-8376239.jpeg?cs=srgb&dl=pexels-tima-miroshnichenko-8376239.jpg&fm=jpg','service','{"format":"video"}'::jsonb),
 ('EAO Search Test | Graphic Design Service','Test graphic design service.',2500,'Professional & Business Services','professional-services.creative-services.graphic-design','https://images.pexels.com/photos/12902996/pexels-photo-12902996.jpeg?cs=srgb&dl=pexels-mizunokozuki-12902996.jpg&fm=jpg','service','{"delivery":"digital"}'::jsonb),
 ('EAO Search Test | Kitenge Fabric Roll','Test East African printed cotton fabric roll.',12000,'Raw Materials & Manufacturing','raw-materials.textile-materials.fabric-roll','seed/kitenge_fabric.jpg','physical_product','{"material":"cotton textile"}'::jsonb),
 ('EAO Search Test | Hammer Set','Test hand tool hammer set.',1500,'Tools, Machinery & Equipment','tools-machinery.hand-tools.hammer','seed/agriculture_tools.jpg','physical_product','{"set_size":2}'::jsonb),
 ('EAO Search Test | Local Courier','Test local courier and parcel delivery service.',500,'Transport & Logistics Services','transport-logistics-services.delivery.local-courier','seed/auto/auto_toyota_hiace_van.jpg','service','{"service_area":"Nairobi"}'::jsonb),
 ('EAO Search Test | Guided City Tour','Test guided city tour service.',2500,'Travel, Events & Experiences','travel-events-experiences.travel.tour-guide','seed/auto/auto_toyota_coaster_bus.jpg','service','{"service_area":"Nairobi","group_size":6}'::jsonb),
 ('EAO Search Test | Yoga Session','Test group yoga instruction session.',1500,'Wellness & Lifestyle Services','wellness-lifestyle.wellness.yoga-instruction','seed/sports_equipment.jpg','service','{"session_minutes":60}'::jsonb)
),
resolved as (
 select s.* from seed s
 join public.marketplace_taxonomy_nodes n on n.id=s.taxonomy_node_id and n.node_kind='product_type' and n.is_active
 where s.image_path like 'http%' or exists(select 1 from storage.objects o where o.bucket_id='images' and o.name=s.image_path)
),
inserted as (
 insert into public.products
 (user_id,title,description,price,category,county,product_status,available_quantity,listing_kind,taxonomy_node_id,classification_status,storage_path,attributes)
 select 'ad9fee5e-1950-4a63-b7df-4215f96f8fc4'::uuid,
 s.title,s.description,s.price,s.category,'Nairobi','published',
 case when s.listing_kind='physical_product' then 4 else 1 end,
 s.listing_kind,s.taxonomy_node_id,'approved',s.image_path,s.attributes
 from resolved s
 where not exists(select 1 from public.products p where p.title=s.title)
 returning id,storage_path
)
insert into public.product_images(product_id,storage_path,is_main,display_order)
select id,storage_path,true,0 from inserted;
