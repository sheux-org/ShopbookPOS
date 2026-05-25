import { useState, useEffect } from "react";
import { tabBarState } from "../components/data/tabBarState";

export function useTabBarVisible() {
  const [tabBarVisible, setVisible] = useState(tabBarState.getTabBarVisible());

  useEffect(() => {
    const syncState = () => {
      setVisible(tabBarState.getTabBarVisible());
    };
    return tabBarState.subscribe(syncState);
  }, []);

  return {
    tabBarVisible,
    setTabBarVisible: tabBarState.setTabBarVisible,
  };
}
