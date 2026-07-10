import { useContext } from 'react';
import { AppContext } from '@/App';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { CupTimeline } from '@/components/timeline';
import { ChevronDown } from 'lucide-react';

export default function Diagnosis() {
  const { latestTurn } = useContext(AppContext);
  const [, setLocation] = useLocation();

  if (!latestTurn) {
    return (
      <div className="p-4 flex flex-col items-center justify-center h-[50vh] space-y-4 text-center">
        <p className="text-muted-foreground text-sm font-mono">No recent diagnosis found.</p>
        <Button onClick={() => setLocation('/feedback')} variant="outline">返回录入</Button>
      </div>
    );
  }

  const { messages, recordCup } = latestTurn;

  return (
    <div className="p-4 space-y-6">
      <div className="space-y-1">
        <h1 className="font-sans font-medium text-xl text-foreground">诊断结果</h1>
        <p className="text-muted-foreground text-xs font-mono border border-border bg-card inline-block px-1.5 py-0.5 rounded">下游 Codex 精装占位</p>
      </div>

      {recordCup && (
        <div className="bg-card border border-border p-4 flex flex-col gap-4 font-mono text-sm shadow-sm relative overflow-hidden">
          {/* Decision state indicator */}
          <div className="flex items-center gap-2 pb-3 border-b border-border">
            <span className="text-muted-foreground uppercase text-xs tracking-widest">Turn Type</span>
            <span className="bg-background px-2 py-1 border border-border font-medium text-foreground tracking-tight">
              [{recordCup.turn_type || 'unknown'}]
            </span>
          </div>

          {/* Terminate reason card */}
          {recordCup.terminate_reason && (
            <div className="bg-background border border-border p-3 border-l-4 border-l-slate">
              <span className="text-muted-foreground text-xs uppercase tracking-widest block mb-1">Termination</span>
              <div className="text-foreground font-medium text-base break-all">[{recordCup.terminate_reason}]</div>
            </div>
          )}

          {/* Confidence rating -- placeholder only this phase. The star-count
              mapping from FRONTEND.md §6 is an L2 semantic translation the
              downstream Codex pass owns; showing stars now would look like
              finished copy, so this stays a bracketed raw value on purpose. */}
          {recordCup.confidence && (
            <div className="flex items-center gap-2 pt-1">
              <span className="text-muted-foreground text-xs uppercase tracking-widest">Confidence</span>
              <span className="bg-background px-2 py-1 border border-border font-medium text-foreground tracking-tight">
                [{recordCup.confidence}]
              </span>
            </div>
          )}

          {/* Rationale collapsed area */}
          {recordCup.rationale && (
            <details className="group border border-border bg-background group-open:bg-card transition-colors [&_summary::-webkit-details-marker]:hidden mt-2">
              <summary className="flex items-center justify-between cursor-pointer p-3 font-sans text-sm font-medium text-foreground select-none">
                <span>系统解释 Rationale</span>
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
