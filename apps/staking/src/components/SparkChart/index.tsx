"use client";

import { ResponsiveContainer, LineChart, Tooltip, Line, XAxis } from "recharts";
import resolveConfig from "tailwindcss/resolveConfig";

import tailwindConfig from "../../../tailwind.config";
import { Date } from "../Date";

const fullConfig = resolveConfig(tailwindConfig);

type Props = {
  data: { date: Date; value: number }[];
};

export const SparkChart = ({ data }: Props) => (
  <ResponsiveContainer width="100%" height="100%">
    <LineChart data={data}>
      <Tooltip
        content={<TooltipContent />}
        allowEscapeViewBox={{ x: true, y: true }}
      />
      <Line
        type="monotone"
        dataKey="value"
        stroke={fullConfig.theme.colors.pythpurple[400]}
      />
      <XAxis dataKey="date" hide />
    </LineChart>
  </ResponsiveContainer>
);

type TooltipProps = {
  label?: Date;
  payload?: {
    value?: number;
  }[];
};

const TooltipContent = ({ payload, label }: TooltipProps) => (
  <div className="flex flex-row gap-2 border border-pythpurple-400 bg-pythpurple-950 p-2 text-xs shadow">
    {label && <Date className="font-medium">{label}</Date>}
    <span>{payload?.[0]?.value ?? 0}%</span>
  </div>
);
