import React, { useEffect, useState } from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View, Alert, ScrollView } from "react-native";
import { Calendar } from "react-native-calendars";
import { Feather } from "@expo/vector-icons";
import { TOKENS } from "../../../../constants/tokens";
import { styles } from "../styles";

interface DateRangeModalProps {
  visible: boolean;
  onClose: () => void;
  resolvedStartDate: Date | null;
  resolvedEndDate: Date | null;
  onApply: (startDate: Date | null, endDate: Date | null) => void;
}

const formatDateString = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

export const DateRangeModal: React.FC<DateRangeModalProps> = ({
  visible,
  onClose,
  resolvedStartDate,
  resolvedEndDate,
  onApply,
}) => {
  const [tempStartDate, setTempStartDate] = useState<Date | null>(resolvedStartDate);
  const [tempEndDate, setTempEndDate] = useState<Date | null>(resolvedEndDate);
  const [currentCalendarMonth, setCurrentCalendarMonth] = useState<string>(
    formatDateString(resolvedEndDate || new Date())
  );

  useEffect(() => {
    if (visible) {
      setTempStartDate(resolvedStartDate);
      setTempEndDate(resolvedEndDate);
      setCurrentCalendarMonth(formatDateString(resolvedEndDate || new Date()));
    }
  }, [visible, resolvedStartDate, resolvedEndDate]);

  const getMarkedDates = () => {
    const marked: Record<string, any> = {};

    if (tempStartDate) {
      const startStr = formatDateString(tempStartDate);
      if (!tempEndDate) {
        marked[startStr] = {
          startingDay: true,
          endingDay: true,
          color: TOKENS.primary,
          textColor: "white",
        };
      } else {
        const endStr = formatDateString(tempEndDate);

        if (startStr === endStr) {
          marked[startStr] = {
            startingDay: true,
            endingDay: true,
            color: TOKENS.primary,
            textColor: "white",
          };
        } else {
          marked[startStr] = {
            startingDay: true,
            color: TOKENS.primary,
            textColor: "white",
          };
          marked[endStr] = {
            endingDay: true,
            color: TOKENS.primary,
            textColor: "white",
          };

          let current = new Date(tempStartDate);
          current.setDate(current.getDate() + 1);

          const normalizeDate = (d: Date) => {
            const copy = new Date(d);
            copy.setHours(0, 0, 0, 0);
            return copy;
          };

          const targetEnd = normalizeDate(tempEndDate);

          while (normalizeDate(current) < targetEnd) {
            const currentStr = formatDateString(current);
            marked[currentStr] = {
              color: "#EFF6FF",
              textColor: TOKENS.primary,
            };
            current.setDate(current.getDate() + 1);
          }
        }
      }
    }
    return marked;
  };

  const handleCalendarDayPress = (day: any) => {
    const clickedDate = new Date(day.year, day.month - 1, day.day);
    if (!tempStartDate || (tempStartDate && tempEndDate)) {
      setTempStartDate(clickedDate);
      setTempEndDate(null);
    } else if (clickedDate < tempStartDate) {
      setTempStartDate(clickedDate);
    } else {
      setTempEndDate(clickedDate);
    }
  };

  const isPresetSelected = (presetValue: string) => {
    if (!tempStartDate || !tempEndDate) return false;
    const today = new Date();
    const start = new Date(tempStartDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(tempEndDate);
    end.setHours(0, 0, 0, 0);

    const compareStart = new Date();
    const compareEnd = new Date();

    switch (presetValue) {
      case "today":
        compareStart.setTime(today.getTime());
        compareEnd.setTime(today.getTime());
        break;
      case "yesterday":
        compareStart.setDate(today.getDate() - 1);
        compareEnd.setDate(today.getDate() - 1);
        break;
      case "7days":
        compareStart.setDate(today.getDate() - 6);
        compareEnd.setTime(today.getTime());
        break;
      case "30days":
        compareStart.setDate(today.getDate() - 29);
        compareEnd.setTime(today.getTime());
        break;
      case "thisMonth":
        compareStart.setFullYear(today.getFullYear(), today.getMonth(), 1);
        compareEnd.setTime(today.getTime());
        break;
      default:
        return false;
    }
    compareStart.setHours(0, 0, 0, 0);
    compareEnd.setHours(0, 0, 0, 0);

    return start.getTime() === compareStart.getTime() && end.getTime() === compareEnd.getTime();
  };

  const handlePresetPress = (presetValue: string) => {
    const today = new Date();
    let start = new Date();
    let end = new Date();

    switch (presetValue) {
      case "today":
        start = new Date(today);
        end = new Date(today);
        break;
      case "yesterday":
        start = new Date(today);
        start.setDate(today.getDate() - 1);
        end = new Date(start);
        break;
      case "7days":
        start = new Date(today);
        start.setDate(today.getDate() - 6);
        end = new Date(today);
        break;
      case "30days":
        start = new Date(today);
        start.setDate(today.getDate() - 29);
        end = new Date(today);
        break;
      case "thisMonth":
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = new Date(today);
        break;
      default:
        break;
    }
    setTempStartDate(start);
    setTempEndDate(end);
    setCurrentCalendarMonth(formatDateString(end));
  };

  const applyCalendarRange = () => {
    if (!tempStartDate) {
      onApply(null, null);
      return;
    }
    const start = new Date(tempStartDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(tempEndDate || tempStartDate);
    end.setHours(23, 59, 59, 999);

    onApply(start, end);
  };

  const isSelectionEmpty = tempStartDate === null && tempEndDate === null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.premiumModalOverlay}>
        {/* Backdrop Touch Dismiss */}
        <TouchableOpacity
          style={StyleSheet.absoluteFillObject}
          activeOpacity={1}
          onPress={onClose}
        />

        <View style={styles.datePickerContent}>
          {/* Top-right close button */}
          <TouchableOpacity
            style={localStyles.closeModalBtn}
            onPress={onClose}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Feather name="x" size={18} color="#64748B" />
          </TouchableOpacity>

          {/* Header Title and Selected Period Badge */}
          <View style={{ alignItems: "center", marginBottom: 4 }}>
            <Text style={styles.modalTitle}>Select Date Range</Text>
            <View style={localStyles.selectedPeriodBadge}>
              <Text style={localStyles.selectedPeriodText}>
                {tempStartDate
                  ? tempStartDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
                  : "Start Date"}
                {"  ➔  "}
                {tempEndDate
                  ? tempEndDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
                  : "End Date"}
              </Text>
            </View>
          </View>

          {/* Quick Presets Scroll Row */}
          <View style={{ height: 38, marginBottom: 4 }}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={localStyles.presetsContainer}
            >
              {[
                { label: "Today", value: "today" },
                { label: "Yesterday", value: "yesterday" },
                { label: "7 Days", value: "7days" },
                { label: "30 Days", value: "30days" },
                { label: "This Month", value: "thisMonth" },
              ].map((preset) => {
                const isSelected = isPresetSelected(preset.value);
                return (
                  <TouchableOpacity
                    key={preset.value}
                    style={[
                      localStyles.presetPill,
                      isSelected && localStyles.presetPillActive,
                    ]}
                    onPress={() => handlePresetPress(preset.value)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        localStyles.presetPillText,
                        isSelected && localStyles.presetPillTextActive,
                      ]}
                    >
                      {preset.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          <Calendar
            current={currentCalendarMonth}
            onMonthChange={(month) => setCurrentCalendarMonth(month.dateString)}
            onDayPress={(day) => handleCalendarDayPress(day)}
            markingType={'period'}
            markedDates={getMarkedDates()}
            showSixWeeks={true}
            theme={{
              calendarBackground: 'transparent',
              selectedDayBackgroundColor: TOKENS.primary,
              selectedDayTextColor: '#ffffff',
              todayTextColor: TOKENS.primary,
              dayTextColor: TOKENS.dark,
              textDisabledColor: TOKENS.muted,
              dotColor: TOKENS.primary,
              selectedDotColor: '#ffffff',
              arrowColor: TOKENS.primary,
              monthTextColor: TOKENS.dark,
              textSectionTitleColor: '#94A3B8',
              textDayFontFamily: 'System',
              textMonthFontFamily: 'System',
              textDayHeaderFontFamily: 'System',
              textDayFontWeight: '500',
              textMonthFontWeight: '800',
              textDayHeaderFontWeight: '600',
              textDayFontSize: 13,
              textMonthFontSize: 16,
              textDayHeaderFontSize: 11,
            }}
            style={{
              borderRadius: 12,
              overflow: 'hidden',
            }}
          />

          {/* Action buttons */}
          <View style={localStyles.modalButtonsRow}>
            <TouchableOpacity
              style={[
                localStyles.clearBtn,
                isSelectionEmpty ? localStyles.clearBtnDisabled : localStyles.clearBtnActive
              ]}
              onPress={() => {
                setTempStartDate(null);
                setTempEndDate(null);
                onApply(null, null);
                onClose();
              }}
              disabled={isSelectionEmpty}
              activeOpacity={0.7}
            >
              <Text style={[
                localStyles.clearBtnText,
                isSelectionEmpty ? localStyles.clearBtnTextDisabled : localStyles.clearBtnTextActive
              ]}>
                Clear
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={localStyles.confirmBtn}
              onPress={applyCalendarRange}
              activeOpacity={0.8}
            >
              <Text style={localStyles.confirmBtnText}>Apply Range</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const localStyles = StyleSheet.create({
  closeModalBtn: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  selectedPeriodBadge: {
    backgroundColor: TOKENS.lightBlue,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 8,
    alignSelf: "center",
  },
  selectedPeriodText: {
    fontSize: 12,
    fontWeight: "700",
    color: TOKENS.primary,
  },
  presetsContainer: {
    paddingHorizontal: 2,
    gap: 8,
    paddingVertical: 4,
    marginBottom: 4,
  },
  presetPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  presetPillActive: {
    backgroundColor: TOKENS.primary,
    borderColor: TOKENS.primary,
  },
  presetPillText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
  },
  presetPillTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  modalButtonsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
  },
  clearBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  clearBtnActive: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FEE2E2",
  },
  clearBtnDisabled: {
    backgroundColor: "#F8FAFC",
    borderColor: "#E2E8F0",
    opacity: 0.6,
  },
  clearBtnText: {
    fontSize: 13,
    fontWeight: "700",
  },
  clearBtnTextActive: {
    color: "#EF4444",
  },
  clearBtnTextDisabled: {
    color: "#94A3B8",
  },
  confirmBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: TOKENS.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: TOKENS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 2,
  },
  confirmBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#ffffff",
  },
});


