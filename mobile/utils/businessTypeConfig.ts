export interface BusinessTypeConfig {
  categories: string[];
  unitTypes: string[];
  defaultCategory: string;
  defaultUnitType: string;
  categoryEmojis: Record<string, string>;
  categoryLabels: Record<string, string>;
}

export const BUSINESS_TYPE_CONFIGS: Record<string, BusinessTypeConfig> = {
  Cafe: {
    categories: ['coffee', 'tea', 'bakery', 'desserts', 'beverages'],
    unitTypes: ['Cups', 'Pieces', 'Packets', 'Servings'],
    defaultCategory: 'coffee',
    defaultUnitType: 'Cups',
    categoryEmojis: {
      coffee: '☕',
      tea: '🍵',
      bakery: '🥐',
      desserts: '🍰',
      beverages: '🥤',
    },
    categoryLabels: {
      coffee: 'Coffee',
      tea: 'Tea',
      bakery: 'Bakery',
      desserts: 'Desserts',
      beverages: 'Beverages',
    },
  },
  Restaurant: {
    categories: ['appetizers', 'main course', 'desserts', 'beverages', 'sides'],
    unitTypes: ['Plates', 'Portions', 'Cups', 'Pieces', 'Bottles'],
    defaultCategory: 'main course',
    defaultUnitType: 'Plates',
    categoryEmojis: {
      appetizers: '🥗',
      'main course': '🍛',
      desserts: '🍨',
      beverages: '🍹',
      sides: '🍟',
    },
    categoryLabels: {
      appetizers: 'Appetizers',
      'main course': 'Main Course',
      desserts: 'Desserts',
      beverages: 'Beverages',
      sides: 'Sides',
    },
  },
  Boutique: {
    categories: ['clothing', 'footwear', 'accessories', 'bags', 'cosmetics'],
    unitTypes: ['Pieces', 'Pairs', 'Sets'],
    defaultCategory: 'clothing',
    defaultUnitType: 'Pieces',
    categoryEmojis: {
      clothing: '👕',
      footwear: '👟',
      accessories: '⌚',
      bags: '👜',
      cosmetics: '💄',
    },
    categoryLabels: {
      clothing: 'Clothing',
      footwear: 'Footwear',
      accessories: 'Accessories',
      bags: 'Bags',
      cosmetics: 'Cosmetics',
    },
  },
  Salon: {
    categories: ['haircuts', 'styling', 'treatments', 'manicure/pedicure', 'products'],
    unitTypes: ['Services', 'Sessions', 'Pieces', 'Bottles'],
    defaultCategory: 'haircuts',
    defaultUnitType: 'Services',
    categoryEmojis: {
      haircuts: '💇‍♂️',
      styling: '✂️',
      treatments: '💆',
      'manicure/pedicure': '💅',
      products: '🧴',
    },
    categoryLabels: {
      haircuts: 'Haircuts',
      styling: 'Styling',
      treatments: 'Treatments',
      'manicure/pedicure': 'Manicure/Pedicure',
      products: 'Products',
    },
  },
  Supermarket: {
    categories: [
      'groceries',
      'produce',
      'dairy',
      'meat/seafood',
      'frozen foods',
      'household',
      'beverages',
      'personal care',
    ],
    unitTypes: ['Pieces', 'kg', 'g', 'Liters', 'ml', 'Packets', 'Bottles', 'Cans'],
    defaultCategory: 'groceries',
    defaultUnitType: 'Pieces',
    categoryEmojis: {
      groceries: '🥫',
      produce: '🍎',
      dairy: '🥛',
      'meat/seafood': '🥩',
      'frozen foods': '🧊',
      household: '🧼',
      beverages: '🧃',
      'personal care': '🧴',
    },
    categoryLabels: {
      groceries: 'Groceries',
      produce: 'Produce',
      dairy: 'Dairy',
      'meat/seafood': 'Meat/Seafood',
      'frozen foods': 'Frozen Foods',
      household: 'Household',
      beverages: 'Beverages',
      'personal care': 'Personal Care',
    },
  },
  'Grocery Shop': {
    categories: ['groceries', 'vegetables', 'fruits', 'spices', 'beverages', 'snacks', 'household'],
    unitTypes: ['Pieces', 'kg', 'g', 'Liters', 'Packets', 'Bottles'],
    defaultCategory: 'groceries',
    defaultUnitType: 'Pieces',
    categoryEmojis: {
      groceries: '🌾',
      vegetables: '🥕',
      fruits: '🍌',
      spices: '🌶️',
      beverages: '🥤',
      snacks: '🍪',
      household: '🧹',
    },
    categoryLabels: {
      groceries: 'Groceries',
      vegetables: 'Vegetables',
      fruits: 'Fruits',
      spices: 'Spices',
      beverages: 'Beverages',
      snacks: 'Snacks',
      household: 'Household',
    },
  },
  Pharmacy: {
    categories: [
      'medicines',
      'vitamins/supplements',
      'first aid',
      'personal care',
      'medical devices',
    ],
    unitTypes: ['Tablets', 'Capsules', 'Bottles', 'Pieces', 'Packs', 'Tubes'],
    defaultCategory: 'medicines',
    defaultUnitType: 'Tablets',
    categoryEmojis: {
      medicines: '💊',
      'vitamins/supplements': '🧪',
      'first aid': '🩹',
      'personal care': '🪥',
      'medical devices': '🩺',
    },
    categoryLabels: {
      medicines: 'Medicines',
      'vitamins/supplements': 'Vitamins/Supplements',
      'first aid': 'First Aid',
      'personal care': 'Personal Care',
      'medical devices': 'Medical Devices',
    },
  },
  Hardware: {
    categories: ['tools', 'electrical', 'plumbing', 'fasteners', 'paint', 'building materials'],
    unitTypes: ['Pieces', 'kg', 'Meters', 'Liters', 'Packs', 'Boxes'],
    defaultCategory: 'tools',
    defaultUnitType: 'Pieces',
    categoryEmojis: {
      tools: '🔨',
      electrical: '🔌',
      plumbing: '🚰',
      fasteners: '🔩',
      paint: '🎨',
      'building materials': '🧱',
    },
    categoryLabels: {
      tools: 'Tools',
      electrical: 'Electrical',
      plumbing: 'Plumbing',
      fasteners: 'Fasteners',
      paint: 'Paint',
      'building materials': 'Building Materials',
    },
  },
  Other: {
    categories: ['general', 'services', 'custom', 'miscellaneous'],
    unitTypes: ['Pieces', 'kg', 'Liters', 'Packets', 'Pairs', 'Services'],
    defaultCategory: 'general',
    defaultUnitType: 'Pieces',
    categoryEmojis: {
      general: '📦',
      services: '🛠️',
      custom: '⚙️',
      miscellaneous: '🏷️',
    },
    categoryLabels: {
      general: 'General',
      services: 'Services',
      custom: 'Custom',
      miscellaneous: 'Miscellaneous',
    },
  },
};

