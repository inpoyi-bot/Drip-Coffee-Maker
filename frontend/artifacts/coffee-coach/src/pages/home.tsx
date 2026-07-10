import { useState } from 'react';
import { setSeed, getSeed, startNewSession } from '@/lib/session';
import { coldStartToNaturalLanguage, type ColdStartInput } from '@/lib/nlAssembly';
import { useSendTurn } from '@/hooks/use-agent';
import { useLocation } from 'wouter';
import { RadioOption, CheckboxOption, Label, Input } from '@/components/ui/forms';
import { Button } from '@/components/ui/button';

export default function Home() {
  const [, setLocation] = useLocation();
  const mutation = useSendTurn();

  const [roastLevel, setRoastLevel] = useState('中焙');
  const [roastDate, setRoastDate] = useState('');
  const [roastDateUnknown, setRoastDateUnknown] = useState(false);
  const [doseGrams, setDoseGrams] = useState('15');
  const [grinderType, setGrinderType] = useState('锥刀电动磨');
  const [startingGrind, setStartingGrind] = useState('');
  
  const [seed, setLocalSeed] = useState(getSeed());

  const handleSubmit = async () => {
    const input: ColdStartInput = {
      roastLevel,
      roastDate: roastDateUnknown ? 'unknown' : roastDate || '没填',
      doseGrams: Number(doseGrams) || 15,
      grinderType,
      startingGrindDescription: startingGrind || '未描述',
    };
    const nl = coldStartToNaturalLanguage(input);
    const result = await mutation.mutateAsync(nl);
    if (result.messages.length > 0) {
      const newSeed = result.messages[0];
      setSeed(newSeed);
      setLocalSeed(newSeed);
    }
  };

  const handleReset = () => {
    startNewSession();
    setSeed('');
    setLocalSeed(null);
  };

  if (seed) {
    return (
      <div className="p-6 space-y-8 animate-in fade-in slide-in-from-bottom-4">
        <div className="space-y-4">
          <h1 className="font-sans font-medium text-2xl text-foreground">手法已冻结</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            起始配方已经确定。接下来的调试中，请保持手法、水温等其他变量不变，我们只调整研磨度。
          </p>
          <div className="p-4 bg-card border border-border rounded-md text-sm text-foreground leading-relaxed">
            {seed}
          </div>
        </div>
        
        <div className="flex flex-col gap-3">
          <Button onClick={() => setLocation('/feedback')} className="w-full">
            冲煮完这杯，去填反馈
          </Button>
          <Button variant="outline" onClick={handleReset} className="w-full">
            换豆子/重新开始
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8">
      <div className="space-y-2">
        <h1 className="font-sans font-medium text-2xl text-foreground">冷启动录入</h1>
        <p className="text-muted-foreground text-sm">告诉仪器你的初始状态，以建立校准基线。</p>
      </div>

      <div className="space-y-8">
        <div className="space-y-3">
          <Label>烘焙度</Label>
          <div className="flex flex-col gap-2">
            {['极浅焙', '浅焙', '中焙', '中深焙', '深焙'].map(level => (
              <RadioOption key={level} name="roastLevel" value={level} label={level} checked={roastLevel === level} onChange={() => setRoastLevel(level)} />
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <Label>烘焙日期</Label>
          <Input 
            type="text" 
            placeholder="例如: 8天前 / 2023-10-01" 
            value={roastDate} 
            onChange={(e: any) => setRoastDate(e.target.value)} 
            disabled={roastDateUnknown}
          />
          <CheckboxOption 
            label="不知道 / 包装上找不到" 
            checked={roastDateUnknown} 
            onChange={(e: any) => setRoastDateUnknown(e.target.checked)} 
            fallbackType="missing"
          />
        </div>

        <div className="space-y-3">
          <Label>粉量 (克)</Label>
          <Input 
            type="number" 
            value={doseGrams} 
            onChange={(e: any) => setDoseGrams(e.target.value)} 
          />
        </div>

        <div className="space-y-3">
          <Label>磨豆机类型</Label>
          <div className="flex flex-col gap-2">
            {['砍豆机', '锥刀电动磨', '平刀电动磨', '手摇磨', '不确定', '没有磨豆机'].map(type => (
              <RadioOption 
                 key={type} 
                 name="grinderType" 
                 value={type} 
                 label={type} 
                 checked={grinderType === type} 
                 onChange={() => setGrinderType(type)} 
                 fallbackType={type === '不确定' ? 'vague' : undefined}
              />
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <Label>起始研磨描述</Label>
          <Input 
            type="text" 
            placeholder="例如: 像粗砂糖那么粗" 
            value={startingGrind} 
            onChange={(e: any) => setStartingGrind(e.target.value)} 
          />
        </div>

        <Button 
          onClick={handleSubmit} 
          disabled={mutation.isPending} 
          className="w-full h-14 text-base"
        >
          {mutation.isPending ? '生成起点配方...' : '提交建立基线'}
        </Button>
      </div>
    </div>
  );
}
