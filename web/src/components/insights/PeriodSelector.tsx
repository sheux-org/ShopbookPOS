import React from 'react';
import { useTranslation } from '../../hooks/useTranslation';

interface PeriodSelectorProps {
  period: 'daily' | 'yesterday' | 'weekly' | 'monthly' | 'yearly' | 'custom';
  setPeriod: (p: 'daily' | 'yesterday' | 'weekly' | 'monthly' | 'yearly' | 'custom') => void;
}

export default function PeriodSelector({ period, setPeriod }: PeriodSelectorProps) {
  const { t } = useTranslation();

  return (
    <div className="period-tabs-bar">
      <button
        type="button"
        className={`period-tab-btn ${period === 'daily' ? 'active' : ''}`}
        onClick={() => setPeriod('daily')}
      >
        {t('insights.today')}
      </button>
      <button
        type="button"
        className={`period-tab-btn ${period === 'yesterday' ? 'active' : ''}`}
        onClick={() => setPeriod('yesterday')}
      >
        {t('insights.yesterday')}
      </button>
      <button
        type="button"
        className={`period-tab-btn ${period === 'weekly' ? 'active' : ''}`}
        onClick={() => setPeriod('weekly')}
      >
        {t('insights.thisWeek')}
      </button>
      <button
        type="button"
        className={`period-tab-btn ${period === 'monthly' ? 'active' : ''}`}
        onClick={() => setPeriod('monthly')}
      >
        {t('insights.thisMonth')}
      </button>
      <button
        type="button"
        className={`period-tab-btn ${period === 'yearly' ? 'active' : ''}`}
        onClick={() => setPeriod('yearly')}
      >
        {t('insights.thisYear')}
      </button>
      <button
        type="button"
        className={`period-tab-btn ${period === 'custom' ? 'active' : ''}`}
        onClick={() => setPeriod('custom')}
      >
        {t('insights.customRange')}
      </button>
    </div>
  );
}
