'use client';

import React, { useReducer, useMemo } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useBusinessStore } from '../../stores/businessStore';
import { Lock } from 'lucide-react';
import { useUserPermissions } from '../../hooks/useUserPermissions';
import './insights.css';
import { useBusinessInsights, useInsightsExport } from '../../hooks/useInsights';
import { buildReportHtml, buildReportCsv, ReportType } from '../../utils/reportTemplates';

// Modular Child Components
import KPICards from '../../components/insights/KPICards';
import RevenueChart from '../../components/insights/RevenueChart';
import BestsellersList from '../../components/insights/BestsellersList';
import SlowmoversList from '../../components/insights/SlowmoversList';
import StockAlertsList from '../../components/insights/StockAlertsList';
import ReportExporter from '../../components/insights/ReportExporter';
import TransactionLedger from '../../components/insights/TransactionLedger';
import ReceiptModal from '../../components/insights/ReceiptModal';
import PeriodSelector from '../../components/insights/PeriodSelector';
import CustomDatePicker from '../../components/insights/CustomDatePicker';

type InsightsPeriod = 'daily' | 'yesterday' | 'weekly' | 'monthly' | 'yearly' | 'custom';

interface InsightsState {
  period: InsightsPeriod;
  customStart: string;
  customEnd: string;
  selectedReport: ReportType;
  showCalendar: boolean;
  viewMonth: number;
  viewYear: number;
  showReceipt: boolean;
  selectedReceipt: any;
  isGeneratingPdf: boolean;
  isGeneratingCsv: boolean;
}

type InsightsAction =
  | { type: 'setPeriod'; period: InsightsPeriod }
  | { type: 'setShowCalendar'; show: boolean }
  | { type: 'setSelectedReport'; report: ReportType }
  | { type: 'prevMonth' }
  | { type: 'nextMonth' }
  | { type: 'selectDate'; dateStr: string }
  | { type: 'clearCustomDates' }
  | { type: 'openReceipt'; receipt: any }
  | { type: 'closeReceipt' }
  | { type: 'setIsGeneratingPdf'; value: boolean }
  | { type: 'setIsGeneratingCsv'; value: boolean };

const initialInsightsState: InsightsState = {
  period: 'monthly',
  customStart: '',
  customEnd: '',
  selectedReport: 'best_sellers',
  showCalendar: false,
  viewMonth: new Date().getMonth(),
  viewYear: new Date().getFullYear(),
  showReceipt: false,
  selectedReceipt: null,
  isGeneratingPdf: false,
  isGeneratingCsv: false,
};

function insightsReducer(state: InsightsState, action: InsightsAction): InsightsState {
  switch (action.type) {
    case 'setPeriod':
      return { ...state, period: action.period };
    case 'setShowCalendar':
      return { ...state, showCalendar: action.show };
    case 'setSelectedReport':
      return { ...state, selectedReport: action.report };
    case 'prevMonth':
      if (state.viewMonth === 0) {
        return { ...state, viewMonth: 11, viewYear: state.viewYear - 1 };
      }
      return { ...state, viewMonth: state.viewMonth - 1 };
    case 'nextMonth':
      if (state.viewMonth === 11) {
        return { ...state, viewMonth: 0, viewYear: state.viewYear + 1 };
      }
      return { ...state, viewMonth: state.viewMonth + 1 };
    case 'selectDate': {
      if (!state.customStart || (state.customStart && state.customEnd)) {
        return { ...state, customStart: action.dateStr, customEnd: '' };
      }
      if (action.dateStr < state.customStart) {
        return { ...state, customStart: action.dateStr };
      }
      return { ...state, customEnd: action.dateStr };
    }
    case 'clearCustomDates':
      return { ...state, customStart: '', customEnd: '' };
    case 'openReceipt':
      return { ...state, selectedReceipt: action.receipt, showReceipt: true };
    case 'closeReceipt':
      return { ...state, showReceipt: false, selectedReceipt: null };
    case 'setIsGeneratingPdf':
      return { ...state, isGeneratingPdf: action.value };
    case 'setIsGeneratingCsv':
      return { ...state, isGeneratingCsv: action.value };
    default:
      return state;
  }
}

