import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { fetchCategoryProductCounts } from '../utils/productCounts';
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

  const { data: counts } = useQuery({
    queryKey: ['category-product-counts', activeBiz?.id, config.categories],
    queryFn: async () => {
      if (!activeBiz?.id) return { total: 0, byCategory: {} as Record<string, number> };
      return fetchCategoryProductCounts(activeBiz.id, config.categories);
    },
    enabled: !!activeBiz?.id,
    staleTime: 30_000,
  });

  return useMemo(() => {
    const total = counts?.total ?? 0;
    const byCategory = counts?.byCategory ?? {};

    const list: BusinessCategoryItem[] = [
      { id: 'all', label: allLabel, icon: 'archive-outline', count: total },
    ];
    config.categories.forEach((cat) => {
      list.push({
        id: cat,
        label: getCategoryLabel(cat, activeBiz?.category),
        icon: getCategoryIcon(cat),
        count: byCategory[cat.toLowerCase().trim()] || 0,
      });
    });
    return list;
  }, [counts, config, activeBiz?.category, allLabel]);
}
