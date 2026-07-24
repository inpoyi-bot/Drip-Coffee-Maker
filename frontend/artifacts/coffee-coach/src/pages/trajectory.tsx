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
import { ChevronDown } from 'lucide-react';
import {
  adjustmentLabel,
  gradientLabel,
  grindNowLabel,
  terminateReasonLabel,
  turnTypeLabel,
} from '@/lib/diagnosisCopy';

/*
 * Visual-review data for the explicit ?sample=trajectory route only. It is a
 * faithful front-end rendering of docs/demo-arc.md. It is never persisted and
 * is used only when the explicit `?sample=trajectory` query parameter is set.
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

const FORWARD_PHRASE = '方向对了,继续推进';

function countText(count: number): string {
  const numerals = ['零', '一', '两', '三', '四', '五', '六', '七', '八', '九', '十'];
  return count <= 10 ? numerals[count] : String(count);
}

function phraseForCup(cup: StoredCup, isFirstAdjust: boolean): string | undefined {
  if (isFirstAdjust && cup.turn_type === 'adjust') return '认出欠萃';
  if (cup.gradient === '变好+同向') return FORWARD_PHRASE;
  if (cup.gradient === '变坏' && cup.direction === 'coarser') return '这一步过头了,回退一格';
  if (cup.turn_type === 'probe') return '线索还不够,再进一步探一探';
  if (cup.terminate_reason === 'satisfied') return '到位收手';
  return undefined;
}

function foldPhrases(phrases: string[]): string[] {
  const folded: string[] = [];

  for (let index = 0; index < phrases.length;) {
    const phrase = phrases[index];
    let count = 1;
    while (phrases[index + count] === phrase) count += 1;

    folded.push(
      count === 1
        ? phrase
        : phrase === FORWARD_PHRASE
          ? `连续${countText(count)}次方向对、继续推进`
          : `连续${countText(count)}次${phrase}`,
    );
    index += count;
  }

  return folded;
}

interface SatisfiedEnding {
  narrative: string;
  finalGrind?: string;
}

interface CapabilityNarrative {
  narrative: string;
}

function deriveCapabilityNarrative(
  history: StoredCup[],
  { skipTerminalCup = false }: { skipTerminalCup?: boolean } = {},
): CapabilityNarrative | null {
  const cupsToNarrate = skipTerminalCup ? history.slice(0, -1) : history;
  let sawFirstAdjust = false;
  const phrases: string[] = [];

  for (const cup of cupsToNarrate) {
    if (cup.turn_type === 'seed') continue;

    const phrase = phraseForCup(cup, !sawFirstAdjust);
    if (!phrase) {
      if (import.meta.env.DEV) console.warn('[trajectory] unmapped capability-narrative cup', cup);
      return null;
    }
    if (cup.turn_type === 'adjust') sawFirstAdjust = true;
    phrases.push(phrase);
  }

  if (!phrases.length) return null;

  return {
    narrative: `这包豆你走了 ${history.length} 杯。${foldPhrases(phrases).join(' → ')}。下次换一包新豆,你也知道该怎么读、怎么调、什么时候停了。`,
  };
}

/**
 * A read-only display projection of an already-completed happy-path history.
 * Returning null for an unmapped record prevents the UI from inventing a
 * phrase when the record contract grows beyond this card's scope.
 */
function deriveSatisfiedEnding(history: StoredCup[]): SatisfiedEnding | null {
  const lastCup = history[history.length - 1];
  if (lastCup?.terminate_reason !== 'satisfied') return null;

  const capability = deriveCapabilityNarrative(history);
  if (!capability) return null;

  return {
    narrative: capability.narrative,
    finalGrind: lastCup.grind_now?.trim() || undefined,
  };
}

type EndingRoute =
  | { kind: 'none' }
  | { kind: 'satisfied'; ending: SatisfiedEnding | null }
  | { kind: 'flavor_mismatch'; capability: CapabilityNarrative | null }
  | { kind: 'taste_unaddressable'; capability: CapabilityNarrative | null }
  | { kind: 'axis_limit_underextracted'; capability: CapabilityNarrative | null }
  | { kind: 'plateau_ambiguous' }
  | { kind: 'axis_unreliable' }
  | { kind: 'fallback' };

/**
 * The trajectory screen's only ending dispatcher. It reads the terminal cup
 * without writing to history or inferring facts that the record does not hold.
 */
function deriveEndingRoute(history: StoredCup[]): EndingRoute {
  const lastCup = history[history.length - 1];
  if (lastCup?.turn_type !== 'terminate') return { kind: 'none' };

  switch (lastCup.terminate_reason) {
    case 'satisfied':
      return { kind: 'satisfied', ending: deriveSatisfiedEnding(history) };
    case 'flavor_mismatch':
      return { kind: 'flavor_mismatch', capability: deriveCapabilityNarrative(history, { skipTerminalCup: true }) };
    case 'taste_unaddressable':
      return { kind: 'taste_unaddressable', capability: deriveCapabilityNarrative(history, { skipTerminalCup: true }) };
    case 'axis_limit_underextracted':
      return { kind: 'axis_limit_underextracted', capability: deriveCapabilityNarrative(history, { skipTerminalCup: true }) };
    case 'plateau_ambiguous':
      return { kind: 'plateau_ambiguous' };
    case 'axis_unreliable':
      return { kind: 'axis_unreliable' };
    default:
      return { kind: 'fallback' };
  }
}

