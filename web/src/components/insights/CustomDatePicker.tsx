import React from 'react';
import { Calendar } from 'lucide-react';

interface CustomDatePickerProps {
  customStart: string;
  customEnd: string;
  showCalendar: boolean;
  setShowCalendar: (b: boolean) => void;
  viewMonth: number;
  viewYear: number;
  calendarDays: any[];
  monthsNames: string[];
  handlePrevMonth: () => void;
  handleNextMonth: () => void;
  handleDateClick: (dateStr: string) => void;
  handleClearDates: () => void;
}

export default function CustomDatePicker({
  customStart,
  customEnd,
  showCalendar,
  setShowCalendar,
  viewMonth,
  viewYear,
  calendarDays,
  monthsNames,
  handlePrevMonth,
  handleNextMonth,
  handleDateClick,
  handleClearDates,
}: CustomDatePickerProps) {
  return (
    <div className="custom-date-card-wrapper" style={{ position: 'relative', width: '100%' }}>
      <div className="custom-date-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button 
          type="button" 
          className="calendar-trigger-btn"
          onClick={() => setShowCalendar(!showCalendar)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 16px',
            border: '1.5px solid var(--insights-glass-border)',
            borderRadius: '12px',
            backgroundColor: '#ffffff',
            color: 'var(--dark)',
            fontWeight: 600,
            fontSize: '13px',
            cursor: 'pointer',
            width: '100%',
            textAlign: 'left',
            transition: 'all 0.2s'
          }}
        >
          <Calendar size={16} color="var(--primary)" />
          <span>
            {customStart && customEnd 
              ? `${new Date(customStart).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} - ${new Date(customEnd).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}` 
              : (customStart ? `Starting ${new Date(customStart).toLocaleDateString([], { month: 'short', day: 'numeric' })}` : "Select Custom Date Range")}
          </span>
        </button>
      </div>

      {showCalendar && (
        <div className="calendar-popover" style={{
          position: 'absolute',
          top: '105%',
          left: 0,
          zIndex: 100,
          backgroundColor: '#ffffff',
          border: '1px solid var(--insights-glass-border)',
          borderRadius: '16px',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
          padding: '16px',
          width: '320px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          fontFamily: 'Inter, sans-serif'
        }}>
          <div className="calendar-popover-header" style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontWeight: 'bold',
            fontSize: '14px',
            color: 'var(--dark)'
          }}>
            <button 
              type="button" 
              onClick={handlePrevMonth} 
              className="calendar-arrow-btn"
              style={{
                background: 'none',
                border: 'none',
                fontSize: '16px',
                cursor: 'pointer',
                color: 'var(--muted)',
                padding: '4px 8px'
              }}
            >
              &larr;
            </button>
            <span className="calendar-month-year">
              {monthsNames[viewMonth]} {viewYear}
            </span>
            <button 
              type="button" 
              onClick={handleNextMonth} 
              className="calendar-arrow-btn"
              style={{
                background: 'none',
                border: 'none',
                fontSize: '16px',
                cursor: 'pointer',
                color: 'var(--muted)',
                padding: '4px 8px'
              }}
            >
              &rarr;
            </button>
          </div>

          <div className="calendar-weekdays" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            textAlign: 'center',
            fontSize: '10px',
            fontWeight: 800,
            color: 'var(--muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => (
              <span key={i} className="calendar-weekday-label">{d}</span>
            ))}
          </div>

          <div className="calendar-days-grid" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: '4px'
          }}>
            {calendarDays.map((dayObj, i) => {
              const isSelectedStart = customStart === dayObj.dateStr;
              const isSelectedEnd = customEnd === dayObj.dateStr;
              const isInRange = customStart && customEnd && 
                dayObj.dateStr > customStart && dayObj.dateStr < customEnd;
              return (
                <button
                  key={i}
                  type="button"
                  disabled={!dayObj.isCurrentMonth}
                  className={`calendar-day-cell ${!dayObj.isCurrentMonth ? 'outside' : ''} ${isSelectedStart ? 'selected-start' : ''} ${isSelectedEnd ? 'selected-end' : ''} ${isInRange ? 'in-range' : ''}`}
                  onClick={() => handleDateClick(dayObj.dateStr)}
                  style={{
                    padding: '8px 0',
                    border: 'none',
                    borderRadius: '8px',
                    backgroundColor: isSelectedStart || isSelectedEnd 
                      ? 'var(--primary)' 
                      : isInRange 
                        ? 'var(--light-blue)' 
                        : 'transparent',
                    color: isSelectedStart || isSelectedEnd 
                      ? '#ffffff' 
                      : !dayObj.isCurrentMonth 
                        ? 'var(--border)' 
                        : 'var(--dark)',
                    fontWeight: isSelectedStart || isSelectedEnd || isInRange ? 'bold' : 'normal',
                    fontSize: '12px',
                    cursor: dayObj.isCurrentMonth ? 'pointer' : 'default',
                    transition: 'all 0.15s'
                  }}
                >
                  {dayObj.day}
                </button>
              );
            })}
          </div>

          <div className="calendar-popover-footer" style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderTop: '1px solid var(--border)',
            paddingTop: '12px',
            marginTop: '4px'
          }}>
            <button 
              type="button" 
              className="calendar-clear-btn" 
              onClick={handleClearDates}
              style={{
                padding: '6px 12px',
                border: 'none',
                background: 'none',
                color: 'var(--muted)',
                fontWeight: 700,
                fontSize: '11px',
                cursor: 'pointer'
              }}
            >
              Clear
            </button>
            <button 
              type="button" 
              className="calendar-apply-btn" 
              onClick={() => setShowCalendar(false)}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: 'var(--primary)',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '11px',
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)'
              }}
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
