// Reusable, database-independent shopping vocabulary for Asha.
// Add synonyms and spelling variants here; marketplace taxonomy aliases extend it at runtime.
const WORD_FIXES = {
  redd: 'red', reeed: 'red', blu: 'blue', blak: 'black', whte: 'white', wite: 'white', yelow: 'yellow', greay: 'grey',
  colur: 'color', colour: 'color', tshirt: 'shirt', tshirts: 'shirt', 'tee shirt': 'shirt',
  motercycle: 'motorcycle', motocycle: 'motorcycle', motorbike: 'motorcycle',
  refridgerator: 'refrigerator', refrigirator: 'refrigerator', refri: 'refrigerator',
  celphone: 'phone', cellphone: 'phone', handphone: 'phone', mobil: 'mobile',
  lapto: 'laptop', labtop: 'laptop', computor: 'computer', televsion: 'television',
  furnitures: 'furniture', matress: 'mattress', matresses: 'mattress',
  sneekers: 'sneakers', snickers: 'sneakers', trouser: 'trousers',
  sunglass: 'sunglasses', sunshade: 'sunglasses', jewellry: 'jewellery',
  accesory: 'accessory', accesories: 'accessories', accesories: 'accessories',
  bagpack: 'backpack', backpak: 'backpack', lory: 'lorry', trak: 'truck', truc: 'truck', truk: 'truck'
};
const COLOR_WORDS = { white: ['white','whte','wite'], black: ['black','blak','blk'], red: ['red','redd','reeed'], blue: ['blue','blu'], green: ['green'], yellow: ['yellow','yelow'], brown: ['brown'], pink: ['pink'], grey: ['grey','gray','greay'], orange: ['orange'], purple: ['purple'] };
const SEARCH_SYNONYMS = {
  car: ['car','cars','automobile','automobiles','motor vehicle','sedan','sedans','saloon','suv','suvs','hatchback','hatchbacks','station wagon','estate car','coupe','convertible','pickup','pickups'],
  truck: ['truck','trucks','lorry','lorries','cargo truck','tipper truck','dump truck','refrigerated truck','tractor unit'],
  bus: ['bus','buses','coach','minibus','matatu','shuttle'],
  tractor: ['tractor','tractors','farm tractor'],
  motorcycle: ['motorcycle','motorcycles','motorbike','motorbikes','boda boda','boda','scooter'],
  bicycle: ['bicycle','bicycles','bike','bikes','mountain bike'],
  phone: ['phone','phones','mobile','mobiles','smartphone','smartphones','cellphone','cell phone','handset'],
  laptop: ['laptop','laptops','notebook','notebooks'],
  computer: ['computer','computers','desktop','desktops','pc'],
  television: ['television','televisions','tv','tvs','smart tv'],
  refrigerator: ['refrigerator','fridge','freezer','deep freezer'],
  shirt: ['shirt','shirts','t-shirt','t-shirts','tee','tees','polo shirt'],
  shoe: ['shoe','shoes','footwear','sneaker','sneakers','trainer','trainers','boots','sandals','heels','flats'],
  dress: ['dress','dresses','gown','gowns'],
  trouser: ['trouser','trousers','pants','jeans','slacks'],
  skirt: ['skirt','skirts'],
  jacket: ['jacket','jackets','coat','coats'],
  bag: ['bag','bags','handbag','handbags','purse','purses'],
  backpack: ['backpack','backpacks','rucksack','school bag'],
  bed: ['bed','beds','bunk bed','bunk beds'],
  mattress: ['mattress','mattresses'],
  sofa: ['sofa','sofas','couch','couches','settee'],
  chair: ['chair','chairs','stool','stools'],
  table: ['table','tables','desk','desks'],
  furniture: ['furniture','furnishing'],
  watch: ['watch','watches','wristwatch','wristwatches'],
  jewellery: ['jewellery','jewelry','necklace','necklaces','bracelet','bracelets','earring','earrings','ring','rings'],
  cosmetic: ['cosmetic','cosmetics','makeup','make-up','beauty products','skincare','skin care'],
  appliance: ['appliance','appliances','home appliance','kitchen appliance'],
  camera: ['camera','cameras','photography camera'],
  speaker: ['speaker','speakers','loudspeaker','sound system'],
  tool: ['tool','tools','power tool','power tools'],
  cement: ['cement','cement bags'],
  food: ['food','groceries','grocery','foodstuff','foodstuffs']
};
const STOP_WORDS = new Set(['a','an','the','some','any','me','for','please','show','find','get','looking','want','need','give','of','to','with','and']);
function normalizeWord(word) {
  let value = String(word || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
  value = WORD_FIXES[value] || value;
  if (value.endsWith('ies') && value.length > 4) value = value.slice(0, -3) + 'y';
  else if (value.endsWith('es') && /(sh|ch|ss|x|z)es$/.test(value)) value = value.slice(0, -2);
  else if (value.endsWith('s') && !/(ss|us|is)$/.test(value) && value.length > 3) value = value.slice(0, -1);
  return value;
}
function searchGroups(query) {
  const raw = String(query || '').toLowerCase().trim();
  const phraseKey = normalizeWord(raw);
  const phraseCanonical = SYNONYM_CANONICAL.get(phraseKey);
  if (phraseCanonical && SEARCH_SYNONYMS[phraseCanonical]) return [SEARCH_SYNONYMS[phraseCanonical]];
  return raw.split(/\s+/).filter(Boolean).map(normalizeWord)
    .filter(word => word && !STOP_WORDS.has(word))
    .map(word => SEARCH_SYNONYMS[word] || SEARCH_SYNONYMS[SYNONYM_CANONICAL.get(word)] || [word, word + 's']);
}
const SYNONYM_CANONICAL = new Map(Object.entries(SEARCH_SYNONYMS).flatMap(([canonical, variants]) => variants.map(variant => [normalizeWord(variant), canonical])));

function searchGroups(query) {
  const raw = String(query || '').toLowerCase().trim();
  const phraseKey = normalizeWord(raw);
  const phraseCanonical = SYNONYM_CANONICAL.get(phraseKey);
  if (phraseCanonical && SEARCH_SYNONYMS[phraseCanonical]) return [SEARCH_SYNONYMS[phraseCanonical]];
  return raw.split(/\\s+/).filter(Boolean).map(normalizeWord)
    .filter(word => word && !STOP_WORDS.has(word))
    .map(word => SEARCH_SYNONYMS[word] || SEARCH_SYNONYMS[SYNONYM_CANONICAL.get(word)] || [word, word + 's']);
}

module.exports = { WORD_FIXES, COLOR_WORDS, SEARCH_SYNONYMS, STOP_WORDS, normalizeWord, searchGroups };
