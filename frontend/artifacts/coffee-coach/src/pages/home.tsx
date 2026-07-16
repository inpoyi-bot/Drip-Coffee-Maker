import { useRef, useState, type ReactNode } from 'react';
import { clearCupHistory, clearLatestSensory, setSeed, getSeed, getSeedRecipe, setSeedRecipe, startNewSession } from '@/lib/session';
import { coldStartToNaturalLanguage, type ColdStartInput } from '@/lib/nlAssembly';
import { useSendTurn } from '@/hooks/use-agent';
import { useLocation } from 'wouter';
import { RadioOption, CheckboxOption, Label, Input } from '@/components/ui/forms';
import { Button } from '@/components/ui/button';
import { assembleCoachMessage } from '@/lib/utils';

const STARTING_GRIND_OPTIONS = ['白砂糖粗细', '食盐粗细', '玉米粉粗细'] as const;
const REQUIRED_FIELDS = ['roastLevel', 'roastDate', 'doseGrams', 'grinderType', 'startingGrind'] as const;

type RequiredField = typeof REQUIRED_FIELDS[number];

function renderInlineMarkdown(text: string): ReactNode {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index} className="font-semibold">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

function CoachExplanation({ message }: { message: string }) {
  const blocks = message.split(/\n\s*\n/).filter(Boolean);

  return (
    <section className="bg-card border border-border border-l-4 border-l-slate p-5 space-y-4" aria-labelledby="coach-explanation-heading">
      <h2 id="coach-explanation-heading" className="font-sans font-medium text-base text-foreground">教练说明</h2>
      <div className="space-y-3 font-sans text-sm leading-7 text-foreground">
        {blocks.map((block, index) => {
          const lines = block.split('\n');
          const listItems = lines.map((line) => line.match(/^\s*[-*+]\s+(.+)$/));
          const orderedListItems = lines.map((line) => line.match(/^\s*\d+\.\s+(.+)$/));

          if (listItems.every(Boolean)) {
            return (
              <ul key={index} className="list-disc space-y-1 pl-5 marker:text-slate">
              {listItems.map((item, itemIndex) => <li key={itemIndex}>{renderInlineMarkdown(item![1])}</li>)}
              </ul>
            );
          }

          if (listItems.some(Boolean)) {
            const content: ReactNode[] = [];
            let pendingList: string[] = [];
            let listIndex = 0;

            const flushList = () => {
              if (pendingList.length === 0) return;
              content.push(
                <ul key={`list-${listIndex++}`} className="list-disc space-y-1 pl-5 marker:text-slate">
                  {pendingList.map((item, itemIndex) => <li key={itemIndex}>{renderInlineMarkdown(item)}</li>)}
                </ul>,
              );
              pendingList = [];
            };

            lines.forEach((line, lineIndex) => {
              const listItem = line.match(/^\s*[-*+]\s+(.+)$/);
              if (listItem) {
                pendingList.push(listItem[1]);
                return;
              }

              flushList();
              if (line.trim()) content.push(<p key={`paragraph-${lineIndex}`}>{renderInlineMarkdown(line)}</p>);
            });
            flushList();

            return <div key={index} className="space-y-2">{content}</div>;
          }

          if (orderedListItems.some(Boolean)) {
            const content: ReactNode[] = [];
            let pendingList: string[] = [];
            let listIndex = 0;

            const flushList = () => {
              if (pendingList.length === 0) return;
              content.push(
                <ol key={`list-${listIndex++}`} className="list-decimal space-y-1 pl-5 marker:text-slate">
                  {pendingList.map((item, itemIndex) => <li key={itemIndex}>{renderInlineMarkdown(item)}</li>)}
                </ol>,
              );
              pendingList = [];
            };

            lines.forEach((line, lineIndex) => {
              const listItem = line.match(/^\s*\d+\.\s+(.+)$/);
              if (listItem) {
                pendingList.push(listItem[1]);
                return;
              }

              flushList();
              if (line.trim()) content.push(<p key={`paragraph-${lineIndex}`}>{renderInlineMarkdown(line)}</p>);
            });
            flushList();

            return <div key={index} className="space-y-2">{content}</div>;
          }

          return (
            <p key={index}>
              {lines.map((line, lineIndex) => (
                <span key={lineIndex}>
                  {lineIndex > 0 && <br />}
                  {renderInlineMarkdown(line)}
                </span>
              ))}
            </p>
          );
        })}
      </div>
    </section>
  );
}

