import React, { useState, useEffect } from "react";
import { StyleSheet, Text, View, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { TOKENS } from "../../constants/tokens";
import { cartState } from "../data/cartState";

export const HeaderCartButton: React.FC = () => {
  const router = useRouter();
  const [cartItemsCount, setCartItemsCount] = useState(0);

  useEffect(() => {
    const syncCart = () => {
      const cart = cartState.getCart();
      setCartItemsCount(cart.reduce((sum, item) => sum + item.quantity, 0));
    };

    syncCart();
    return cartState.subscribe(syncCart);
  }, []);

  if (cartItemsCount === 0) return null;

  return (
    <TouchableOpacity
      style={styles.headerCartBtn}
      activeOpacity={0.8}
      onPress={() => router.push("/pos/cart")}
    >
      <Feather name="shopping-cart" size={18} color={TOKENS.primary} />
      <View style={styles.headerCartBadge}>
        <Text style={styles.headerCartBadgeText}>{cartItemsCount}</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  headerCartBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: TOKENS.lightBlue,
    borderWidth: 1,
    borderColor: TOKENS.accentBlue,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  headerCartBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: TOKENS.error,
    borderRadius: 9,
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCartBadgeText: {
    color: TOKENS.card,
    fontSize: 9,
    fontWeight: "bold",
  },
});
