import React, { useEffect, useState } from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View, Alert } from "react-native";
import { Calendar } from "react-native-calendars";
import { TOKENS } from "../../../../constants/tokens";
import { styles } from "../styles";

interface DateRangeModalProps {
  visible: boolean;
  onClose: () => void;
  resolvedStartDate: Date | null;
  resolvedEndDate: Date | null;
  onApply: (startDate: Date, endDate: Date) => void;
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

  const applyCalendarRange = () => {
    if (!tempStartDate || !tempEndDate) {
      Alert.alert(
        "Range Selection Needed",
        "Please select both a Start Date and an End Date on the calendar grid first.",
      );
      return;
    }
    const start = new Date(tempStartDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(tempEndDate);
    end.setHours(23, 59, 59, 999);

    onApply(start, end);
  };

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
              style={localStyles.cancelBtn}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={localStyles.cancelBtnText}>Cancel</Text>
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
  modalButtonsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748B",
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