export default function InsightsPage() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const activeBusiness = useBusinessStore((s) => s.activeBusiness);
  const employeeName = useAuthStore((s) => s.employeeName);
  const { role } = useUserPermissions();

  const [state, dispatch] = useReducer(insightsReducer, initialInsightsState);
  const {
    period,
    customStart,
    customEnd,
    selectedReport,
    showCalendar,
    viewMonth,
    viewYear,
    showReceipt,
    selectedReceipt,
    isGeneratingPdf,
    isGeneratingCsv,
  } = state;

  const monthsNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  const handlePrevMonth = () => dispatch({ type: 'prevMonth' });

  const handleNextMonth = () => dispatch({ type: 'nextMonth' });

  const handleDateClick = (dateStr: string) => dispatch({ type: 'selectDate', dateStr });

  const handleClearDates = () => dispatch({ type: 'clearCustomDates' });

  // Compute days in current month grid (42 days)
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay();
    const lastDayOfMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const lastDayOfPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const days: { day: number; dateStr: string; isCurrentMonth: boolean }[] = [];

    // Prev month padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const prevDay = lastDayOfPrevMonth - i;
      const prevMonth = viewMonth === 0 ? 11 : viewMonth - 1;
      const prevYear = viewMonth === 0 ? viewYear - 1 : viewYear;
      const dateStr = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(prevDay).padStart(2, '0')}`;
      days.push({ day: prevDay, dateStr, isCurrentMonth: false });
    }

    // Current month
    for (let i = 1; i <= lastDayOfMonth; i++) {
      const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push({ day: i, dateStr, isCurrentMonth: true });
    }

    // Next month padding
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const nextMonth = viewMonth === 11 ? 0 : viewMonth + 1;
      const nextYear = viewMonth === 11 ? viewYear + 1 : viewYear;
      const dateStr = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push({ day: i, dateStr, isCurrentMonth: false });
    }

    return days;
  }, [viewMonth, viewYear]);

  const chartTitle = useMemo(() => {
    switch (period) {
      case 'daily':
        return 'Revenue Distribution by Hour (Today)';
      case 'yesterday':
        return 'Revenue Distribution by Hour (Yesterday)';
      case 'weekly':
        return 'Revenue Distribution by Weekday';
      case 'monthly':
        return 'Revenue Distribution by Week';
      case 'yearly':
        return 'Revenue Distribution by Month';
      case 'custom':
        return 'Revenue Distribution by Date';
      default:
        return 'Revenue Distribution';
    }
  }, [period]);

  // Convert custom date strings to Date objects
  const startDateObj = useMemo(() => {
    return customStart ? new Date(customStart) : null;
  }, [customStart]);

  const endDateObj = useMemo(() => {
    return customEnd ? new Date(customEnd) : null;
  }, [customEnd]);

  // Hook calls
  const { data: insights, isLoading } = useBusinessInsights(
    activeBusiness?.id || '0',
    period,
    startDateObj,
    endDateObj
  );

  const { fetchReportData } = useInsightsExport(activeBusiness?.id || '0');

  const orders = insights?.resolvedOrders || [];
  const lowStockCount = insights?.lowStockCount || 0;
  const lowStockItems = insights?.lowStockItems || [];
  const outOfStockCount = insights?.outOfStockCount || 0;
  const outOfStockItems = insights?.outOfStockItems || [];
  const bestSellers = insights?.bestSellers || [];
  const slowMovers = insights?.slowMovers || [];
  const chartData = insights?.chartData || [];

  // Aggregate KPI metrics
  const kpiMetrics = useMemo(() => {
    const grossRevenue = orders.reduce((sum: number, o: any) => sum + o.totalAmount, 0);
    const count = orders.length;
    const avgVal = count > 0 ? grossRevenue / count : 0;
    return {
      grossRevenue,
      count,
      avgVal,
    };
  }, [orders]);

  const receiptSubtotal = useMemo(() => {
    if (!selectedReceipt || !selectedReceipt.items) return 0;
    return selectedReceipt.items.reduce(
      (sum: number, item: any) => sum + item.price * item.quantity,
      0
    );
  }, [selectedReceipt]);

  // Handlers for exporting reports
  const handleDownloadPdf = async () => {
    dispatch({ type: 'setIsGeneratingPdf', value: true });
    try {
      const data = await fetchReportData(period, startDateObj, endDateObj);
      const html = buildReportHtml(selectedReport, data);

      const iframe = document.createElement('iframe');
      iframe.style.position = 'absolute';
      iframe.style.width = '0px';
      iframe.style.height = '0px';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(html);
        doc.close();

        setTimeout(() => {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          setTimeout(() => {
            document.body.removeChild(iframe);
          }, 5000);
        }, 150);
      }
    } catch (err: any) {
      alert('Failed to generate PDF report: ' + err.message);
    } finally {
      dispatch({ type: 'setIsGeneratingPdf', value: false });
    }
  };

  const handleDownloadCsv = async () => {
    dispatch({ type: 'setIsGeneratingCsv', value: true });
    try {
      const data = await fetchReportData(period, startDateObj, endDateObj);
      const csv = buildReportCsv(selectedReport, data);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute(
        'download',
        `${selectedReport}_report_${new Date().toISOString().slice(0, 10)}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      alert('Failed to generate CSV report: ' + err.message);
    } finally {
      dispatch({ type: 'setIsGeneratingCsv', value: false });
    }
  };

  if (role === 'cashier') {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        <div
          style={{
            textAlign: 'center',
            maxWidth: '360px',
            padding: '32px',
            backgroundColor: '#ffffff',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: '#fee2e2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid #fecaca',
            }}
          >
            <Lock size={28} color="var(--error)" />
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--dark)', margin: 0 }}>
            Analytics Insights Restricted
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: '1.6', margin: 0 }}>
            Cashier profiles are not authorized to view business analytics reports and revenue
            graphs.
          </p>
        </div>
      </div>
    );
  }

  const maxChartVal =
    chartData.length > 0 ? Math.max(...chartData.map((c: any) => c.value), 1000) : 1000;

  return (
    <div className="insights-container fade-in">
      <div className="insights-workspace">
        {/* Left Side: Filter, KPIs, Chart, List Tables */}
        <div className="metrics-pane">
          {isLoading && (
            <div className="pane-loading-overlay">
              <span
                className="pane-loading-spinner"
                style={{
                  display: 'inline-block',
                  width: '24px',
                  height: '24px',
                  border: '3px solid #2563eb',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                }}
              />
            </div>
          )}
          {/* Period selector tabs */}
          <PeriodSelector
            period={period}
            setPeriod={(p) => dispatch({ type: 'setPeriod', period: p })}
          />

          {/* Custom Date Picker popover wrapper */}
          {period === 'custom' && (
            <CustomDatePicker
              customStart={customStart}
              customEnd={customEnd}
              showCalendar={showCalendar}
              setShowCalendar={(show) => dispatch({ type: 'setShowCalendar', show })}
              viewMonth={viewMonth}
              viewYear={viewYear}
              calendarDays={calendarDays}
              monthsNames={monthsNames}
              handlePrevMonth={handlePrevMonth}
              handleNextMonth={handleNextMonth}
              handleDateClick={handleDateClick}
              handleClearDates={handleClearDates}
            />
          )}

          {/* Scrollable contents inside metrics pane */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              overflowY: 'auto',
              flex: 1,
              margin: '0 -20px',
              padding: '0 20px',
            }}
          >
            {/* KPI Cards Grid */}
            <KPICards
              grossRevenue={kpiMetrics.grossRevenue}
              ordersCount={kpiMetrics.count}
              avgTicket={kpiMetrics.avgVal}
              lowStockCount={lowStockCount}
              outOfStockCount={outOfStockCount}
            />

            {/* SVG Distribution Chart */}
            <RevenueChart chartData={chartData} chartTitle={chartTitle} maxChartVal={maxChartVal} />

            {/* Listings vertically stacked */}
            <div className="lists-grid-row">
              <BestsellersList bestSellers={bestSellers} />
              <SlowmoversList slowMovers={slowMovers} />
              <StockAlertsList outOfStockItems={outOfStockItems} lowStockItems={lowStockItems} />
            </div>
          </div>
        </div>

        {/* Right Side: Exporter section & Transaction Ledger */}
        <div className="ledger-pane">
          <ReportExporter
            selectedReport={selectedReport}
            setSelectedReport={(report) => dispatch({ type: 'setSelectedReport', report })}
            handleDownloadPdf={handleDownloadPdf}
            handleDownloadCsv={handleDownloadCsv}
            isGeneratingPdf={isGeneratingPdf}
            isGeneratingCsv={isGeneratingCsv}
          />

          <TransactionLedger
            orders={orders}
            onViewReceipt={(o: any) => {
              dispatch({ type: 'openReceipt', receipt: o });
            }}
            isLoading={isLoading}
          />
        </div>
      </div>

      {/* Printable Receipt Modal */}
      <ReceiptModal
        isOpen={showReceipt}
        onClose={() => dispatch({ type: 'closeReceipt' })}
        selectedReceipt={selectedReceipt}
        receiptSubtotal={receiptSubtotal}
        activeBusiness={activeBusiness}
        employeeName={employeeName || 'Cashier'}
      />
    </div>
  );
}