type StaticEndingKind =
  | 'flavor_mismatch'
  | 'taste_unaddressable'
  | 'axis_limit_underextracted'
  | 'plateau_ambiguous'
  | 'axis_unreliable'
  | 'fallback';

const STATIC_ENDING_COPY: Record<StaticEndingKind, { status: string; paragraphs: string[] }> = {
  flavor_mismatch: {
    status: '状态:萃取到位了,剩下的是口味的事。',
    paragraphs: [
      '你这包豆的萃取已经调到位了——酸干净、有回甘,四项都到了。这一步你做成了。',
      '剩下的"还是不太喜欢",不是萃取的问题,而是这支豆的风味取向不太对你的口味——这个冲煮端调不动。想解决,方向是换一支风味不同的豆。口味没有标准答案,你现在知道该往哪儿找了。',
    ],
  },
  taste_unaddressable: {
    status: '状态:萃取到位了,这支豆很对你。',
    paragraphs: [
      '你这包豆的萃取已经调到位了,而且你喜欢它的酸——这支豆是对的,别换。',
      '你想要的"更厚一点",不在研磨这件事上,而在水温、接触时间、浓度那些地方——这一版我只调研磨,专注把这一件事帮你走到位。想往更厚走,是下一步可以探索的方向。你的方向没错,这支豆也值得留着。',
    ],
  },
  axis_limit_underextracted: {
    status: '状态:调整研磨能做的,做到头了。',
    paragraphs: [
      '这包豆你一路调研磨、一路在变好——从最开始的尖酸发空,到现在酸干净了很多、也能尝到一点甜。这套"看反馈、往好的方向调"的判断,你练到了。',
      '但到这一步,再磨细已经改变有限了:磨到更细会开始堵、细粉变多、流速不稳,而这杯离"酸能干净化成甜、喝完明显回甘"还差一点。光靠调研磨,这包豆到这儿就是上限了。',
      '这不是你的手法问题,是只调研磨这一件事能给的,就到这里。想再往前,得靠研磨以外的调整——那是这一版没做的部分,但你现在知道卡点在哪了。',
    ],
  },
  plateau_ambiguous: {
    status: '状态:到这儿了,我们停。',
    paragraphs: [
      '这包豆连着两杯没再变好,而且开始有点纸板感、香气也淡了。',
      '这种情况有两种可能:一种是研磨这件事已经做到头了;另一种是这包豆过了最佳赏味期、状态在走下坡。说实话,单看现在的信息,我没法确定是哪一种。',
      '但这两种情况有个共同点:继续磨细都帮不了你——如果是前者,再细只会过萃发苦;如果是豆子状态的问题,磨细也补不回已经淡掉的香气。',
      '所以我们在这儿停,不是因为调好了,而是因为再调下去对这包豆已经没有意义了。这不是你的手法问题,是现实条件决定的。',
    ],
  },
  axis_unreliable: {
    status: '状态:先换磨豆机,我们再一起把这包豆调到位。',
    paragraphs: [
      '你用的是砍豆机(靠刀片打碎的那种)。它磨出来的粉,粗细会两极分化——细的那部分萃过头发苦,粗的那部分没萃够发酸,同一杯里又酸又苦是这么来的,不是你冲得不对。',
      '我帮你调咖啡的办法,是每次只动一点点,再看这一杯比上一杯变好还是变坏,一步步逼近你的最佳点。但砍豆机每次磨出来的粗细都不太稳定,调了也分不清是调的作用还是磨的随机——没有稳定的反馈,这套方法就跑不起来。',
      '所以在换磨之前,我先不让你瞎调浪费豆子。换一台锥刀或平刀的磨豆机(手摇的也可以),磨出来的粉稳定了,我就能一步步帮你把这包豆调到位。这不是你的问题,是工具还没到位。',
    ],
  },
  fallback: {
    status: '状态:这包豆的调整到这儿结束了。',
    paragraphs: ['下面是你这几杯完整的调整过程和轨迹,可以回看每一步。'],
  },
};

