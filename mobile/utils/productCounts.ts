import { Q } from '@nozbe/watermelondb';
import database from '../components/data/db';

export async function fetchCategoryProductCounts(
  businessId: string,
  categories: string[]
): Promise<{ total: number; byCategory: Record<string, number> }> {
  const collection = database.get('products');
  const businessFilter = Q.where('business_id', businessId);

  const total = await collection.query(businessFilter).fetchCount();

  const entries = await Promise.all(
    categories.map(async (cat) => {
      const key = cat.toLowerCase().trim();
      const count = await collection.query(businessFilter, Q.where('category', key)).fetchCount();
      return [key, count] as const;
    })
  );

  return { total, byCategory: Object.fromEntries(entries) };
}
