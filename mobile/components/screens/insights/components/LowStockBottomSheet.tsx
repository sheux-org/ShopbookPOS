import React from "react";
import { ScrollView, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { BottomSheet } from "../../../common/BottomSheet";
import { styles } from "../styles";

interface LowStockBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  lowStockItems: any[] | undefined;
}

export const LowStockBottomSheet: React.FC<LowStockBottomSheetProps> = ({
  visible,
  onClose,
  lowStockItems,
}) => {
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Low Stock Products List"
    >
      <Text style={styles.lowStockModalSubtitle}>
        The following inventory items are running critically low (at or below alert threshold):
      </Text>

      <ScrollView
        showsVerticalScrollIndicator={false}
        style={[styles.lowStockItemsScroll, { maxHeight: 350 }]}
        contentContainerStyle={{ gap: 10, paddingVertical: 10 }}
      >
        {lowStockItems && lowStockItems.length > 0 ? (
          lowStockItems.map((item: any) => (
            <View key={item.id} style={styles.lowStockItemRow}>
              <View style={styles.lowStockIconWrapper}>
                <Text style={{ fontSize: 16 }}>{item.icon || "📦"}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.lowStockItemName}>{item.name}</Text>
                <Text style={styles.lowStockItemSku}>SKU: {item.sku}</Text>
              </View>
              <View style={styles.lowStockCountBadge}>
                <Text style={styles.lowStockCountText}>
                  {item.stockCount} left
                </Text>
                <Text style={styles.lowStockLimitText}>
                  Alert Threshold: {item.lowStockAlert}
                </Text>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyLowStockState}>
            <Feather name="check-circle" size={32} color="#10B981" />
            <Text style={styles.emptyLowStockText}>
              All products are sufficiently stocked!
            </Text>
          </View>
        )}
      </ScrollView>
    </BottomSheet>
  );
};
