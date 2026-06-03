import React from 'react';

interface PeriodSelectorProps {
  period: 'daily' | 'yesterday' | 'weekly' | 'monthly' | 'yearly' | 'custom';
  setPeriod: (p: 'daily' | 'yesterday' | 'weekly' | 'monthly' | 'yearly' | 'custom') => void;
}

export default function PeriodSelector({ period, setPeriod }: PeriodSelectorProps) {
  return (
    <div className="period-tabs-bar">
      <button 
        type="button"
        className={`period-tab-btn ${period === 'daily' ? 'active' : ''}`}
        onClick={() => setPeriod('daily')}
      >
        Today
      </button>
      <button 
        type="button"
        className={`period-tab-btn ${period === 'yesterday' ? 'active' : ''}`}
        onClick={() => setPeriod('yesterday')}
      >
        Yesterday
      </button>
      <button 
        type="button"
        className={`period-tab-btn ${period === 'weekly' ? 'active' : ''}`}
        onClick={() => setPeriod('weekly')}
      >
        Week
      </button>
      <button 
        type="button"
        className={`period-tab-btn ${period === 'monthly' ? 'active' : ''}`}
        onClick={() => setPeriod('monthly')}
      >
        Monthly
      </button>
      <button 
        type="button"
        className={`period-tab-btn ${period === 'yearly' ? 'active' : ''}`}
        onClick={() => setPeriod('yearly')}
      >
        Yearly
      </button>
      <button 
        type="button"
        className={`period-tab-btn ${period === 'custom' ? 'active' : ''}`}
        onClick={() => setPeriod('custom')}
      >
        Custom
      </button>
    </div>
  );
}
