import { useMemo } from 'react';
import { getCupHistory, type StoredCup } from '@/lib/session';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CupTimeline } from '@/components/timeline';
import {
  adjustmentLabel,
  gradientLabel,
  grindNowLabel,
  terminateReasonLabel,
  turnTypeLabel,
} from '@/lib/diagnosisCopy';

/*
 * Visual-review data for the explicit ?sample=trajectory route only. It is a
 * faithful front-end rendering of docs/demo-arc.md, never persisted and never
 * used when the user has real saved cups.
 */
const TRAJECTORY_VISUAL_SAMPLE: StoredCup[] = [
  {
    cup_no: 1,
    date: '2026-07-01',
    turn_type: 'adjust',
    gradient: '变好+同向',
    direction: 'finer',
    step: 2,
    decision: '继续',
    grind_now: '基准偏粗',
    confidence: 'high',
    recordedAt: '2026-07-01T09:00:00.000Z',
  },
  {
    cup_no: 2,
    date: '2026-07-02',
    turn_type: 'adjust',
    gradient: '变好+同向',
    direction: 'finer',
    step: 2,
    decision: '继续',
    grind_now: '较基准磨细 2 格',
    confidence: 'high',
    recordedAt: '2026-07-02T09:00:00.000Z',
  },
  {
    cup_no: 3,
    date: '2026-07-03',
    turn_type: 'adjust',
    gradient: '变好+同向',
    direction: 'finer',
    step: 2,
    decision: '继续',
    grind_now: '较基准磨细 4 格',
    confidence: 'high',
    recordedAt: '2026-07-03T09:00:00.000Z',
  },
  {
    cup_no: 4,
    date: '2026-07-04',
    turn_type: 'terminate',
    terminate_reason: 'satisfied',
    gradient: '已收敛',
    decision: '停手',
    grind_now: '较基准磨细 6 格',
    confidence: 'high',
    recordedAt: '2026-07-04T09:00:00.000Z',
  },
];

