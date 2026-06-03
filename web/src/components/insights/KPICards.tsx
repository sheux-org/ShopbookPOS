import React from 'react';
import { Wallet, ShoppingCart, TrendingUp, AlertTriangle } from 'lucide-react';

interface KPICardsProps {
  grossRevenue: number;
  ordersCount: number;
  avgTicket: number;
  lowStockCount: number;
  outOfStockCount: number;
}

export default function KPICards({
  grossRevenue,
  ordersCount,
  avgTicket,
  lowStockCount,
  outOfStockCount,
}: KPICardsProps) {
  return (
    <div className="kpi-grid">
      {/* Gross Revenue Card */}
      <div className="kpi-card revenue-card">
        <div className="kpi-card-glow"></div>
        <div className="kpi-card-bubble bubble-1"></div>
        <div className="kpi-card-bubble bubble-2"></div>
        <div className="kpi-card-content">
          <div className="kpi-icon-box">
            <Wallet size={20} />
          </div>
          <div>
            <h4 className="kpi-label">Gross Revenue</h4>
            <p className="kpi-val">Rs. {grossRevenue.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Invoices Completed Card */}
      <div className="kpi-card invoices-card">
        <div className="kpi-card-glow"></div>
        <div className="kpi-card-bubble bubble-1"></div>
        <div className="kpi-card-bubble bubble-2"></div>
        <div className="kpi-card-content">
          <div className="kpi-icon-box">
            <ShoppingCart size={20} />
          </div>
          <div>
            <h4 className="kpi-label">Invoices Completed</h4>
            <p className="kpi-val">{ordersCount}</p>
          </div>
        </div>
      </div>

      {/* Average Basket Card */}
      <div className="kpi-card basket-card">
        <div className="kpi-card-glow"></div>
        <div className="kpi-card-bubble bubble-1"></div>
        <div className="kpi-card-bubble bubble-2"></div>
        <div className="kpi-card-content">
          <div className="kpi-icon-box">
            <TrendingUp size={20} />
          </div>
          <div>
            <h4 className="kpi-label">Average Basket</h4>
            <p className="kpi-val">Rs. {Math.round(avgTicket).toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Stock Alerts Card */}
      <div className="kpi-card alerts-card">
        <div className="kpi-card-glow"></div>
        <div className="kpi-card-bubble bubble-1"></div>
        <div className="kpi-card-bubble bubble-2"></div>
        <div className="kpi-card-content">
          <div className="kpi-icon-box">
            <AlertTriangle size={20} />
          </div>
          <div>
            <h4 className="kpi-label">Stock Alerts</h4>
            <p className="kpi-val" style={{ color: (outOfStockCount > 0 || lowStockCount > 0) ? '#ef4444' : 'inherit', fontSize: '18px' }}>
              {outOfStockCount} Out of Stock
            </p>
            <p className="kpi-sub-label">
              {lowStockCount} Low Stock Items
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
