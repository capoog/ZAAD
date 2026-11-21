/**
 * Seed data for Fahm & Zaatar. Prices are in EGP here and converted to
 * piasters by the seeder.
 *
 * Photos: free Unsplash images chosen to match each dish. Where no matching
 * free photo could be verified, the dish uses a designed illustration from
 * /public/art (replace from the admin menu editor with real photos).
 */

export const unsplash = (id: string, w = 1200) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;

export const PHOTOS = {
  hero: unsplash("1599487488170-d11ec9c172f0", 2000), // skewers on charcoal, smoke
  flames: unsplash("1508615263227-c5d58c1e5821", 1600),
  interior: unsplash("1590846406792-0adc7f938f1d", 1600),
  kofta: unsplash("1603360946369-dc9bb6258143"),
  lambChops: unsplash("1615937657715-bc7b4b7962c1"),
  shishTawook: unsplash("1645696301019-35adcc18fc21"),
  mixedGrill: unsplash("1555939594-58d7cb561ad1"),
  shawarmaSpit: unsplash("1530469912745-a215c6b256ea"),
  beefShawarma: unsplash("1633321702518-7feccafb94d5"),
  shawarmaMeal: unsplash("1529006557810-274b9b2fc783"),
  meatPie: unsplash("1601000938259-9e92002320b2"),
  hummus: unsplash("1637949385162-e416fb15b2ce"),
  fries: unsplash("1630384060421-cb20d0e0649d"),
  lemonMint: unsplash("1621263764928-df1444c5e859"),
  mango: unsplash("1546173159-315724a31696"),
  water: unsplash("1523362628745-0c100150b504"),
  softDrink: unsplash("1622483767028-3f66f32aef97"),
} as const;

export const art = (slug: string) => `/art/${slug}.svg`;

export interface SeedCategory {
  slug: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  imageUrl: string;
}

export const categories: SeedCategory[] = [
  {
    slug: "grills",
    nameAr: "مشويات",
    nameEn: "Grills",
    descriptionAr: "على الفحم وبالهداوة، زي ما المشويات لازم تتعمل.",
    descriptionEn: "Slow-grilled over real charcoal, the way it should be.",
    imageUrl: PHOTOS.flames,
  },
  {
    slug: "shawarma",
    nameAr: "شاورما",
    nameEn: "Shawarma",
    descriptionAr: "شاورما شامي متتبلة من الليلة اللي قبلها.",
    descriptionEn: "Levantine shawarma, marinated overnight.",
    imageUrl: PHOTOS.shawarmaSpit,
  },
  {
    slug: "pies",
    nameAr: "فطائر",
    nameEn: "Pies & Manakish",
    descriptionAr: "عجينة طازة من الفرن على طول.",
    descriptionEn: "Fresh dough, straight from the oven.",
    imageUrl: PHOTOS.meatPie,
  },
  {
    slug: "appetizers",
    nameAr: "مقبلات وسلطات",
    nameEn: "Appetizers & Salads",
    descriptionAr: "البداية الصح لأي عزومة.",
    descriptionEn: "The right start to any feast.",
    imageUrl: PHOTOS.hummus,
  },
  {
    slug: "desserts",
    nameAr: "حلويات",
    nameEn: "Desserts",
    descriptionAr: "ختامها مسك.",
    descriptionEn: "A sweet ending.",
    imageUrl: art("nabulsi-kunafa"),
  },
  {
    slug: "drinks",
    nameAr: "مشروبات",
    nameEn: "Drinks",
    descriptionAr: "حاجة ساقعة تظبط الأكلة.",
    descriptionEn: "Something cold to go with it.",
    imageUrl: PHOTOS.lemonMint,
  },
];

export type AddonGroupSlug = "grill-extras" | "sandwich-extras" | "pie-extras" | "dip-extras" | "spicy";

export interface SeedAddonGroup {
  slug: AddonGroupSlug;
  nameAr: string;
  nameEn: string;
  minSelect: number;
  maxSelect: number | null;
  addons: { nameAr: string; nameEn: string; price: number }[];
}

