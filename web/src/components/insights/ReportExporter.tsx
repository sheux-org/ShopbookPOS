import React from 'react';
import { Printer, Download, FileDown, Loader2 } from 'lucide-react';
import { ReportType } from '../../utils/reportTemplates';

interface ReportExporterProps {
  selectedReport: ReportType;
  setSelectedReport: (report: ReportType) => void;
  handleDownloadPdf: () => void;
  handleDownloadCsv: () => void;
  isGeneratingPdf?: boolean;
  isGeneratingCsv?: boolean;
}

export default function ReportExporter({
  selectedReport,
  setSelectedReport,
  handleDownloadPdf,
  handleDownloadCsv,
  isGeneratingPdf = false,
  isGeneratingCsv = false,
}: ReportExporterProps) {
  return (
    <div className="export-card">
      <div className="export-header">
        <div className="export-header-icon-wrapper">
          <FileDown size={16} />
        </div>
        <h3 className="export-title">Export Business Reports</h3>
      </div>

      <div className="export-controls">
        <div className="export-select-wrapper">
          <select
            value={selectedReport}
            onChange={(e) => setSelectedReport(e.target.value as ReportType)}
            className="export-select"
            disabled={isGeneratingPdf || isGeneratingCsv}
          >
            <option value="best_sellers">Best Selling Products</option>
            <option value="slow_movers">Slow Moving Inventory</option>
            <option value="orders_ledger">Store Orders Ledger (All Payments)</option>
            <option value="ledger_cash">Store Orders Ledger (Cash Payments)</option>
            <option value="ledger_card">Store Orders Ledger (Card Payments)</option>
            <option value="ledger_bank">Store Orders Ledger (Bank Payments)</option>
            <option value="item_sales">Item-Wise Sales Summary</option>
            <option value="branch_performance">Branch Performance & Low Stock</option>
          </select>
        </div>

        <div className="export-buttons-group">
          <button
            onClick={handleDownloadPdf}
            className="export-btn pdf"
            title="Export Statement Report as PDF"
            disabled={isGeneratingPdf || isGeneratingCsv}
          >
            {isGeneratingPdf ? <Loader2 size={15} className="spin-anim" /> : <Printer size={15} />}
            <span>{isGeneratingPdf ? 'Loading...' : 'PDF'}</span>
          </button>
          <button
            onClick={handleDownloadCsv}
            className="export-btn excel"
            title="Export Ledger Statement as CSV/Excel"
            disabled={isGeneratingPdf || isGeneratingCsv}
          >
            {isGeneratingCsv ? <Loader2 size={15} className="spin-anim" /> : <Download size={15} />}
            <span>{isGeneratingCsv ? 'Loading...' : 'Excel'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
