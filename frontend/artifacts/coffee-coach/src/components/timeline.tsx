import { getCupHistory } from '@/lib/session';

export function CupTimeline() {
  const history = getCupHistory();
  if (!history.length) return null;

  return (
    <div className="flex flex-col gap-3 font-mono text-sm w-full">
       <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 font-sans">Timeline</h3>
       {history.map((cup, i) => (
         <div key={i} className="border border-border bg-card p-3 rounded-md flex flex-col gap-2">
            <div className="flex justify-between items-center text-muted-foreground border-b border-border pb-2">
               <span className="font-bold text-foreground">Cup #{cup.cup_no || i + 1}</span>
               <span className="text-xs">{cup.date || cup.recordedAt?.slice(0, 10) || 'Unknown Date'}</span>
            </div>
            {cup.turn_type && (
               <div className="flex items-start gap-2">
                 <span className="text-muted-foreground w-16 flex-shrink-0">State</span>
                 <span className="bg-background px-1.5 py-0.5 border border-border rounded text-xs">[{cup.turn_type}]</span>
               </div>
            )}
            {cup.terminate_reason && (
               <div className="flex items-start gap-2">
                 <span className="text-muted-foreground w-16 flex-shrink-0">Reason</span>
                 <span className="bg-background px-1.5 py-0.5 border border-border rounded text-xs break-all">[{cup.terminate_reason}]</span>
               </div>
            )}
         </div>
       ))}
    </div>
  )
}