export const addonGroups: SeedAddonGroup[] = [
  {
    slug: "grill-extras",
    nameAr: "إضافات",
    nameEn: "Extras",
    minSelect: 0,
    maxSelect: null,
    addons: [
      { nameAr: "صوص توم زيادة", nameEn: "Extra garlic sauce", price: 10 },
      { nameAr: "عيش زيادة", nameEn: "Extra bread", price: 10 },
    ],
  },
  {
    slug: "sandwich-extras",
    nameAr: "إضافات",
    nameEn: "Extras",
    minSelect: 0,
    maxSelect: null,
    addons: [
      { nameAr: "صوص توم زيادة", nameEn: "Extra garlic sauce", price: 10 },
      { nameAr: "جبنة زيادة", nameEn: "Extra cheese", price: 20 },
    ],
  },
  {
    slug: "pie-extras",
    nameAr: "إضافات",
    nameEn: "Extras",
    minSelect: 0,
    maxSelect: null,
    addons: [{ nameAr: "جبنة زيادة", nameEn: "Extra cheese", price: 20 }],
  },
  {
    slug: "dip-extras",
    nameAr: "إضافات",
    nameEn: "Extras",
    minSelect: 0,
    maxSelect: null,
    addons: [{ nameAr: "عيش زيادة", nameEn: "Extra bread", price: 10 }],
  },
  {
    slug: "spicy",
    nameAr: "تحبها حراقة؟",
    nameEn: "Make it spicy?",
    minSelect: 0,
    maxSelect: 1,
    addons: [{ nameAr: "حراق 🌶️", nameEn: "Spicy 🌶️", price: 0 }],
  },
];

export interface SeedItem {
  slug: string;
  category: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  price: number;
  sizes?: { nameAr: string; nameEn: string; price: number; isDefault?: boolean }[];
  imageUrl: string;
  spicy?: boolean;
  vegetarian?: boolean;
  bestSeller?: boolean;
  featured?: boolean;
  addonGroups?: AddonGroupSlug[];
}

