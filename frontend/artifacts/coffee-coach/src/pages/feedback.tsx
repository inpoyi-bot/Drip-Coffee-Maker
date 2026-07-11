import { useState, useContext } from 'react';
import { AppContext } from '@/App';
import { useSendTurn } from '@/hooks/use-agent';
import { useLocation } from 'wouter';
import { cupFeedbackToNaturalLanguage, type CupFeedbackInput } from '@/lib/nlAssembly';
import { appendCup, setLatestSensory } from '@/lib/session';
import { RadioOption, CheckboxOption, Label, Input, Textarea } from '@/components/ui/forms';
import { Button } from '@/components/ui/button';

const SENSORY_OPTIONS = [
  { value: '酸', label: '酸' },
  { value: '发苦(像烧焦/木头味)', label: '发苦（像烧焦／木头味）' },
  { value: '发涩(口腔收紧发干,像浓茶/生柿子,不是苦)', label: '发涩（口腔收紧发干，像浓茶／生柿子，不是苦）' },
  { value: '薄(寡淡、水感)', label: '薄 (寡淡、水感)' },
  { value: '有纸板味/闷味', label: '有纸板味 / 闷味、香气发闷' },
];

export default function Feedback() {
  const [, setLocation] = useLocation();
  const mutation = useSendTurn();
  const { setLatestTurn } = useContext(AppContext);

  const [sensory, setSensory] = useState<string[]>([]);
  const [sensoryElaboration, setSensoryElaboration] = useState('');
  const hasCantDescribe = sensory.includes('尝到了但说不清');

  const toggleSensory = (val: string) => {
    setSensory(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
  };

  const [vsPrev, setVsPrev] = useState<'变好' | '变坏' | '没变' | '说不清'>('说不清');
  
  const [brewMin, setBrewMin] = useState('');
  const [brewSec, setBrewSec] = useState('');
  const [notTimed, setNotTimed] = useState(false);

  const [bedShape, setBedShape] = useState<'平' | '拱' | '塌坑' | '偏厚下陷' | 'not_observed'>('not_observed');
  const [wallRing, setWallRing] = useState<'present' | 'absent' | 'not_observed'>('not_observed');
  const [bedNote, setBedNote] = useState('');

  const handleSubmit = async () => {
    let brewTimeSeconds: number | 'not_timed' = 'not_timed';
    if (!notTimed && (brewMin || brewSec)) {
       brewTimeSeconds = (Number(brewMin) || 0) * 60 + (Number(brewSec) || 0);
    }

    const input: CupFeedbackInput = {
      sensory,
      sensoryElaboration: hasCantDescribe ? sensoryElaboration : undefined,
      vsPrev,
      brewTimeSeconds,
      bedShape,
      wallRing,
      bedNote: bedNote || undefined
    };

    const nl = cupFeedbackToNaturalLanguage(input);
    setLatestSensory(sensory);
    const result = await mutation.mutateAsync(nl);
    
    if (result.recordCup) {
      appendCup(result.recordCup);
    }
    
    setLatestTurn(result);
    setLocation('/diagnosis');
  };

  return (
    <div className="p-6 space-y-10">
      <div className="space-y-2">
        <h1 className="font-sans font-medium text-2xl text-foreground">这杯怎么样？</h1>
        <p className="text-muted-foreground text-sm">按你观察到的如实记录，没注意看的直接选没注意看。</p>
      </div>

      <div className="space-y-8">
        <div className="space-y-3">
          <Label>感官风味 (可多选)</Label>
          <div className="flex flex-col gap-2">
            {SENSORY_OPTIONS.map(opt => (
              <CheckboxOption 
                key={opt.value} 
                label={opt.label} 
                checked={sensory.includes(opt.value)} 
                onChange={() => toggleSensory(opt.value)} 
              />
            ))}
            <CheckboxOption 
              label="尝到了但说不清" 
              checked={hasCantDescribe} 
              onChange={() => toggleSensory('尝到了但说不清')} 
              fallbackType="vague"
            />
            {hasCantDescribe && (
              <div className="pl-4 mt-2 animate-in fade-in">
                <Textarea 
                  placeholder="尽量描述一下你的感受..." 
                  value={sensoryElaboration} 
                  onChange={(e: any) => setSensoryElaboration(e.target.value)} 
                />
              </div>
            )}
            <details className="border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
              <summary className="cursor-pointer font-medium text-foreground">苦和涩怎么分？</summary>
              <p className="mt-2 leading-relaxed">
                发苦更像烧焦或木头味；发涩是口腔收紧、发干，像浓茶或生柿子。两者可能同时出现，请分别勾选，不要把“发干”一概当成苦。
              </p>
            </details>
          </div>
        </div>

        <div className="space-y-3">
          <Label>和上一杯比</Label>
          <div className="flex flex-col gap-2">
            {(['变好', '变坏', '没变'] as const).map(opt => (
               <RadioOption key={opt} name="vsPrev" value={opt} label={opt} checked={vsPrev === opt} onChange={() => setVsPrev(opt)} />
            ))}
            <RadioOption name="vsPrev" value="说不清" label="说不清" checked={vsPrev === '说不清'} onChange={() => setVsPrev('说不清')} fallbackType="vague" />
          </div>
        </div>

        <div className="space-y-3">
          <Label>冲煮时间</Label>
          <div className="flex items-center gap-2">
             <Input type="number" placeholder="分" value={brewMin} onChange={(e: any) => setBrewMin(e.target.value)} disabled={notTimed} className="w-20" />
             <span className="text-muted-foreground">分</span>
             <Input type="number" placeholder="秒" value={brewSec} onChange={(e: any) => setBrewSec(e.target.value)} disabled={notTimed} className="w-20" />
             <span className="text-muted-foreground">秒</span>
          </div>
          <div className="mt-3">
             <CheckboxOption label="没计时" checked={notTimed} onChange={(e: any) => setNotTimed(e.target.checked)} fallbackType="missing" />
          </div>
        </div>

        <div className="space-y-3">
          <Label>床面形态</Label>
          <div className="flex flex-col gap-2">
            {(['平', '拱', '塌坑', '偏厚下陷'] as const).map(opt => (
               <RadioOption key={opt} name="bedShape" value={opt} label={opt} checked={bedShape === opt} onChange={() => setBedShape(opt)} />
            ))}
            <RadioOption name="bedShape" value="not_observed" label="没注意看" checked={bedShape === 'not_observed'} onChange={() => setBedShape('not_observed')} fallbackType="missing" />
          </div>
        </div>

        <div className="space-y-3">
          <Label>挂粉环</Label>
          <div className="flex flex-col gap-2">
            <RadioOption name="wallRing" value="present" label="有挂粉环" checked={wallRing === 'present'} onChange={() => setWallRing('present')} />
            <RadioOption name="wallRing" value="absent" label="没有挂粉环" checked={wallRing === 'absent'} onChange={() => setWallRing('absent')} />
            <RadioOption name="wallRing" value="not_observed" label="没注意看" checked={wallRing === 'not_observed'} onChange={() => setWallRing('not_observed')} fallbackType="missing" />
          </div>
        </div>

        <div className="space-y-3">
          <Label>床面备注 (选填)</Label>
          <Textarea 
            placeholder="其他观察到的细节..." 
            value={bedNote} 
            onChange={(e: any) => setBedNote(e.target.value)} 
          />
        </div>

        <Button onClick={handleSubmit} disabled={mutation.isPending} className="w-full h-14 text-base">
          {mutation.isPending ? '诊断中...' : '提交记录'}
        </Button>
      </div>
    </div>
  );
}
