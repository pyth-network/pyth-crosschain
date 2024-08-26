"use client";

import { useCallback } from "react";
import { ResponsiveContainer, LineChart, Tooltip, Line, XAxis } from "recharts";

type Props = {
  data: { date: Date; value: number }[];
};

export const SparkChart = ({ data }: Props) => {
  const formatDate = useCallback((date: Date) => date.toLocaleDateString(), []);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <Tooltip
          content={<TooltipContent formatDate={formatDate} />}
          allowEscapeViewBox={{ x: true, y: true }}
        />
        <Line type="monotone" dataKey="value" />
        <XAxis dataKey="date" hide />
      </LineChart>
    </ResponsiveContainer>
  );
};

type TooltipProps = {
  formatDate: (date: Date) => string;
  label?: Date;
  payload?: {
    value?: number;
  }[];
};

const TooltipContent = ({ payload, label, formatDate }: TooltipProps) => (
  <div className="flex flex-row gap-2 rounded bg-white p-2 text-xs shadow">
    <span className="font-medium">{label ? formatDate(label) : ""}</span>
    <span>{payload?.[0]?.value ?? 0}</span>
  </div>
);