export const items: SeedItem[] = [
  // ── Grills ───────────────────────────────────────────────────────────────
  {
    slug: "grilled-kofta",
    category: "grills",
    nameAr: "كفتة مشوية",
    nameEn: "Grilled Kofta",
    descriptionAr: "كفتة لحمة بلدي متتبلة بالبهارات الشامية ومشوية على الفحم. معاها عيش وطحينة وسلطة.",
    descriptionEn: "Beef kofta with Levantine spices, chargrilled. Served with bread, tahini and salad.",
    price: 220,
    sizes: [
      { nameAr: "ربع كيلو", nameEn: "1/4 kg", price: 220, isDefault: true },
      { nameAr: "نص كيلو", nameEn: "1/2 kg", price: 420 },
    ],
    imageUrl: PHOTOS.kofta,
    bestSeller: true,
    featured: true,
    addonGroups: ["grill-extras", "spicy"],
  },
  {
    slug: "lamb-chops",
    category: "grills",
    nameAr: "ريش ضاني",
    nameEn: "Lamb Chops",
    descriptionAr: "ريش ضاني صغير متتبلة بالروزماري والتوم، مستوية على الفحم على مهلها.",
    descriptionEn: "Young lamb chops with rosemary and garlic, slow-grilled over charcoal.",
    price: 390,
    sizes: [
      { nameAr: "ربع كيلو", nameEn: "1/4 kg", price: 390, isDefault: true },
      { nameAr: "نص كيلو", nameEn: "1/2 kg", price: 760 },
    ],
    imageUrl: PHOTOS.lambChops,
    featured: true,
    addonGroups: ["grill-extras", "spicy"],
  },
  {
    slug: "shish-tawook",
    category: "grills",
    nameAr: "شيش طاووق",
    nameEn: "Shish Tawook",
    descriptionAr: "صدور فراخ متتبلة بالزبادي والتوم والشطة، على أسياخ فوق الفحم. معاها توم وبطاطس.",
    descriptionEn: "Chicken breast marinated in yoghurt, garlic and chilli, on skewers. With toum and fries.",
    price: 210,
    imageUrl: PHOTOS.shishTawook,
    spicy: true,
    bestSeller: true,
    addonGroups: ["grill-extras", "spicy"],
  },
  {
    slug: "mixed-grill-platter",
    category: "grills",
    nameAr: "طاجن مشكل مشويات",
    nameEn: "Mixed Grill Platter (for 2)",
    descriptionAr: "كفتة وطاووق وريش ضاني في طاجن واحد، يكفي فردين. معاه عيش ومقبلات.",
    descriptionEn: "Kofta, tawook and lamb chops in one platter for two. With bread and mezze.",
    price: 650,
    imageUrl: PHOTOS.mixedGrill,
    featured: true,
    addonGroups: ["grill-extras", "spicy"],
  },
  // ── Shawarma ─────────────────────────────────────────────────────────────
  {
    slug: "chicken-shawarma-sandwich",
    category: "shawarma",
    nameAr: "ساندوتش شاورما فراخ",
    nameEn: "Chicken Shawarma Sandwich",
    descriptionAr: "شاورما فراخ على الطريقة الشامي في عيش صاج، مع توم ومخلل وبطاطس.",
    descriptionEn: "Levantine chicken shawarma in saj bread with toum, pickles and fries.",
    price: 95,
    imageUrl: PHOTOS.shawarmaSpit,
    bestSeller: true,
    addonGroups: ["sandwich-extras", "spicy"],
  },
  {
    slug: "beef-shawarma-sandwich",
    category: "shawarma",
    nameAr: "ساندوتش شاورما لحمة",
    nameEn: "Beef Shawarma Sandwich",
    descriptionAr: "شاورما لحمة متبلة بالشطة والطحينة والبقدونس، في عيش صاج سخن.",
    descriptionEn: "Spiced beef shawarma with chilli, tahini and parsley in warm saj bread.",
    price: 125,
    imageUrl: PHOTOS.beefShawarma,
    spicy: true,
    addonGroups: ["sandwich-extras", "spicy"],
  },
  {
    slug: "chicken-shawarma-arabi",
    category: "shawarma",
    nameAr: "وجبة شاورما فراخ عربي",
    nameEn: "Chicken Shawarma Arabi Meal",
    descriptionAr: "شاورما فراخ مقطعة عربي مع بطاطس وتوم ومخلل وكانز.",
    descriptionEn: "Arabi-cut chicken shawarma with fries, toum, pickles and a soft drink.",
    price: 165,
    imageUrl: PHOTOS.shawarmaMeal,
    bestSeller: true,
    featured: true,
    addonGroups: ["sandwich-extras", "spicy"],
  },
  {
    slug: "shawarma-fatteh",
    category: "shawarma",
    nameAr: "فتة شاورما",
    nameEn: "Shawarma Fatteh",
    descriptionAr: "عيش محمص وحمص وصوص زبادي بالتوم، وفوقهم شاورما فراخ وصنوبر.",
    descriptionEn: "Toasted bread, chickpeas and garlic-yoghurt, topped with chicken shawarma and pine nuts.",
    price: 150,
    imageUrl: art("shawarma-fatteh"),
    addonGroups: ["sandwich-extras", "spicy"],
  },
  // ── Pies & Manakish ──────────────────────────────────────────────────────
  {
    slug: "minced-meat-pie",
    category: "pies",
    nameAr: "فطيرة لحمة مفرومة",
    nameEn: "Minced Meat Pie",
    descriptionAr: "عجينة مقرمشة محشية لحمة مفرومة بالبصل والفلفل، طالعة من الفرن.",
    descriptionEn: "Crisp pastry stuffed with minced beef, onion and peppers, fresh from the oven.",
    price: 120,
    imageUrl: PHOTOS.meatPie,
    addonGroups: ["pie-extras", "spicy"],
  },
  {
    slug: "zaatar-manakish",
    category: "pies",
    nameAr: "مناقيش زعتر",
    nameEn: "Zaatar Manakish",
    descriptionAr: "زعتر بلدي وزيت زيتون على عجينة طرية. فطار شامي أصلي في أي وقت.",
    descriptionEn: "Wild za'atar and olive oil on soft flatbread — a Levantine classic.",
    price: 60,
    imageUrl: art("zaatar-manakish"),
    vegetarian: true,
    addonGroups: ["pie-extras"],
  },
  {
    slug: "cheese-manakish",
    category: "pies",
    nameAr: "مناقيش جبنة",
    nameEn: "Cheese Manakish",
    descriptionAr: "جبنة عكاوي وموتزاريلا سايحة على عجينة طازة.",
    descriptionEn: "Melted akkawi and mozzarella on fresh dough.",
    price: 75,
    imageUrl: art("cheese-manakish"),
    vegetarian: true,
    addonGroups: ["pie-extras"],
  },
  // ── Appetizers & Salads ──────────────────────────────────────────────────
  {
    slug: "hummus",
    category: "appetizers",
    nameAr: "حمص",
    nameEn: "Hummus",
    descriptionAr: "حمص ناعم بالطحينة والليمون وزيت الزيتون والبابريكا.",
    descriptionEn: "Silky hummus with tahini, lemon, olive oil and paprika.",
    price: 55,
    imageUrl: PHOTOS.hummus,
    vegetarian: true,
    addonGroups: ["dip-extras"],
  },
  {
    slug: "baba-ghanoush",
    category: "appetizers",
    nameAr: "بابا غنوج",
    nameEn: "Baba Ghanoush",
    descriptionAr: "باذنجان مشوي على الفحم مع طحينة ورمان.",
    descriptionEn: "Charcoal-roasted aubergine with tahini and pomegranate.",
    price: 55,
    imageUrl: art("baba-ghanoush"),
    vegetarian: true,
    addonGroups: ["dip-extras"],
  },
  {
    slug: "tabbouleh",
    category: "appetizers",
    nameAr: "تبولة",
    nameEn: "Tabbouleh",
    descriptionAr: "بقدونس مفروم ناعم وبرغل وطماطم ونعناع بالليمون وزيت الزيتون.",
    descriptionEn: "Finely chopped parsley, bulgur, tomato and mint with lemon and olive oil.",
    price: 50,
    imageUrl: art("tabbouleh"),
    vegetarian: true,
  },
  {
    slug: "french-fries",
    category: "appetizers",
    nameAr: "بطاطس محمرة",
    nameEn: "French Fries",
    descriptionAr: "بطاطس مقرمشة ومتملحة صح.",
    descriptionEn: "Crispy, perfectly salted fries.",
    price: 45,
    imageUrl: PHOTOS.fries,
    vegetarian: true,
    addonGroups: ["spicy"],
  },
  // ── Desserts ─────────────────────────────────────────────────────────────
  {
    slug: "nabulsi-kunafa",
    category: "desserts",
    nameAr: "كنافة نابلسية",
    nameEn: "Nabulsi Kunafa",
    descriptionAr: "كنافة ناعمة بالجبنة النابلسي السايحة والقطر وفستق حلبي.",
    descriptionEn: "Fine kunafa with molten Nabulsi cheese, syrup and pistachio.",
    price: 85,
    imageUrl: art("nabulsi-kunafa"),
    vegetarian: true,
    bestSeller: true,
  },
  {
    slug: "om-ali",
    category: "desserts",
    nameAr: "أم علي",
    nameEn: "Om Ali",
    descriptionAr: "رقاق بالحليب والقشطة والمكسرات، خارجة من الفرن سخنة.",
    descriptionEn: "Baked pastry pudding with milk, cream and nuts, served hot.",
    price: 70,
    imageUrl: art("om-ali"),
    vegetarian: true,
  },
  // ── Drinks ───────────────────────────────────────────────────────────────
  {
    slug: "lemon-mint",
    category: "drinks",
    nameAr: "ليمون نعناع",
    nameEn: "Lemon Mint",
    descriptionAr: "ليمون فريش بالنعناع ومتلج.",
    descriptionEn: "Fresh lemon and mint, ice-cold.",
    price: 45,
    imageUrl: PHOTOS.lemonMint,
    vegetarian: true,
    bestSeller: true,
  },
  {
    slug: "mango-juice",
    category: "drinks",
    nameAr: "عصير مانجو",
    nameEn: "Mango Juice",
    descriptionAr: "مانجو طبيعي تقيل.",
    descriptionEn: "Thick, fresh mango.",
    price: 55,
    imageUrl: PHOTOS.mango,
    vegetarian: true,
  },
  {
    slug: "mineral-water",
    category: "drinks",
    nameAr: "مياه معدنية",
    nameEn: "Mineral Water",
    descriptionAr: "مياه معدنية ساقعة.",
    descriptionEn: "Chilled mineral water.",
    price: 15,
    imageUrl: PHOTOS.water,
    vegetarian: true,
  },
  {
    slug: "soft-drink-can",
    category: "drinks",
    nameAr: "كانز",
    nameEn: "Soft Drink Can",
    descriptionAr: "كانز ساقع، اختار نوعه في الملاحظات.",
    descriptionEn: "Chilled can — tell us which one in the notes.",
    price: 25,
    imageUrl: PHOTOS.softDrink,
    vegetarian: true,
  },
];