function StaticEndingCard({ route }: { route: EndingRoute }) {
  if (route.kind === 'none' || route.kind === 'satisfied') return null;

  const copy = STATIC_ENDING_COPY[route.kind];
  const capability =
    route.kind === 'flavor_mismatch' ||
    route.kind === 'taste_unaddressable' ||
    route.kind === 'axis_limit_underextracted'
      ? route.capability
      : null;

  return (
    <section className="trajectory-card trajectory-current-card bg-card border border-border p-5 space-y-5" aria-label="本包豆的结束记录">
      {capability && <p className="text-base leading-7 text-foreground">{capability.narrative}</p>}
      <div className="space-y-3 text-sm leading-6 text-muted-foreground">
        <p className="font-medium text-foreground">{copy.status}</p>
        {copy.paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
    </section>
  );
}

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
  const isVisualSample = new URLSearchParams(window.location.search).get('sample') === 'trajectory';
  const history = isVisualSample ? TRAJECTORY_VISUAL_SAMPLE : savedHistory;
  const currentCup = history[history.length - 1];
  const currentTurnType = turnTypeLabel(currentCup?.turn_type);
  const currentGrind = grindNowLabel(currentCup?.grind_now);
  const endingRoute = useMemo(() => deriveEndingRoute(history), [history]);
  const satisfiedEnding = endingRoute.kind === 'satisfied' ? endingRoute.ending : null;
  const hasEnding = endingRoute.kind !== 'none';
  const isCurrentConverged =
    currentCup?.gradient === '已收敛' ||
    currentCup?.terminate_reason === 'satisfied' ||
    currentCup?.terminate_reason === 'would_overextract';

  const chartData = useMemo(() => {
    let relativeHeight = 0;

    return history.map((cup, i) => {
      if (cup.gradient === '变好+同向' || cup.gradient === '变好') {
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
  const trajectoryMin = Math.min(0, ...chartData.map((cup) => cup.value));
  const trajectoryMax = Math.max(0, ...chartData.map((cup) => cup.value));
  const trajectoryTicks = [...new Set([trajectoryMin, 0, trajectoryMax])].sort((a, b) => a - b);
  const trajectoryTickLabel = (value: number) => {
    if (value === 0) return '起点';
    if (value === trajectoryMax && trajectoryMax > 0) return '好于起点';
    if (value === trajectoryMin && trajectoryMin < 0) return '差于起点';
    return '';
  };

  return (
    <div className="trajectory-page p-4 space-y-6">
      <div className="space-y-1">
        <h1 className="font-sans font-medium text-xl text-foreground">这包豆的轨迹</h1>
        <p className="trajectory-proof text-muted-foreground text-xs font-mono border border-border bg-card p-2 rounded mt-2 block">
          {isVisualSample
            ? '视觉样张：来自 demo-arc，不写入你的保存记录。'
            : '这些数据来自你保存的记录，不是当前对话上下文。'}
        </p>
      </div>

      {history.length > 0 ? (
        <>
          {satisfiedEnding ? (
            <section className="trajectory-card trajectory-current-card bg-card border border-border p-5 space-y-5" aria-label="本包豆的收束记录">
              <p className="text-base leading-7 text-foreground">{satisfiedEnding.narrative}</p>
              {satisfiedEnding.finalGrind && (
                <p className="border-l-2 border-border pl-3 text-sm leading-6 text-muted-foreground">
                  你这包豆的落点:研磨 {satisfiedEnding.finalGrind}。下次开同款豆,直接从这儿开始,不用再从大师配方那套从头试。
                </p>
              )}
              <p className="text-xs leading-5 text-muted-foreground">
                这次我们只调了「研磨」这一根轴,它到位了。水温、注水手法也还能再调——不过那是后面的事,现在不用急。
              </p>
            </section>
          ) : endingRoute.kind !== 'none' ? (
            <StaticEndingCard route={endingRoute} />
          ) : (
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
          )}

          {history.length >= 2 && (
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
                    domain={[trajectoryMin - 1, trajectoryMax + 1]}
                    ticks={trajectoryTicks}
                    tick={{ fill: 'hsl(var(--slate))', fontSize: 10, fontFamily: 'var(--app-font-mono)' }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={trajectoryTickLabel}
                    width={64}
                  />
                  <Tooltip
                    position={{ x: 8, y: 8 }}
                    contentStyle={{ backgroundColor: 'hsl(var(--surface-raised))', border: '1px solid hsl(var(--line))', borderRadius: '6px', fontSize: '12px', fontFamily: 'var(--app-font-mono)', boxShadow: '0 12px 32px rgba(0, 0, 0, 0.28)', maxWidth: 240, whiteSpace: 'normal', wordBreak: 'break-word' }}
                    itemStyle={{ color: 'hsl(var(--text))' }}
                    formatter={(value: any, name: any, props: any) => [props.payload.tooltipText, props.payload.tooltipLabel]}
                    labelStyle={{ color: 'hsl(var(--text-dim))', marginBottom: '4px' }}
                  />
                  <Area type="linear" dataKey="value" tooltipType="none" stroke="none" fill="url(#trajectory-fill)" isAnimationActive={false} />
                  <Line
                    type="linear"
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
          )}
        </>
      ) : (
        <div className="trajectory-card p-8 text-center text-muted-foreground text-sm font-mono border border-dashed border-border bg-card">
          还没有记录
        </div>
      )}

      <div className="pt-2">
        {hasEnding ? (
          <details className="cup-history-details group">
            <summary className="flex w-fit cursor-pointer list-none items-center gap-1 font-mono text-sm text-muted-foreground">
              <span>查看完整 {history.length} 杯记录</span>
              <ChevronDown className="h-4 w-4 transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none group-open:rotate-180" />
            </summary>
            <div className="pt-5">
              <CupTimeline history={history} />
            </div>
          </details>
        ) : (
          <CupTimeline history={history} />
        )}
      </div>
    </div>
  );
}
