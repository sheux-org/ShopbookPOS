import React from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { TOKENS } from '../../../../constants/tokens';
import { ReportType } from '../../../../utils/reportTemplates';
import { styles } from '../styles';

interface CsvLedgerModalProps {
  visible: boolean;
  onClose: () => void;
  selectedReportType: ReportType;
  onSelectReportType: (type: ReportType) => void;
  onGenerateReport: (type: ReportType) => void;
}

const REPORT_OPTIONS = [
  {
    id: 'best_sellers',
    title: 'Best Selling Products',
    desc: 'Sales ranking, units sold, and revenue shares.',
    icon: 'trending-up',
    color: '#10B981',
    bgColor: '#E8FDF0',
  },
  {
    id: 'slow_movers',
    title: 'Slow Moving Inventory',
    desc: 'Identify stagnant stock items with low sales.',
    icon: 'clock',
    color: '#F59E0B',
    bgColor: '#FEF7E0',
  },
  {
    id: 'orders_ledger',
    title: 'Orders History Ledger',
    desc: 'Chronological transaction database logs.',
    icon: 'list',
    color: '#3B82F6',
    bgColor: '#EFF6FF',
  },
  {
    id: 'ledger_cash',
    title: 'Cash Payment Settlement Ledger',
    desc: 'Audit cash payments and register cash settlements.',
    icon: 'dollar-sign',
    color: '#059669',
    bgColor: '#D1FAE5',
  },
  {
    id: 'ledger_card',
    title: 'Credit / Debit Card Settlements',
    desc: 'Card transactions and card terminal settlement audit.',
    icon: 'credit-card',
    color: '#6366F1',
    bgColor: '#EEF2FF',
  },
  {
    id: 'ledger_bank',
    title: 'Bank Transfer & QR Audit',
    desc: 'Direct bank transfers, online payments, and QR settlements.',
    icon: 'briefcase',
    color: '#0284C7',
    bgColor: '#E0F2FE',
  },
  {
    id: 'item_sales',
    title: 'Item-Wise Sales Summary',
    desc: 'Total quantities and revenues per catalog product.',
    icon: 'package',
    color: '#7C3AED',
    bgColor: '#EDE9FE',
  },
  {
    id: 'branch_performance',
    title: 'Branch Audit & Low Stock',
    desc: 'Cashier checkout ranks and critical stock alerts.',
    icon: 'activity',
    color: '#EF4444',
    bgColor: '#FCE8E6',
  },
  {
    id: 'invoice_sales',
    title: 'Invoice-by-Invoice Audit',
    desc: 'Detailed line item breakdown for every issued invoice.',
    icon: 'file-text',
    color: '#D97706',
    bgColor: '#FEF3C7',
  },
];

export const CsvLedgerModal: React.FC<CsvLedgerModalProps> = ({
  visible,
  onClose,
  selectedReportType,
  onSelectReportType,
  onGenerateReport,
}) => {
  const { height: windowHeight } = useWindowDimensions();

  return (
    <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={onClose}>
      <View style={styles.premiumModalOverlay}>
        {/* Backdrop Touch Dismiss */}
        <TouchableOpacity
          style={StyleSheet.absoluteFillObject}
          activeOpacity={1}
          onPress={onClose}
        />

        <View
          style={[styles.premiumModalContainer, { height: Math.min(windowHeight * 0.82, 580) }]}
        >
          {/* Close button */}
          <TouchableOpacity style={styles.absoluteCloseBtn} onPress={onClose}>
            <Feather name="x" size={16} color={TOKENS.muted} />
          </TouchableOpacity>

          <View style={styles.premiumModalHeader}>
            <View style={styles.pdfModalTitleRow}>
              <Feather name="grid" size={20} color={TOKENS.success} />
              <Text style={styles.pdfModalTitle}>CSV Ledger Report</Text>
            </View>
            <Text style={styles.pdfModalDescription}>
              Compile tabular CSV spreadsheet ledger reports from your store database history.
            </Text>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            style={styles.premiumModalScroll}
            contentContainerStyle={styles.premiumModalScrollContent}
          >
            {REPORT_OPTIONS.map((opt) => {
              const isSelected = selectedReportType === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  activeOpacity={0.8}
                  style={[styles.pdfOptionCard, isSelected && styles.pdfOptionCardSelected]}
                  onPress={() => onSelectReportType(opt.id as ReportType)}
                >
                  <View style={[styles.pdfOptionIconBox, { backgroundColor: opt.bgColor }]}>
                    <Feather name={opt.icon as any} size={15} color={opt.color} />
                  </View>
                  <View style={styles.pdfOptionTextCol}>
                    <Text style={styles.pdfOptionTitle}>{opt.title}</Text>
                    <Text style={styles.pdfOptionDesc}>{opt.desc}</Text>
                  </View>
                  <View
                    style={[styles.pdfOptionRadio, isSelected && styles.pdfOptionRadioSelected]}
                  >
                    {isSelected && <View style={styles.pdfOptionRadioInner} />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.premiumModalFooter}>
            <TouchableOpacity
              style={[styles.pdfGenerateBtn, { backgroundColor: TOKENS.success }]}
              activeOpacity={0.85}
              onPress={() => onGenerateReport(selectedReportType)}
            >
              <Feather name="grid" size={16} color="#FFFFFF" />
              <Text style={styles.pdfGenerateBtnText}>Generate CSV Report</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.pdfCancelBtn} activeOpacity={0.8} onPress={onClose}>
              <Text style={styles.pdfCancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};
