import { Q } from '@nozbe/watermelondb';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import database from '../components/data/db';
import { getBusinessTypeConfig, getCategoryLabel } from '../utils/businessTypeConfig';
import { useActiveBusiness } from './useActiveBusiness';

export interface BusinessCategoryItem {
  id: string;
  label: string;
  icon: string;
  count: number;
}

export function getCategoryIcon(category: string): string {
  const cat = category.toLowerCase().trim();
  if (cat === 'all') return 'archive-outline';
  if (cat.includes('grocer')) return 'cart-outline';
  if (cat.includes('dai')) return 'water-outline';
  if (cat.includes('drink') || cat.includes('bev')) return 'wine-outline';
  if (cat.includes('snack') || cat.includes('dessert') || cat.includes('bake'))
    return 'fast-food-outline';
  if (cat.includes('house') || cat.includes('clean') || cat.includes('personal'))
    return 'home-outline';
  if (cat.includes('cloth') || cat.includes('foot') || cat.includes('bouti'))
    return 'shirt-outline';
  if (
    cat.includes('tool') ||
    cat.includes('hard') ||
    cat.includes('elect') ||
    cat.includes('plumb')
  )
    return 'construct-outline';
  if (cat.includes('med') || cat.includes('phar') || cat.includes('vit')) return 'bandage-outline';
  if (
    cat.includes('salon') ||
    cat.includes('cut') ||
    cat.includes('style') ||
    cat.includes('treat') ||
    cat.includes('mani') ||
    cat.includes('pedi')
  )
    return 'cut-outline';
  if (cat.includes('coffee') || cat.includes('tea')) return 'cafe-outline';
  return 'cube-outline';
}

export function useBusinessCategories(allLabel = 'All') {
  const activeBiz = useActiveBusiness();
  const config = getBusinessTypeConfig(activeBiz?.category);

  const { data: allProducts = [] } = useQuery({
    queryKey: ['all-products-for-count', activeBiz?.id],
    queryFn: async () => {
      if (!activeBiz?.id) return [];
      return database.get('products').query(Q.where('business_id', activeBiz.id)).fetch();
    },
  });

  return useMemo(() => {
    const map: Record<string, number> = {};
    let total = 0;
    allProducts.forEach((p: any) => {
      const cat = (p.category || '').toLowerCase().trim();
      map[cat] = (map[cat] || 0) + 1;
      total++;
    });

    const list: BusinessCategoryItem[] = [
      { id: 'all', label: allLabel, icon: 'archive-outline', count: total },
    ];
    config.categories.forEach((cat) => {
      list.push({
        id: cat,
        label: getCategoryLabel(cat, activeBiz?.category),
        icon: getCategoryIcon(cat),
        count: map[cat.toLowerCase().trim()] || 0,
      });
    });
    return list;
  }, [allProducts, config, activeBiz?.category, allLabel]);
}