export const zones = [
  { slug: "fifth-settlement", nameAr: "التجمع الخامس", nameEn: "Fifth Settlement", fee: 25, minOrder: 150, eta: [30, 45] },
  { slug: "rehab", nameAr: "الرحاب", nameEn: "Al Rehab", fee: 35, minOrder: 200, eta: [40, 55] },
  { slug: "madinaty", nameAr: "مدينتي", nameEn: "Madinaty", fee: 45, minOrder: 250, eta: [45, 60] },
  {
    slug: "first-third-settlement",
    nameAr: "التجمع الأول / الثالث",
    nameEn: "First / Third Settlement",
    fee: 35,
    minOrder: 200,
    eta: [40, 55],
  },
  { slug: "nasr-city", nameAr: "مدينة نصر", nameEn: "Nasr City", fee: 50, minOrder: 300, eta: [50, 70] },
] as const;

export const RESTAURANT = {
  nameAr: "فحم وزعتر",
  nameEn: "Fahm & Zaatar",
  phone: "01000000000",
  whatsapp: "201000000000",
  addressAr: "التجمع الخامس، القاهرة الجديدة",
  addressEn: "Fifth Settlement, New Cairo",
  // Approximate centre of the Fifth Settlement (90th Street area).
  lat: 30.0283,
  lng: 31.4731,
  instagram: "fahmzaatar",
} as const;