export default function Home() {
  const [, setLocation] = useLocation();
  const mutation = useSendTurn();

  const [roastLevel, setRoastLevel] = useState('');
  const [roastDate, setRoastDate] = useState('');
  const [roastDateUnknown, setRoastDateUnknown] = useState(false);
  const [doseGrams, setDoseGrams] = useState('');
  const [grinderType, setGrinderType] = useState('');
  const [startingGrind, setStartingGrind] = useState('');
  const [showMissing, setShowMissing] = useState(false);
  const fieldRefs = useRef<Record<RequiredField, HTMLDivElement | null>>({
    roastLevel: null,
    roastDate: null,
    doseGrams: null,
    grinderType: null,
    startingGrind: null,
  });
  
  const [seed, setLocalSeed] = useState(getSeed());
  const [seedRecipe, setLocalSeedRecipe] = useState(getSeedRecipe());
  const dose = Number(doseGrams);
  const missingFields: Record<RequiredField, boolean> = {
    roastLevel: !roastLevel,
    roastDate: !(roastDateUnknown || roastDate.trim()),
    doseGrams: !(Number.isFinite(dose) && dose > 0),
    grinderType: !grinderType,
    startingGrind: !startingGrind,
  };
  const firstMissingField = REQUIRED_FIELDS.find((field) => missingFields[field]);
  const canSubmit = !firstMissingField;
  const isMissing = (field: RequiredField) => showMissing && missingFields[field];

  const revealMissingField = () => {
    if (!firstMissingField) return;
    setShowMissing(true);
    window.requestAnimationFrame(() => {
      const field = fieldRefs.current[firstMissingField];
      field?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      field?.querySelector<HTMLInputElement>('input')?.focus();
    });
  };

  const handleSubmit = async () => {
    if (!canSubmit) {
      revealMissingField();
      return;
    }
    const input: ColdStartInput = {
      roastLevel,
      roastDate: roastDateUnknown ? 'unknown' : roastDate,
      doseGrams: dose,
      grinderType,
      startingGrindDescription: startingGrind,
    };
    const nl = coldStartToNaturalLanguage(input);
    const result = await mutation.mutateAsync(nl);
    const newSeedRecipe = result.startBag?.seed_recipe ?? null;
    if (result.messages.length > 0 || newSeedRecipe) {
      const newSeed = assembleCoachMessage(result.messages) || '起点配方已建立。';
      setSeed(newSeed);
      setLocalSeed(newSeed);
      setSeedRecipe(newSeedRecipe);
      setLocalSeedRecipe(newSeedRecipe);
    }
  };

  const handleReset = () => {
    startNewSession();
    clearCupHistory();
    clearLatestSensory();
    setSeed('');
    setLocalSeed(null);
    setSeedRecipe(null);
    setLocalSeedRecipe(null);
  };

  if (seed) {
    return (
      <div className="p-6 space-y-8 animate-in fade-in slide-in-from-bottom-4 motion-reduce:animate-none">
        <div className="space-y-4">
          <h1 className="font-sans font-medium text-2xl text-foreground">手法已冻结</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            起始配方已经确定。接下来的调试中，请保持手法、水温等其他变量不变，我们只调整研磨度。
          </p>
          {seedRecipe && (
            <div className="border border-border rounded-md divide-y divide-border bg-card text-sm">
              <div className="px-4 py-3 font-medium text-foreground">起点配方</div>
              {([
                ['粉量', seedRecipe.粉量],
                ['粉水比', seedRecipe.比例],
                ['水温', seedRecipe.水温],
                ['研磨基准', seedRecipe.研磨基准],
                ['注水手法', seedRecipe.注水手法],
              ] as const).map(([label, value]) => value && (
                <div key={label} className="grid grid-cols-[5rem_1fr] gap-3 px-4 py-3">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="text-foreground leading-relaxed">{value}</span>
                </div>
              ))}
            </div>
          )}
          <CoachExplanation message={seed} />
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
    <div className="coldstart-page p-6 space-y-10">
      <div className="coldstart-intro space-y-2">
        <h1 className="font-sans font-medium text-2xl text-foreground">冷启动录入</h1>
        <p className="text-muted-foreground text-sm">告诉仪器你的初始状态，以建立校准基线。</p>
      </div>

      <div className="coldstart-form space-y-9">
        <div
          ref={(element) => { fieldRefs.current.roastLevel = element; }}
          className={`coldstart-field space-y-3 ${isMissing('roastLevel') ? 'rounded-md border p-3' : ''}`}
          style={isMissing('roastLevel') ? { borderColor: 'hsl(var(--select-accent))', backgroundColor: 'hsl(var(--select-accent) / 0.05)' } : undefined}
        >
          <Label required>烘焙度</Label>
          <div className="coldstart-options flex flex-col gap-2">
            {['极浅焙', '浅焙', '中焙', '中深焙', '深焙'].map(level => (
              <RadioOption key={level} name="roastLevel" value={level} label={level} checked={roastLevel === level} onChange={() => setRoastLevel(level)} />
            ))}
          </div>
        </div>

        <div
          ref={(element) => { fieldRefs.current.roastDate = element; }}
          className={`coldstart-field space-y-3 ${isMissing('roastDate') ? 'rounded-md border p-3' : ''}`}
          style={isMissing('roastDate') ? { borderColor: 'hsl(var(--select-accent))', backgroundColor: 'hsl(var(--select-accent) / 0.05)' } : undefined}
        >
          <Label required>烘焙日期</Label>
          <Input 
            type="text" 
            placeholder="例如: 8天前 / 2023-10-01" 
            value={roastDate} 
            onChange={(e: any) => setRoastDate(e.target.value)} 
            disabled={roastDateUnknown}
            aria-invalid={isMissing('roastDate')}
          />
          <CheckboxOption 
            label="不知道 / 包装上找不到" 
            checked={roastDateUnknown} 
            onChange={(e: any) => setRoastDateUnknown(e.target.checked)} 
            fallbackType="missing"
          />
        </div>

        <div
          ref={(element) => { fieldRefs.current.doseGrams = element; }}
          className={`coldstart-field space-y-3 ${isMissing('doseGrams') ? 'rounded-md border p-3' : ''}`}
          style={isMissing('doseGrams') ? { borderColor: 'hsl(var(--select-accent))', backgroundColor: 'hsl(var(--select-accent) / 0.05)' } : undefined}
        >
          <Label required>粉量 (克)</Label>
          <Input 
            type="number" 
            value={doseGrams} 
            onChange={(e: any) => setDoseGrams(e.target.value)} 
            aria-invalid={isMissing('doseGrams')}
          />
        </div>

        <div
          ref={(element) => { fieldRefs.current.grinderType = element; }}
          className={`coldstart-field space-y-3 ${isMissing('grinderType') ? 'rounded-md border p-3' : ''}`}
          style={isMissing('grinderType') ? { borderColor: 'hsl(var(--select-accent))', backgroundColor: 'hsl(var(--select-accent) / 0.05)' } : undefined}
        >
          <Label required>磨豆机类型</Label>
          <div className="coldstart-options flex flex-col gap-2">
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

        <div
          ref={(element) => { fieldRefs.current.startingGrind = element; }}
          className={`coldstart-field space-y-3 ${isMissing('startingGrind') ? 'rounded-md border p-3' : ''}`}
          style={isMissing('startingGrind') ? { borderColor: 'hsl(var(--select-accent))', backgroundColor: 'hsl(var(--select-accent) / 0.05)' } : undefined}
        >
          <Label required>起始研磨粗细</Label>
          <div className="coldstart-options flex flex-col gap-2">
            {STARTING_GRIND_OPTIONS.map(option => (
              <RadioOption
                key={option}
                name="startingGrind"
                value={option}
                label={option}
                checked={startingGrind === option}
                onChange={() => setStartingGrind(option)}
              />
            ))}
          </div>
        </div>

        <Button 
          onClick={canSubmit ? handleSubmit : revealMissingField}
          disabled={mutation.isPending}
          data-disabled={!canSubmit}
          aria-describedby={showMissing && !canSubmit ? 'form-incomplete-hint' : undefined}
          className={`coldstart-submit w-full h-14 text-base ${!canSubmit ? 'cursor-not-allowed opacity-50' : ''}`}
        >
          {mutation.isPending ? '生成起点配方...' : '提交建立基线'}
        </Button>
        {showMissing && !canSubmit && (
          <p id="form-incomplete-hint" role="status" className="coldstart-incomplete-hint text-sm text-muted-foreground">
            请补全标记为必填的项目。
          </p>
        )}
      </div>
    </div>
  );
}
