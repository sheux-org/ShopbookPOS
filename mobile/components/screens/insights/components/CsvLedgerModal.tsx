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
import { hapticFeedback } from '@/utils/haptics';
import { useTranslation } from '../../../../hooks/useTranslation';

interface CsvLedgerModalProps {
  visible: boolean;
  onClose: () => void;
  selectedReportType: ReportType;
  onSelectReportType: (type: ReportType) => void;
  onGenerateReport: (type: ReportType) => void;
}

export const CsvLedgerModal: React.FC<CsvLedgerModalProps> = ({
  visible,
  onClose,
  selectedReportType,
  onSelectReportType,
  onGenerateReport,
}) => {
  const { height: windowHeight } = useWindowDimensions();
  const { t } = useTranslation();

  const REPORT_OPTIONS = [
    {
      id: 'best_sellers',
      title: t('insights.reportBestSellers'),
      desc: t('insights.reportBestSellersSub'),
      icon: 'trending-up',
      color: '#10B981',
      bgColor: '#E8FDF0',
    },
    {
      id: 'slow_movers',
      title: t('insights.reportSlowMovers'),
      desc: t('insights.reportSlowMoversSub'),
      icon: 'clock',
      color: '#F59E0B',
      bgColor: '#FEF7E0',
    },
    {
      id: 'orders_ledger',
      title: t('insights.reportOrdersLedger'),
      desc: t('insights.reportOrdersLedgerSub'),
      icon: 'list',
      color: '#3B82F6',
      bgColor: '#EFF6FF',
    },
    {
      id: 'ledger_cash',
      title: t('insights.reportCashLedger'),
      desc: t('insights.reportCashLedgerSub'),
      icon: 'dollar-sign',
      color: '#059669',
      bgColor: '#D1FAE5',
    },
    {
      id: 'ledger_card',
      title: t('insights.reportCardLedger'),
      desc: t('insights.reportCardLedgerSub'),
      icon: 'credit-card',
      color: '#6366F1',
      bgColor: '#EEF2FF',
    },
    {
      id: 'ledger_bank',
      title: t('insights.reportBankLedger'),
      desc: t('insights.reportBankLedgerSub'),
      icon: 'briefcase',
      color: '#0284C7',
      bgColor: '#E0F2FE',
    },
    {
      id: 'item_sales',
      title: t('insights.reportItemSales'),
      desc: t('insights.reportItemSalesSub'),
      icon: 'package',
      color: '#7C3AED',
      bgColor: '#EDE9FE',
    },
    {
      id: 'branch_performance',
      title: t('insights.reportBranchAudit'),
      desc: t('insights.reportBranchAuditSub'),
      icon: 'activity',
      color: '#EF4444',
      bgColor: '#FCE8E6',
    },
    {
      id: 'invoice_sales',
      title: t('insights.reportInvoiceAudit'),
      desc: t('insights.reportInvoiceAuditSub'),
      icon: 'file-text',
      color: '#D97706',
      bgColor: '#FEF3C7',
    },
  ];

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
              <Feather name="download" size={20} color={TOKENS.primary} />
              <Text style={styles.pdfModalTitle}>{t('insights.csvModalTitle')}</Text>
            </View>
            <Text style={styles.pdfModalDescription}>{t('insights.csvModalDesc')}</Text>
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
                  onPress={() => {
                    hapticFeedback.selection();
                    onSelectReportType(opt.id as ReportType);
                  }}
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
              style={styles.pdfGenerateBtn}
              activeOpacity={0.85}
              onPress={() => {
                hapticFeedback.notificationSuccess();
                onGenerateReport(selectedReportType);
              }}
            >
              <Feather name="grid" size={16} color="#FFFFFF" />
              <Text style={styles.pdfGenerateBtnText}>{t('insights.generateCsvBtn')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.pdfCancelBtn} activeOpacity={0.8} onPress={onClose}>
              <Text style={styles.pdfCancelBtnText}>{t('insights.cancelBtn')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};