export const reviews = [
  { name: "أحمد م.", rating: 5, locale: "ar", comment: "الكفتة طعمها فحم بجد، والأوردر وصل سخن في 35 دقيقة. هطلب تاني أكيد." },
  { name: "Sara K.", rating: 5, locale: "en", comment: "Best shawarma arabi in New Cairo. The toum is unreal." },
  { name: "منة الله", rating: 5, locale: "ar", comment: "الكنافة النابلسي تحفة والتغليف محترم جداً." },
  { name: "كريم ع.", rating: 4, locale: "ar", comment: "طاجن المشكل كفانا إحنا الاتنين وزيادة. الريش كانت محتاجة دقيقة زيادة بس ممتازة." },
  { name: "Omar H.", rating: 5, locale: "en", comment: "Ordered for the office — everything arrived on time and still crispy." },
  { name: "نهى س.", rating: 5, locale: "ar", comment: "الحمص والتبولة طازة جداً، وخدمة الواتساب بترد بسرعة." },
] as const;

export const staff = [
  { email: "owner@fahmzaatar.test", fullName: "صاحب المطعم", role: "owner", phone: "01000000001" },
  { email: "manager@fahmzaatar.test", fullName: "مدير الفرع", role: "manager", phone: "01000000002" },
  { email: "kitchen@fahmzaatar.test", fullName: "شيف المطبخ", role: "kitchen", phone: "01000000003" },
  { email: "driver@fahmzaatar.test", fullName: "الطيار", role: "driver", phone: "01000000004" },
] as const;

/** Demo password for every seeded staff account (printed in the README). */
export const DEMO_STAFF_PASSWORD = "FahmZaatar@2026";

export const customers = [
  { name: "أحمد محمود", phone: "01012345678" },
  { name: "سارة كمال", phone: "01123456789" },
  { name: "محمد علي", phone: "01234567890" },
  { name: "منة الله حسن", phone: "01556789012" },
  { name: "كريم عادل", phone: "01098765432" },
  { name: "Omar Hassan", phone: "01187654321" },
  { name: "نهى سامي", phone: "01276543210" },
] as const;