function TrajectoryDot({ cx, cy, payload }: any) {
  const isCurrentConvergence = payload?.isCurrentConvergence;
  const color = isCurrentConvergence ? 'hsl(var(--converge))' : 'hsl(var(--slate))';

  return (
    <g>
      {isCurrentConvergence && (
        <circle
          cx={cx}
          cy={cy}
          r={14}
          fill="hsl(var(--converge))"
          fillOpacity={0.26}
          filter="url(#trajectory-convergence-glow)"
        />
      )}
      <circle
        cx={cx}
        cy={cy}
        r={isCurrentConvergence ? 4.5 : 3}
        fill={isCurrentConvergence ? color : 'hsl(var(--surface-raised))'}
        stroke={color}
        strokeWidth={isCurrentConvergence ? 2 : 1.25}
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
  const savedHistory = getCupHistory();
  const isVisualSample =
    savedHistory.length === 0 &&
    new URLSearchParams(window.location.search).get('sample') === 'trajectory';
  const history = isVisualSample ? TRAJECTORY_VISUAL_SAMPLE : savedHistory;
  const currentCup = history[history.length - 1];
  const currentTurnType = turnTypeLabel(currentCup?.turn_type);
  const currentGrind = grindNowLabel(currentCup?.grind_now);
  const isCurrentConverged =
    currentCup?.gradient === '已收敛' ||
    currentCup?.terminate_reason === 'satisfied' ||
    currentCup?.terminate_reason === 'would_overextract';

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
        isCurrentConvergence:
          i === history.length - 1 &&
          (cup.gradient === '已收敛' ||
            cup.terminate_reason === 'satisfied' ||
            cup.terminate_reason === 'would_overextract'),
      };
    });
  }, [history]);

  return (
    <div className="trajectory-page p-4 space-y-6">
      <div className="space-y-1">
        <h1 className="font-sans font-medium text-xl text-foreground">收敛轨迹</h1>
        <p className="trajectory-proof text-muted-foreground text-xs font-mono border border-border bg-card p-2 rounded mt-2 block">
          {isVisualSample
            ? '视觉样张：来自 demo-arc，不写入你的保存记录。'
            : '这些杯子来自你保存的记录，不是当前对话上下文。'}
        </p>
      </div>

      {history.length > 0 ? (
        <>
          <section className="trajectory-card trajectory-current-card bg-card border border-border p-4 space-y-3" aria-labelledby="current-status-heading">
            <div className="flex items-center justify-between gap-3">
              <h2 id="current-status-heading" className="font-sans font-medium text-base text-foreground">当前状态</h2>
              <span className="font-mono text-xs text-muted-foreground">第 {currentCup.cup_no || history.length} 杯</span>
            </div>
            <div className="grid gap-3 text-sm sm:grid-cols-3">
              <div>
                <span className="block font-mono text-xs text-muted-foreground">状态</span>
                <span className="text-foreground">{currentTurnType || '正在记录'}</span>
              </div>
              <div>
                <span className="block font-mono text-xs text-muted-foreground">当前研磨</span>
                <span className="text-foreground">{currentGrind || '暂未记录'}</span>
              </div>
              <div>
                <span className="block font-mono text-xs text-muted-foreground">研磨调整</span>
                <span className="text-foreground">{isCurrentConverged ? '已完成' : '继续校准中'}</span>
              </div>
            </div>
          </section>

          <section className="trajectory-card trajectory-chart-card bg-card border border-border p-4 space-y-4" aria-labelledby="trajectory-chart-heading">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="trajectory-chart-heading" className="font-sans font-medium text-base text-foreground">跨杯相对趋势</h2>
                <p className="mt-1 font-mono text-[11px] text-muted-foreground">只读取相对上一杯的反馈梯度</p>
              </div>
              <span className="font-mono text-[11px] text-muted-foreground">CUP 01–{String(history.length).padStart(2, '0')}</span>
            </div>
            <div className="h-[300px] w-full mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 16, right: 12, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="trajectory-line" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="hsl(var(--slate))" />
                      <stop offset="64%" stopColor="hsl(var(--slate))" />
                      <stop offset="100%" stopColor="hsl(var(--converge))" />
                    </linearGradient>
                    <linearGradient id="trajectory-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--converge-deep))" stopOpacity={0.52} />
                      <stop offset="72%" stopColor="hsl(var(--converge-deep))" stopOpacity={0.13} />
                      <stop offset="100%" stopColor="hsl(var(--converge-deep))" stopOpacity={0} />
                    </linearGradient>
                    <filter id="trajectory-convergence-glow" x="-100%" y="-100%" width="300%" height="300%">
                      <feGaussianBlur stdDeviation="6" />
                    </filter>
                  </defs>
                  <CartesianGrid strokeDasharray="2 5" stroke="hsl(var(--line))" strokeOpacity={0.72} vertical={false} />
                  <XAxis
                    dataKey="cup_no"
                    tick={{ fill: 'hsl(var(--slate))', fontSize: 12, fontFamily: 'var(--app-font-mono)' }}
                    axisLine={{ stroke: 'hsl(var(--line))' }}
                    tickLine={false}
                    tickMargin={10}
                  />
                  <YAxis
                    domain={['dataMin - 1', 'dataMax + 1']}
                    tick={{ fill: 'hsl(var(--slate))', fontSize: 10, fontFamily: 'var(--app-font-mono)' }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `${value > 0 ? '+' : ''}${value}`}
                    width={34}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--surface-raised))', border: '1px solid hsl(var(--line))', borderRadius: '6px', fontSize: '12px', fontFamily: 'var(--app-font-mono)', boxShadow: '0 12px 32px rgba(0, 0, 0, 0.28)' }}
                    itemStyle={{ color: 'hsl(var(--text))' }}
                    formatter={(value: any, name: any, props: any) => [props.payload.tooltipText, props.payload.tooltipLabel]}
                    labelStyle={{ color: 'hsl(var(--text-dim))', marginBottom: '4px' }}
                  />
                  <Area type="monotone" dataKey="value" stroke="none" fill="url(#trajectory-fill)" isAnimationActive={false} />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="url(#trajectory-line)"
                    strokeWidth={2}
                    dot={<TrajectoryDot />}
                    activeDot={false}
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </section>
        </>
      ) : (
        <div className="trajectory-card p-8 text-center text-muted-foreground text-sm font-mono border border-dashed border-border bg-card">
          还没有记录
        </div>
      )}

      <div className="pt-2">
         <CupTimeline history={history} />
      </div>
    </div>
  );
}
