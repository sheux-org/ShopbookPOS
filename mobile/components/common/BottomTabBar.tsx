import { Feather } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TOKENS } from '../../constants/tokens';
import { useUserPermissions } from '../../hooks/useUserPermissions';
import { hapticFeedback } from '@/utils/haptics';

interface BottomTabBarProps {
  activeTab?: 'home' | 'pos' | 'stocks' | 'insights' | 'orders' | 'profile';
  onTabPress?: (tab: string) => void;
}

export const BottomTabBar: React.FC<BottomTabBarProps> = ({ activeTab = 'home', onTabPress }) => {
  const insets = useSafeAreaInsets();

  const { canPerform, role } = useUserPermissions();

  const allTabs = [
    { id: 'home', label: 'Home', icon: 'home' },
    { id: 'pos', label: 'POS', icon: 'shopping-cart' },
    { id: 'stocks', label: 'Stocks', icon: 'package' },
    {
      id: role === 'cashier' ? 'orders' : 'insights',
      label: role === 'cashier' ? 'Orders' : 'Insights',
      icon: role === 'cashier' ? 'list' : 'bar-chart-2',
    },
    { id: 'profile', label: 'Profile', icon: 'user' },
  ];

  const tabs = allTabs.filter((tab) => {
    if (tab.id === 'stocks' && !canPerform('update', 'products')) {
      return false;
    }
    return true;
  });

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {tabs.map((tab) => {
        const isActive =
          activeTab === tab.id ||
          (tab.id === 'orders' && activeTab === 'insights') ||
          (tab.id === 'insights' && activeTab === 'orders');
        return (
          <TouchableOpacity
            key={tab.id}
            style={styles.tab}
            activeOpacity={0.7}
            onPress={() => {
              hapticFeedback.selection();
              onTabPress?.(tab.id);
            }}
          >
            {/* Sleek active indicator bar */}
            <View style={[styles.indicator, isActive && styles.indicatorActive]} />

            <Feather
              // @ts-ignore dynamic mapping is safe here for known feather icons
              name={tab.icon}
              size={22}
              color={isActive ? TOKENS.primary : TOKENS.muted}
              style={{ marginTop: 8 }}
            />
            <Text style={[styles.label, isActive ? styles.labelActive : styles.labelInactive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: TOKENS.card,
    borderTopWidth: 1,
    borderTopColor: TOKENS.border,
    paddingTop: 6,
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    position: 'relative',
  },
  indicator: {
    position: 'absolute',
    top: -6,
    width: 58,
    height: 3,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    backgroundColor: 'transparent',
  },
  indicatorActive: {
    backgroundColor: TOKENS.primary,
  },
  label: {
    fontSize: 11,
    marginTop: 4,
  },
  labelActive: {
    color: TOKENS.primary,
    fontWeight: 'bold',
  },
  labelInactive: {
    color: TOKENS.muted,
    fontWeight: '500',
  },
});
