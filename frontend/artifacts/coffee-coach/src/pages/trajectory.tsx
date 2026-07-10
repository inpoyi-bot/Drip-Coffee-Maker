import { useMemo } from 'react';
import { getCupHistory } from '@/lib/session';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';
import { CupTimeline } from '@/components/timeline';

export default function Trajectory() {
  const history = getCupHistory();

  const chartData = useMemo(() => {
    return history.map((cup, i) => {
      return {
        name: `Cup ${cup.cup_no || i + 1}`,
        cup_no: cup.cup_no || i + 1,
        value: i + 1, // simplified climbing value
        date: cup.date || cup.recordedAt?.slice(0, 10),
        reason: cup.terminate_reason || 'N/A'
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
                  formatter={(value: any, name: any, props: any) => [props.payload.reason, 'Reason']}
                  labelStyle={{ color: 'hsl(var(--slate))', marginBottom: '4px' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke="hsl(var(--chart-1))" 
                  strokeWidth={2} 
                  dot={{ r: 4, fill: 'hsl(var(--paper))', stroke: 'hsl(var(--chart-1))', strokeWidth: 2 }} 
                  activeDot={{ r: 6, fill: 'hsl(var(--chart-1))' }}
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
