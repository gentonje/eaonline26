// Single source of truth for product categories.
// All screens (Browse, Add, Edit, BulkImport) MUST import from here so the
// category a seller can post in is always a category a buyer can filter by.

export const CATEGORIES = [
    'Auto',
    'Art',
    'Beauty',
    'Books',
    'Children',
    'Clothing',
    'Electronics',
    'Fashion',
    'Food',
    'Furniture',
    'Handicrafts',
    'Home',
    'Kitchen',
    'Sports',
    'Toys',
    'Other',
] as const;

export type Category = typeof CATEGORIES[number];

export const DEFAULT_CATEGORY: Category = 'Other';
