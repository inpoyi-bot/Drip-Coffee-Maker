import { useContext } from 'react';
import { AppContext } from '@/App';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { CupTimeline } from '@/components/timeline';
import { ChevronDown } from 'lucide-react';
import {
  adjustmentLabel,
  confidenceDisplay,
  decisionLabel,
  gradientLabel,
  grindNowLabel,
  terminateReasonLabel,
  turnTypeLabel,
} from '@/lib/diagnosisCopy';

export default function Diagnosis() {
  const { latestTurn } = useContext(AppContext);
  const [, setLocation] = useLocation();

  if (!latestTurn) {
    return (
      <div className="p-4 flex flex-col items-center justify-center h-[50vh] space-y-4 text-center">
        <p className="text-muted-foreground text-sm font-mono">还没有这一轮的判断。</p>
        <Button onClick={() => setLocation('/feedback')} variant="outline">返回录入</Button>
      </div>
    );
  }

  const { messages, recordCup } = latestTurn;
  const terminateReasonText = terminateReasonLabel(recordCup?.terminate_reason);
  const confidence = confidenceDisplay(recordCup?.confidence);
  const turnTypeText = turnTypeLabel(recordCup?.turn_type);
  const gradientText = gradientLabel(recordCup?.gradient);
  const adjustmentText = adjustmentLabel(recordCup?.direction, recordCup?.step);
  const decisionText = decisionLabel(recordCup?.decision);
  const grindNowText = grindNowLabel(recordCup?.grind_now);

  return (
    <div className="p-4 space-y-6">
      <div className="space-y-1">
        <h1 className="font-sans font-medium text-xl text-foreground">诊断结果</h1>
      </div>

      {recordCup && (
        <div className="bg-card border border-border p-4 flex flex-col gap-4 font-mono text-sm shadow-sm relative overflow-hidden">
          {/* Decision state indicator */}
          <div className="flex items-center gap-2 pb-3 border-b border-border">
            <span className="text-muted-foreground uppercase text-xs tracking-widest">状态</span>
            {turnTypeText && (
              <span className="bg-background px-2 py-1 border border-border font-medium text-foreground tracking-tight">
                {turnTypeText}
              </span>
            )}
          </div>

          {/* Terminate reason card */}
          {terminateReasonText && (
            <div className="bg-background border border-border p-3 border-l-4 border-l-slate">
              <span className="text-muted-foreground text-xs tracking-widest block mb-1">这一轮的判断</span>
              <div className="text-foreground font-medium text-base">{terminateReasonText}</div>
            </div>
          )}

          {gradientText && (
            <div className="flex items-center gap-2 pt-1">
              <span className="text-muted-foreground text-xs uppercase tracking-widest">变化方向</span>
              <span className="bg-background px-2 py-1 border border-border font-medium text-foreground tracking-tight">
                {gradientText}
              </span>
            </div>
          )}

          {adjustmentText && (
            <div className="flex items-center gap-2 pt-1">
              <span className="text-muted-foreground text-xs uppercase tracking-widest">调整动作</span>
              <span className="bg-background px-2 py-1 border border-border font-medium text-foreground tracking-tight">
                {adjustmentText}
              </span>
            </div>
          )}

          {decisionText && (
            <div className="flex items-center gap-2 pt-1">
              <span className="text-muted-foreground text-xs uppercase tracking-widest">下一步</span>
              <span className="bg-background px-2 py-1 border border-border font-medium text-foreground tracking-tight">
                {decisionText}
              </span>
            </div>
          )}

          {grindNowText && (
            <div className="flex items-center gap-2 pt-1">
              <span className="text-muted-foreground text-xs uppercase tracking-widest">当前研磨</span>
              <span className="bg-background px-2 py-1 border border-border font-medium text-foreground tracking-tight">
                {grindNowText}
              </span>
            </div>
          )}

          {/* Confidence is a separate calibration signal, not part of the diagnosis copy. */}
          {confidence && (
            <div className="flex items-center gap-2 pt-1">
              <span className="text-muted-foreground text-xs uppercase tracking-widest">判断把握</span>
              <span className="bg-background px-2 py-1 border border-border font-medium text-foreground tracking-tight" aria-label={`判断把握${confidence.stars}`}>
                {confidence.stars}
              </span>
              {confidence.note && (
                <span className="text-muted-foreground text-xs">{confidence.note}</span>
              )}
            </div>
          )}

          {/* 默认折叠的解释区，不作为主诊断出口。 */}
          {recordCup.rationale && (
            <details className="group border border-border bg-background group-open:bg-card transition-colors [&_summary::-webkit-details-marker]:hidden mt-2">
              <summary className="flex items-center justify-between cursor-pointer p-3 font-sans text-sm font-medium text-foreground select-none">
                <span>为什么这样判断</span>
                <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
              </summary>
              <div className="px-3 pb-3 text-muted-foreground text-xs leading-relaxed border-t border-border pt-2 bg-background">
                {recordCup.rationale}
              </div>
            </details>
          )}
        </div>
      )}

      {/* Messages */}
      {messages.length > 0 && (
        <div className="space-y-3 font-sans text-sm leading-relaxed text-foreground">
          {messages.map((msg, i) => (
            <div key={i} className="bg-card border border-border p-4 shadow-sm relative">
              <div className="absolute top-0 left-0 w-1 h-full bg-slate"></div>
              {msg}
            </div>
          ))}
        </div>
      )}

      <div className="pt-4 flex gap-3">
        <Button onClick={() => setLocation('/feedback')} className="flex-1">继续下一杯</Button>
        <Button variant="outline" onClick={() => setLocation('/trajectory')} className="flex-1">查看轨迹</Button>
      </div>

      <div className="pt-6 border-t border-border">
         <CupTimeline />
      </div>
    </div>
  );
}
