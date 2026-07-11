import { useContext } from 'react';
import { AppContext } from '@/App';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { CupTimeline } from '@/components/timeline';
import { ChevronDown } from 'lucide-react';
import { useSendTurn } from '@/hooks/use-agent';
import { probeReplyToNaturalLanguage, type ProbeType } from '@/lib/nlAssembly';
import { appendCup, getLatestSensory } from '@/lib/session';
import {
  adjustmentLabel,
  confidenceDisplay,
  decisionLabel,
  gradientLabel,
  grindNowLabel,
  terminateReasonLabel,
  turnTypeLabel,
} from '@/lib/diagnosisCopy';

type ProbeOption = {
  label: string;
  probe: ProbeType;
};

const PROBE_OPTIONS = {
  P2: [
    { label: '酸完发空、收尾就没了', probe: 'P2' },
    { label: '会化成甜、有回甘', probe: 'P2' },
    { label: '说不清', probe: 'P2' },
  ],
  P3: [
    { label: '甜能清楚盖过酸、喝完持续回甘', probe: 'P3' },
    { label: '只是比最开始好一点、努力才尝到一点甜', probe: 'P3' },
    { label: '说不清', probe: 'P3' },
  ],
  P4: [
    { label: '我不太爱这类酸的风格', probe: 'P4' },
    { label: '我喜欢这个酸,只是想要更厚/更圆', probe: 'P4' },
    { label: '说不清', probe: 'P4' },
  ],
  P5: [
    { label: '寡淡、没什么余味,酸把甜压没了', probe: 'P5' },
    { label: '有回甘的,只是酸太亮把甜盖住了、想更厚', probe: 'P5' },
    { label: '说不清', probe: 'P5' },
  ],
} as const satisfies Record<ProbeOption['probe'], readonly ProbeOption[]>;

function optionsForProbe(flags: unknown, sensory: string[]): ProbeOption[] {
  const assertedFlags = Array.isArray(flags)
    ? flags.filter((flag): flag is string => typeof flag === 'string')
    : [];

  if (assertedFlags.includes('preference_unspecified')) return [...PROBE_OPTIONS.P4];
  if (assertedFlags.includes('absolute_extraction_uncertain')) return [...PROBE_OPTIONS.P3];
  if (!assertedFlags.includes('info_insufficient')) return [];

  const reportsAcidity = sensory.includes('酸');
  const reportsThinOrNotSweet = sensory.some((item) => item.includes('薄') || item.includes('不甜'));
  if (reportsAcidity && reportsThinOrNotSweet) return [...PROBE_OPTIONS.P2, ...PROBE_OPTIONS.P5];
  if (reportsAcidity) return [...PROBE_OPTIONS.P2];
  if (reportsThinOrNotSweet) return [...PROBE_OPTIONS.P5];
  return [];
}

export default function Diagnosis() {
  const { latestTurn, setLatestTurn } = useContext(AppContext);
  const [, setLocation] = useLocation();
  const mutation = useSendTurn();

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
  const isDegasValidation = Array.isArray(recordCup?.flags_asserted)
    && recordCup.flags_asserted.includes('degas_signals_observed');
  const probeOptions = optionsForProbe(recordCup?.flags_asserted, getLatestSensory());

  const handleProbeReply = async (option: ProbeOption) => {
    const reply = probeReplyToNaturalLanguage(option.probe, option.label);
    const result = await mutation.mutateAsync(reply);
    if (result.recordCup) {
      appendCup(result.recordCup);
    }
    setLatestTurn(result);
  };

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

      {isDegasValidation && (
        <div className="border border-border bg-card p-4 text-sm leading-relaxed text-foreground">
          这是复现验证：下一杯请保持研磨、水温、粉量和手法不变，照旧再冲一次后走正常反馈记录。
        </div>
      )}

      {probeOptions.length > 0 && (
        <section className="space-y-3" aria-labelledby="probe-options-heading">
          <div className="space-y-1">
            <h2 id="probe-options-heading" className="font-sans font-medium text-base text-foreground">请补充判断</h2>
            <p className="text-sm text-muted-foreground">选择最接近的描述后，我会据此继续判断。</p>
          </div>
          <div className="flex flex-col gap-2">
            {probeOptions.map((option, index) => (
              <Button
                key={`${option.probe}-${option.label}-${index}`}
                variant="outline"
                className="justify-start h-auto whitespace-normal py-3 text-left"
                disabled={mutation.isPending}
                onClick={() => handleProbeReply(option)}
              >
                {option.label}
              </Button>
            ))}
          </div>
          {mutation.isError && (
            <p role="alert" className="text-sm text-destructive">
              没有成功发出这次回答，请检查连接后重试。
            </p>
          )}
        </section>
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
