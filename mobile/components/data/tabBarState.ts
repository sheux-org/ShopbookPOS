let tabBarVisible = true;
const listeners = new Set<() => void>();

export const tabBarState = {
  getTabBarVisible: () => tabBarVisible,
  setTabBarVisible: (visible: boolean) => {
    if (tabBarVisible !== visible) {
      tabBarVisible = visible;
      listeners.forEach((l) => l());
    }
  },
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
