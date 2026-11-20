import React, { useState } from 'react';
import type {
  CategoryBreakdownItem,
  CurrencyCode,
  DailySeriesPoint,
  MonthlySeriesPoint,
} from '../types/finance';
import { formatMoney } from '../utils/currency';

interface MonthlyGraphProps {
  data: MonthlySeriesPoint[];
  selectedMonth: string;
  onSelectMonth: (month: string) => void;
  currency: CurrencyCode;
}

export const MonthlyGraphChart: React.FC<MonthlyGraphProps> = ({
  data,
  selectedMonth,
  onSelectMonth,
  currency,
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const width = 760;
  const height = 270;
  const padLeft = 64;
  const padRight = 20;
  const padTop = 24;
  const padBottom = 40;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const maxVal = Math.max(
    1,
    ...data.map((d) => Math.max(d.spent, d.budget))
  );
  const niceMax = maxVal * 1.15;

  const slotW = plotW / Math.max(1, data.length);
  const barW = Math.min(36, Math.max(14, slotW * 0.56));

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
    ratio: t,
    val: niceMax * t,
    y: padTop + plotH - plotH * t,
  }));

  const budgetY =
    data.length > 0 && data[0].budget > 0
      ? padTop + plotH - (data[0].budget / niceMax) * plotH
      : null;

  const activePoint = hoveredIdx !== null ? data[hoveredIdx] : null;

  return (
    <div className="relative w-full">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3 text-xs text-slate-600 dark:text-slate-400">
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-teal-600 dark:bg-teal-500 inline-block" />
            Monthly Spend
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-red-600 dark:bg-red-500 inline-block" />
            Over Budget
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-4 border-t-2 border-dashed border-amber-600 dark:border-amber-400 inline-block" />
            Budget Cap
          </span>
        </div>
        {activePoint && (
          <div className="font-mono-num text-xs text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md">
            {activePoint.label}: {formatMoney(activePoint.spent, currency)} ({activePoint.count} items)
          </div>
        )}
      </div>

      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full min-w-[480px] h-auto select-none"
          role="img"
          aria-label="Monthly spending versus budget bar chart"
        >
          {yTicks.map((tick) => (
            <g key={tick.ratio}>
              <line
                x1={padLeft}
                x2={width - padRight}
                y1={tick.y}
                y2={tick.y}
                className="stroke-slate-200 dark:stroke-slate-800"
                strokeWidth={1}
              />
              <text
                x={padLeft - 8}
                y={tick.y + 4}
                textAnchor="end"
                className="fill-slate-500 dark:fill-slate-400 text-[11px] font-mono-num"
              >
                {formatMoney(tick.val, currency, true)}
              </text>
            </g>
          ))}

          {budgetY !== null && budgetY >= padTop && budgetY <= padTop + plotH && (
            <line
              x1={padLeft}
              x2={width - padRight}
              y1={budgetY}
              y2={budgetY}
              className="stroke-amber-600 dark:stroke-amber-400"
              strokeWidth={1.5}
              strokeDasharray="6 4"
            />
          )}

          {data.map((point, idx) => {
            const barH = (point.spent / niceMax) * plotH;
            const x = padLeft + idx * slotW + (slotW - barW) / 2;
            const y = padTop + plotH - barH;
            const isSelected = point.month === selectedMonth;
            const isOver = point.budget > 0 && point.spent > point.budget;
            const isHovered = hoveredIdx === idx;

            return (
              <g
                key={point.month}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                onClick={() => onSelectMonth(point.month)}
              >
                <rect
                  x={padLeft + idx * slotW}
                  y={padTop}
                  width={slotW}
                  height={plotH}
                  fill="transparent"
                />
                {isSelected && (
                  <rect
                    x={x - 4}
                    y={padTop}
                    width={barW + 8}
                    height={plotH}
                    rx={6}
                    className="fill-slate-100/80 dark:fill-slate-800/50"
                  />
                )}
                <rect
                  x={x}
                  y={Math.min(y, padTop + plotH - 2)}
                  width={barW}
                  height={Math.max(point.spent > 0 ? 3 : 1, barH)}
                  rx={4}
                  className={
                    isOver
                      ? 'fill-red-600 dark:fill-red-500 transition-opacity'
                      : isSelected
                      ? 'fill-teal-700 dark:fill-teal-400 transition-opacity'
                      : 'fill-teal-600/80 dark:fill-teal-500/75 transition-opacity'
                  }
                  opacity={hoveredIdx !== null && !isHovered ? 0.65 : 1}
                />
                <text
                  x={padLeft + idx * slotW + slotW / 2}
                  y={height - 14}
                  textAnchor="middle"
                  className={`text-[11px] font-mono-num ${
                    isSelected
                      ? 'fill-slate-900 dark:fill-white font-semibold'
                      : 'fill-slate-500 dark:fill-slate-400'
                  }`}
                >
                  {point.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};

interface DailyCashflowProps {
  data: DailySeriesPoint[];
  currency: CurrencyCode;
}

export const DailyCashflowChart: React.FC<DailyCashflowProps> = ({ data, currency }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const width = 760;
  const height = 220;
  const padLeft = 64;
  const padRight = 16;
  const padTop = 18;
  const padBottom = 34;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const maxDaily = Math.max(1, ...data.map((d) => d.spent)) * 1.15;
  const slotW = plotW / Math.max(1, data.length);
  const barW = Math.max(6, slotW * 0.62);

  const yTicks = [0, 0.5, 1].map((t) => ({
    ratio: t,
    val: maxDaily * t,
    y: padTop + plotH - plotH * t,
  }));

  const hovered = hoveredIdx !== null ? data[hoveredIdx] : null;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2 min-h-[24px]">
        <span className="text-xs text-slate-500 dark:text-slate-400">
          Daily spend bars across the selected month
        </span>
        {hovered && (
          <span className="font-mono-num text-xs text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded">
            {hovered.date}: {formatMoney(hovered.spent, currency)} · Cum. {formatMoney(hovered.cumulative, currency)}
          </span>
        )}
      </div>

      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full min-w-[440px] h-auto select-none"
          role="img"
          aria-label="Daily spending breakdown chart"
        >
          {yTicks.map((tick) => (
            <g key={tick.ratio}>
              <line
                x1={padLeft}
                x2={width - padRight}
                y1={tick.y}
                y2={tick.y}
                className="stroke-slate-200 dark:stroke-slate-800"
                strokeWidth={1}
              />
              <text
                x={padLeft - 8}
                y={tick.y + 4}
                textAnchor="end"
                className="fill-slate-500 dark:fill-slate-400 text-[11px] font-mono-num"
              >
                {formatMoney(tick.val, currency, true)}
              </text>
            </g>
          ))}

          {data.map((point, idx) => {
            const barH = (point.spent / maxDaily) * plotH;
            const x = padLeft + idx * slotW + (slotW - barW) / 2;
            const y = padTop + plotH - barH;
            const showLabel = point.day === 1 || point.day % 5 === 0 || point.day === data.length;

            return (
              <g
                key={point.day}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                <rect
                  x={padLeft + idx * slotW}
                  y={padTop}
                  width={slotW}
                  height={plotH}
                  fill="transparent"
                />
                <rect
                  x={x}
                  y={point.spent > 0 ? Math.min(y, padTop + plotH - 3) : padTop + plotH - 1}
                  width={barW}
                  height={point.spent > 0 ? Math.max(3, barH) : 1}
                  rx={2}
                  className={
                    point.spent > 0
                      ? 'fill-slate-700 dark:fill-teal-400'
                      : 'fill-slate-200 dark:fill-slate-800'
                  }
                  opacity={hoveredIdx !== null && hoveredIdx !== idx ? 0.55 : 1}
                />
                {showLabel && (
                  <text
                    x={padLeft + idx * slotW + slotW / 2}
                    y={height - 10}
                    textAnchor="middle"
                    className="fill-slate-500 dark:fill-slate-400 text-[10px] font-mono-num"
                  >
                    {point.day}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};

interface CategoryDonutProps {
  items: CategoryBreakdownItem[];
  currency: CurrencyCode;
}

export const CategoryDonutChart: React.FC<CategoryDonutProps> = ({ items, currency }) => {
  const nonZero = items.filter((i) => i.spent > 0);
  const total = nonZero.reduce((acc, i) => acc + i.spent, 0);

  const radius = 56;
  const circumference = 2 * Math.PI * radius;

  let offset = 0;

  return (
    <div className="flex flex-col sm:flex-row lg:flex-col 2xl:flex-row items-center gap-5">
      <div className="relative w-32 h-32 shrink-0 flex items-center justify-center">
        <svg viewBox="0 0 144 144" className="w-full h-full -rotate-90" role="img" aria-label="Category spending distribution">
          <circle
            cx="72"
            cy="72"
            r={radius}
            fill="none"
            strokeWidth="16"
            className="stroke-slate-100 dark:stroke-slate-800"
          />
          {nonZero.map((item) => {
            const pct = total > 0 ? item.spent / total : 0;
            const dash = pct * circumference;
            const segOffset = offset;
            offset += dash;
            return (
              <circle
                key={item.category}
                cx="72"
                cy="72"
                r={radius}
                fill="none"
                stroke={item.color}
                strokeWidth="16"
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-segOffset}
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-2">
          <span className="text-[11px] text-slate-500 dark:text-slate-400">Total</span>
          <span className="font-mono-num text-xs font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[92px]">
            {formatMoney(total, currency, true)}
          </span>
        </div>
      </div>

      <div className="flex-1 w-full space-y-2.5">
        {nonZero.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No expenses recorded for this month yet.
          </p>
        ) : (
          nonZero.slice(0, 6).map((item) => (
            <div key={item.category} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-medium truncate">
                  <span
                    className="w-2.5 h-2.5 rounded-xs shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  {item.label}
                </span>
                <span className="font-mono-num text-slate-900 dark:text-slate-100 shrink-0 ml-2">
                  {formatMoney(item.spent, currency)} · {item.sharePct.toFixed(0)}%
                </span>
              </div>
              <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(100, item.sharePct)}%`,
                    backgroundColor: item.color,
                  }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
