import React from 'react';

interface RevenueChartProps {
  chartData: { label: string; value: number }[];
  chartTitle: string;
  maxChartVal: number;
}

export default function RevenueChart({
  chartData,
  chartTitle,
  maxChartVal,
}: RevenueChartProps) {
  return (
    <div className="chart-card">
      <h3 className="chart-title">{chartTitle}</h3>
      <div className="chart-wrapper">
        <div className="chart-bars-container">
          {chartData.map((data: any, idx: number) => {
            const percent = ((data.value || 0) / maxChartVal) * 100;
            return (
              <div key={idx} className="chart-col">
                <div className="chart-tooltip">
                  Rs. {data.value.toLocaleString()}
                </div>
                <div 
                  className="chart-bar" 
                  style={{ height: `${Math.max(4, percent)}%` }} 
                />
                <span className="chart-day-text">{data.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