export function getBusinessTypeConfig(type?: string): BusinessTypeConfig {
  if (!type) {
    return BUSINESS_TYPE_CONFIGS.Other;
  }
  const match = Object.keys(BUSINESS_TYPE_CONFIGS).find(
    (key) => key.toLowerCase() === type.trim().toLowerCase()
  );
  if (match) {
    return BUSINESS_TYPE_CONFIGS[match];
  }
  const lowerType = type.toLowerCase();
  if (lowerType.includes('supermarket')) return BUSINESS_TYPE_CONFIGS.Supermarket;
  if (lowerType.includes('grocery')) return BUSINESS_TYPE_CONFIGS['Grocery Shop'];
  if (lowerType.includes('restaurant')) return BUSINESS_TYPE_CONFIGS.Restaurant;
  if (lowerType.includes('cafe')) return BUSINESS_TYPE_CONFIGS.Cafe;
  if (lowerType.includes('salon')) return BUSINESS_TYPE_CONFIGS.Salon;
  if (lowerType.includes('boutique')) return BUSINESS_TYPE_CONFIGS.Boutique;
  if (lowerType.includes('pharmacy')) return BUSINESS_TYPE_CONFIGS.Pharmacy;
  if (lowerType.includes('hardware')) return BUSINESS_TYPE_CONFIGS.Hardware;

  return BUSINESS_TYPE_CONFIGS.Other;
}

export function getCategoryEmoji(category: string, businessType?: string): string {
  const config = getBusinessTypeConfig(businessType);
  const catLower = category.toLowerCase().trim();
  if (config.categoryEmojis[catLower]) {
    return config.categoryEmojis[catLower];
  }
  for (const configName of Object.keys(BUSINESS_TYPE_CONFIGS)) {
    const emojis = BUSINESS_TYPE_CONFIGS[configName].categoryEmojis;
    if (emojis[catLower]) {
      return emojis[catLower];
    }
  }
  return '📦';
}

export function getCategoryLabel(category: string, businessType?: string): string {
  const config = getBusinessTypeConfig(businessType);
  const catLower = category.toLowerCase().trim();
  if (config.categoryLabels[catLower]) {
    return config.categoryLabels[catLower];
  }
  return category
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
