import React from 'react';
import { Printer, Download } from 'lucide-react';
import { ReportType } from '../../utils/reportTemplates';

interface ReportExporterProps {
  selectedReport: ReportType;
  setSelectedReport: (report: ReportType) => void;
  handleDownloadPdf: () => void;
  handleDownloadCsv: () => void;
}

export default function ReportExporter({
  selectedReport,
  setSelectedReport,
  handleDownloadPdf,
  handleDownloadCsv,
}: ReportExporterProps) {
  return (
    <div className="export-card">
      <h3 className="export-title">📄 Export Business Reports</h3>
      <div className="export-controls">
        <div className="export-select-wrapper">
          <select 
            value={selectedReport} 
            onChange={(e) => setSelectedReport(e.target.value as ReportType)}
            className="export-select"
          >
            <option value="best_sellers">Best Selling Products</option>
            <option value="slow_movers">Slow Moving Inventory</option>
            <option value="orders_ledger">Store Orders Ledger</option>
            <option value="item_sales">Item-Wise Sales Summary</option>
            <option value="branch_performance">Branch Performance & Low Stock</option>
          </select>
        </div>

        <div className="export-buttons-group">
          <button 
            onClick={handleDownloadPdf}
            className="export-btn pdf"
            title="Export Statement Report as PDF"
          >
            <Printer size={15} />
            <span>PDF</span>
          </button>
          <button 
            onClick={handleDownloadCsv}
            className="export-btn excel"
            title="Export Ledger Statement as CSV/Excel"
          >
            <Download size={15} />
            <span>Excel</span>
          </button>
        </div>
      </div>
    </div>
  );
}
