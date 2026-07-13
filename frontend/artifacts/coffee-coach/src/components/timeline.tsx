import { getCupHistory, type StoredCup } from '@/lib/session';
import {
  adjustmentLabel,
  decisionLabel,
  gradientLabel,
  grindNowLabel,
  terminateReasonLabel,
  turnTypeLabel,
} from '@/lib/diagnosisCopy';

export function CupTimeline({ history: suppliedHistory }: { history?: StoredCup[] }) {
  const history = suppliedHistory ?? getCupHistory();
  if (!history.length) return null;
  const isProbeInProgress = history[history.length - 1]?.turn_type === 'probe';

  return (
    <div className="cup-timeline flex flex-col gap-3 font-mono text-sm w-full">
       <h3 className="cup-timeline-heading text-xs font-semibold text-muted-foreground tracking-wider mb-2 font-sans">这包豆的记录</h3>
       {history.map((cup, i) => {
         const isCurrentCup = i === history.length - 1;
         const shouldCollapseForProbe = isProbeInProgress && i === history.length - 2;
         const terminateReasonText = terminateReasonLabel(cup.terminate_reason);
         const turnTypeText = turnTypeLabel(cup.turn_type);
         const gradientText = gradientLabel(cup.gradient);
         const adjustmentText = adjustmentLabel(cup.direction, cup.step);
         const decisionText = decisionLabel(cup.decision);
         const grindNowText = grindNowLabel(cup.grind_now);
         const isConverged =
           cup.gradient === '已收敛' ||
           cup.terminate_reason === 'satisfied' ||
           cup.terminate_reason === 'would_overextract';
         const isCurrentConverged =
           isCurrentCup &&
           isConverged;

         return (
         <div
           key={i}
           className={`cup-timeline-entry ${
             isCurrentCup ? 'cup-timeline-entry--current' : ''
           } ${
             isConverged ? 'cup-timeline-entry--converged' : ''
           }`}
         >
            <div className="cup-timeline-rail" aria-hidden="true">
              <span className="cup-timeline-node" />
              {i < history.length - 1 && <span className="cup-timeline-line" />}
            </div>
            <div className={`cup-timeline-card border p-3 rounded-md flex flex-col gap-2 ${
              isCurrentCup ? 'cup-timeline-card--current bg-background' : 'border-border bg-card'
            } ${
              isCurrentConverged ? 'cup-timeline-card--current-converged' : ''
            }`}>
              <div className="flex justify-between items-center text-muted-foreground border-b border-border pb-2">
                 <span className="font-bold text-foreground">
                   第 {cup.cup_no || i + 1} 杯{isCurrentCup ? ' · 当前这杯' : ''}
                 </span>
                 <span className="text-xs">{cup.date || cup.recordedAt?.slice(0, 10) || '日期未记录'}</span>
              </div>
              {shouldCollapseForProbe ? (
                 <p className="text-xs text-muted-foreground">上一杯判断已收起，等待本轮追问完成。</p>
              ) : (
                <>
              {turnTypeText && (
                 <div className="flex items-start gap-2">
                   <span className="text-muted-foreground w-16 flex-shrink-0">状态</span>
                   <span className="bg-background px-1.5 py-0.5 border border-border rounded text-xs">{turnTypeText}</span>
                 </div>
              )}
              {terminateReasonText && (
                 <div className="flex items-start gap-2">
                   <span className="text-muted-foreground w-16 flex-shrink-0">这一轮判断</span>
                   <span className="bg-background px-1.5 py-0.5 border border-border rounded text-xs">{terminateReasonText}</span>
                 </div>
              )}
              {gradientText && (
                 <div className="flex items-start gap-2">
                   <span className="text-muted-foreground w-16 flex-shrink-0">变化</span>
                   <span className="bg-background px-1.5 py-0.5 border border-border rounded text-xs">{gradientText}</span>
                 </div>
              )}
              {adjustmentText && (
                 <div className="flex items-start gap-2">
                   <span className="text-muted-foreground w-16 flex-shrink-0">动作</span>
                   <span className="bg-background px-1.5 py-0.5 border border-border rounded text-xs">{adjustmentText}</span>
                 </div>
              )}
              {decisionText && (
                 <div className="flex items-start gap-2">
                   <span className="text-muted-foreground w-16 flex-shrink-0">下一步</span>
                   <span className="bg-background px-1.5 py-0.5 border border-border rounded text-xs">{decisionText}</span>
                 </div>
              )}
              {grindNowText && (
                 <div className="flex items-start gap-2">
                   <span className="text-muted-foreground w-16 flex-shrink-0">研磨</span>
                   <span className="bg-background px-1.5 py-0.5 border border-border rounded text-xs">{grindNowText}</span>
                 </div>
              )}
                </>
              )}
            </div>
         </div>
         );
       })}
    </div>
  )
}
