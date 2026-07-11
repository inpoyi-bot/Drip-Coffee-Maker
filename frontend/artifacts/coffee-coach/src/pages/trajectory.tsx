import { useMemo } from 'react';
import { getCupHistory } from '@/lib/session';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';
import { CupTimeline } from '@/components/timeline';
import { adjustmentLabel, gradientLabel, terminateReasonLabel } from '@/lib/diagnosisCopy';

function TrajectoryDot({ cx, cy, payload, r = 4 }: any) {
  const color = payload?.isConverged
    ? 'hsl(var(--converge))'
    : 'hsl(var(--slate))';

  return (
    <g>
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill={payload?.isConverged ? color : 'hsl(var(--paper))'}
        stroke={color}
        strokeWidth={2}
      />
      {payload?.turnbackLabel && (
        <text
          x={cx}
          y={cy - 12}
          textAnchor="middle"
          fill="hsl(var(--slate))"
          fontSize={10}
          fontFamily="var(--app-font-mono)"
        >
          {payload.turnbackLabel}
        </text>
      )}
    </g>
  );
}

export default function Trajectory() {
  const history = getCupHistory();

  const chartData = useMemo(() => {
    let relativeHeight = 0;

    return history.map((cup, i) => {
      if (cup.gradient === '变好+同向' || cup.gradient === '变好' || cup.gradient === '已收敛') {
        relativeHeight += 1;
      } else if (cup.gradient === '变坏') {
        relativeHeight -= 1;
      }

      const terminateReasonText = terminateReasonLabel(cup.terminate_reason);
      const gradientText = gradientLabel(cup.gradient);
      const adjustmentText = adjustmentLabel(cup.direction, cup.step);

      return {
        name: `Cup ${cup.cup_no || i + 1}`,
        cup_no: cup.cup_no || i + 1,
        value: relativeHeight,
        date: cup.date || cup.recordedAt?.slice(0, 10),
        tooltipText: terminateReasonText || gradientText || '暂未记录变化',
        tooltipLabel: terminateReasonText ? '这一轮判断' : '变化',
        turnbackLabel:
          cup.gradient === '变坏' && cup.direction === 'coarser' && adjustmentText
            ? `${gradientText} → ${adjustmentText}`
            : undefined,
        isConverged:
          cup.gradient === '已收敛' ||
          cup.terminate_reason === 'satisfied' ||
          cup.terminate_reason === 'would_overextract',
      };
    });
  }, [history]);

  return (
    <div className="p-4 space-y-6">
      <div className="space-y-1">
        <h1 className="font-sans font-medium text-xl text-foreground">收敛轨迹</h1>
        <p className="text-muted-foreground text-xs font-mono border border-border bg-card p-2 rounded mt-2 block">
          这些杯子来自你保存的记录，不是当前对话上下文。
        </p>
      </div>

      {history.length > 0 ? (
        <div className="bg-card border border-border p-4 shadow-sm space-y-4">
          <div className="h-[300px] w-full mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--mist))" vertical={false} />
                <XAxis 
                  dataKey="cup_no" 
                  tick={{ fill: 'hsl(var(--slate))', fontSize: 12, fontFamily: 'var(--app-font-mono)' }} 
                  axisLine={false} 
                  tickLine={false}
                  tickMargin={10}
                />
                <YAxis hide domain={['dataMin - 1', 'dataMax + 1']} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'hsl(var(--fog))', border: '1px solid hsl(var(--mist))', borderRadius: '6px', fontSize: '12px', fontFamily: 'var(--app-font-mono)' }}
                  itemStyle={{ color: 'hsl(var(--ink))' }}
                  formatter={(value: any, name: any, props: any) => [props.payload.tooltipText, props.payload.tooltipLabel]}
                  labelStyle={{ color: 'hsl(var(--slate))', marginBottom: '4px' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke="hsl(var(--slate))"
                  strokeWidth={2} 
                  dot={TrajectoryDot}
                  activeDot={(props: any) => <TrajectoryDot {...props} r={6} />}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div className="p-8 text-center text-muted-foreground text-sm font-mono border border-dashed border-border bg-card">
          还没有记录
        </div>
      )}

      <div className="pt-2">
         <CupTimeline />
      </div>
    </div>
  );
}
