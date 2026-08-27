import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ArrowLeft } from 'lucide-react';
import { PillGroup } from './PillGroup';
import { RichTextEditor } from '@/components/shared/RichTextEditor';
import { UnifiedMediaBox } from '@/components/shared/UnifiedMediaBox';
import { SaveStatusIndicator } from '@/components/shared/SaveStatusIndicator';
import { useAutosave } from '@/hooks/useAutosave';
import {
  ResearchTest, Strategy, SESSIONS, TEMPLATE_SECTIONS, CustomSection, RESEARCH_MARKET_CONDITIONS,
} from '@/types/research';
import { cn } from '@/lib/utils';

interface Props {
  strategy: Strategy;
  test: ResearchTest;
  onSave: (t: ResearchTest) => Promise<void> | void;
}

const BIAS_OPTS = ['Bullish', 'Bearish', 'Neutral', 'Sideways'] as const;
const DR_OPTS = ['Premium', 'Discount', 'EQ'] as const;
const LIQ_OPTS = ['BSL Above', 'SSL Below', 'Both', 'None'] as const;
const BREAKOUT_OPTS = ['Strong Displacement', 'Weak / No Displacement'] as const;
const FVG_OPTS = ['High', '50%', 'Low'] as const;
const ENTRY_OPTS = ['DR High', 'DR Low', 'Midpoint', 'FVG', 'S/D Zone'] as const;
const LTF_OPTS = ['Bullish MSS', 'Bearish MSS', 'Wick Rejection', 'Displacement Off Zone'] as const;
const DR_LEVEL_OPTS = ['High', 'EQ', 'Low'] as const;
const RESULT_OPTS = ['Win', 'Loss', 'Scratch'] as const;
const EMO_OPTS = ['Process', 'Flow', 'Foggy', 'Revenge'] as const;

export function TestEditor({ strategy, test, onSave }: Props) {
  const navigate = useNavigate();
  const [t, setT] = useState<ResearchTest>(test);
  useEffect(() => { setT(test); }, [test.id]); // eslint-disable-line

  const saveFn = useCallback(async (val: ResearchTest) => {
    await onSave({ ...val, updatedAt: new Date().toISOString() });
  }, [onSave]);

  const { status } = useAutosave({ value: t, onSave: saveFn, debounceMs: 800 });

  const upd = <K extends keyof ResearchTest>(k: K, v: ResearchTest[K]) => setT((p) => ({ ...p, [k]: v }));
  const selectedLtf = Array.isArray(t.ltfConfirmation) ? t.ltfConfirmation : (t.ltfConfirmation ? [t.ltfConfirmation as any] : []);
  const toggleLtf = (value: typeof LTF_OPTS[number]) => {
    const next = selectedLtf.includes(value)
      ? selectedLtf.filter((item) => item !== value)
      : [...selectedLtf, value];
    upd('ltfConfirmation', next as ResearchTest['ltfConfirmation']);
  };
  const updCustom = (fieldId: string, value: string) =>
    setT((p) => ({ ...p, customValues: { ...(p.customValues || {}), [fieldId]: value } }));

  const tpl = strategy.template || 'blank';
  const customSections: CustomSection[] = tpl === 'custom'
    ? (strategy.customSections || [])
    : (TEMPLATE_SECTIONS[tpl] || []);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-center justify-between sticky top-0 z-10 bg-background/95 backdrop-blur py-3 -mx-4 px-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/research-lab/${strategy.id}`)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div>
            <h1 className="font-heading font-bold text-lg">{strategy.name}</h1>
            <p className="text-xs text-muted-foreground">
              <span className="uppercase tracking-wider mr-1">{tpl}</span>· Test entry · {t.date}
            </p>
          </div>
        </div>
        <SaveStatusIndicator status={status} />
      </div>

      <Section title="Basic Info">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div><Label>Date</Label><Input type="date" value={t.date} onChange={(e) => upd('date', e.target.value)} /></div>
          <div>
            <Label>Pair</Label>
            <PillGroup options={strategy.pairs} value={t.pair} onChange={(v) => upd('pair', v)} size="sm" />
          </div>
          <div>
            <Label>Session</Label>
            <PillGroup options={SESSIONS as unknown as string[]} value={t.session} onChange={(v) => upd('session', v as any)} size="sm" />
          </div>
        </div>
      </Section>

      <Section title="HTF Bias">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><Label>Predicted Bias</Label><PillGroup options={BIAS_OPTS} value={t.predictedBias} onChange={(v) => upd('predictedBias', v as any)} /></div>
          <div><Label>Actual Bias</Label><PillGroup options={BIAS_OPTS} value={t.actualBias} onChange={(v) => upd('actualBias', v as any)} /></div>
        </div>
      </Section>

      <Section title="Market Condition" subtitle="Tag the environment this test ran in. Feeds into Research Analytics.">
        <PillGroup
          options={RESEARCH_MARKET_CONDITIONS as unknown as string[]}
          value={t.marketCondition || ''}
          onChange={(v) => upd('marketCondition', v as any)}
        />
      </Section>


      {/* DR-only blocks — never shown for ADC / EBP / SMT / Blank / Custom */}
      {tpl === 'dr' && (
        <>
          <Section title="Dealing Range">
            <PillGroup options={DR_OPTS} value={t.dealingRange} onChange={(v) => upd('dealingRange', v as any)} />
          </Section>
          <Section title="Liquidity" subtitle="Which liquidity pool was targeted?">
            <PillGroup options={LIQ_OPTS} value={t.liquidityTarget} onChange={(v) => upd('liquidityTarget', v as any)} />
            <div className="mt-3">
              <Label>Which pool and when?</Label>
              <Textarea value={t.liquidityNote} onChange={(e) => upd('liquidityNote', e.target.value)} placeholder="e.g. SSL swept at London open, then BSL targeted in NY..." />
            </div>
          </Section>
          <Section title="Session Narrative">
            <Textarea rows={4} value={t.narrative} onChange={(e) => upd('narrative', e.target.value)} placeholder="e.g. Expect London to run SSL and reverse toward BSL." />
          </Section>
          <Section title="DR Levels">
            <div className="grid grid-cols-3 gap-3">
              <div><Label>High</Label><Input value={t.drHigh} onChange={(e) => upd('drHigh', e.target.value)} /></div>
              <div><Label>EQ</Label><Input value={t.drEq} onChange={(e) => upd('drEq', e.target.value)} /></div>
              <div><Label>Low</Label><Input value={t.drLow} onChange={(e) => upd('drLow', e.target.value)} /></div>
            </div>
          </Section>
          <Section title="Setup Quality">
            <div className="space-y-4">
              <div><Label>Breakout Quality</Label><PillGroup options={BREAKOUT_OPTS} value={t.breakoutQuality} onChange={(v) => upd('breakoutQuality', v as any)} /></div>
              <div><Label>FVG Location</Label><PillGroup options={FVG_OPTS} value={t.fvgLocation} onChange={(v) => upd('fvgLocation', v as any)} /></div>
              <div><Label>Entry Type</Label><PillGroup options={ENTRY_OPTS} value={t.entryType} onChange={(v) => upd('entryType', v as any)} /></div>
              <div><Label>LTF Confirmation</Label><MultiPillGroup options={LTF_OPTS} value={selectedLtf} onToggle={toggleLtf} /></div>
              <div><Label>DR Level</Label><PillGroup options={DR_LEVEL_OPTS} value={t.drLevel} onChange={(v) => upd('drLevel', v as any)} /></div>
            </div>
          </Section>
        </>
      )}

      {/* Template-specific or user-defined custom sections — fully isolated per strategy */}
      {customSections.map((sec) => (
        <Section key={sec.id} title={sec.title} subtitle={sec.subtitle}>
          <div className="space-y-3">
            {sec.fields.map((f) => {
              const val = t.customValues?.[f.id] || '';
              if (f.type === 'rich') {
                return (
                  <div key={f.id}>
                    <Label>{f.label}</Label>
                    <RichTextEditor value={val} onChange={(v) => updCustom(f.id, v)} placeholder={f.placeholder} />
                  </div>
                );
              }
              if (f.type === 'textarea') {
                return (
                  <div key={f.id}>
                    <Label>{f.label}</Label>
                    <Textarea value={val} onChange={(e) => updCustom(f.id, e.target.value)} placeholder={f.placeholder} rows={3} />
                  </div>
                );
              }
              return (
                <div key={f.id}>
                  <Label>{f.label}</Label>
                  <Input value={val} onChange={(e) => updCustom(f.id, e.target.value)} placeholder={f.placeholder} />
                </div>
              );
            })}
            {sec.fields.length === 0 && <p className="text-xs text-muted-foreground">No fields defined for this section.</p>}
          </div>
        </Section>
      ))}

      <Section title="Trade Execution">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div><Label>Entry Price</Label><Input value={t.entryPrice} onChange={(e) => upd('entryPrice', e.target.value)} /></div>
          <div><Label>Stop Loss</Label><Input value={t.stopLoss} onChange={(e) => upd('stopLoss', e.target.value)} /></div>
          <div><Label>TP1</Label><Input value={t.tp1} onChange={(e) => upd('tp1', e.target.value)} /></div>
          <div>
            <Label>TP1 Liquidity Pool</Label>
            <Input value={t.tp1Target} onChange={(e) => upd('tp1Target', e.target.value)}
              placeholder="BSL above London High, Asia High, Equal Highs, External Range Liquidity..." />
          </div>
          <div><Label>TP2</Label><Input value={t.tp2} onChange={(e) => upd('tp2', e.target.value)} /></div>
          <div>
            <Label>TP2 Liquidity Pool</Label>
            <Input value={t.tp2Target} onChange={(e) => upd('tp2Target', e.target.value)}
              placeholder="SSL below Asia Low, Daily Low, Sellside Pool, Weekly Low..." />
          </div>
        </div>
      </Section>

      <Section title="Result">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><Label>Outcome</Label><PillGroup options={RESULT_OPTS} value={t.result} onChange={(v) => upd('result', v as any)} /></div>
          <div>
            <Label>RR Achieved</Label>
            <Input value={t.rAchieved} onChange={(e) => upd('rAchieved', e.target.value)} placeholder="e.g. 2.5RR" />
          </div>
        </div>
      </Section>

      <Section title="Process Grade">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {([
            { g: 'A' as const, label: 'A Grade', desc: 'Followed model exactly.' },
            { g: 'B' as const, label: 'B Grade', desc: 'Minor deviation from model.' },
            { g: 'C' as const, label: 'C Grade', desc: 'Significant deviation from model.' },
          ]).map((opt) => (
            <button
              key={opt.g}
              type="button"
              onClick={() => upd('grade', opt.g)}
              className={cn(
                'p-4 rounded-lg border-2 text-left transition-all',
                t.grade === opt.g
                  ? opt.g === 'A'
                    ? 'border-[hsl(var(--gold))] bg-[hsl(var(--gold)/0.08)] shadow-[0_0_0_3px_hsl(var(--gold)/0.15)]'
                    : 'border-primary bg-primary/5 shadow-md'
                  : 'border-border hover:border-primary/50 hover:bg-accent',
              )}
            >
              <div className={cn('text-2xl font-heading font-bold', t.grade === opt.g && opt.g === 'A' && 'text-[hsl(var(--gold))]')}>{opt.label}</div>
              <div className="text-xs text-muted-foreground mt-1">{opt.desc}</div>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Emotional State">
        <PillGroup options={EMO_OPTS} value={t.emotionalState} onChange={(v) => upd('emotionalState', v as any)} />
      </Section>

      <Section title="Screenshots" subtitle="Paste with Ctrl+V, drag-and-drop, or click. Auto-saves.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <UnifiedMediaBox
            label="Predicted Setup"
            value={t.predictedScreenshot || ''}
            onChange={(v) => upd('predictedScreenshot', v || undefined)}
            accept={['image']}
          />
          <UnifiedMediaBox
            label="Actual Outcome"
            value={t.actualScreenshot || ''}
            onChange={(v) => upd('actualScreenshot', v || undefined)}
            accept={['image']}
          />
        </div>
      </Section>

      <Section title="Reflection">
        <div className="space-y-4">
          <div><Label>What Went Well</Label>
            <RichTextEditor value={t.reflectionWentWell} onChange={(v) => upd('reflectionWentWell', v)} placeholder="Strengths in this trade..." />
          </div>
          <div><Label>What To Improve</Label>
            <RichTextEditor value={t.reflectionToImprove} onChange={(v) => upd('reflectionToImprove', v)} placeholder="Areas to refine..." />
          </div>
          <div><Label>Trade Review Notes</Label>
            <RichTextEditor value={t.reflectionNotes} onChange={(v) => upd('reflectionNotes', v)} placeholder="Detailed review..." />
          </div>
        </div>
      </Section>

      <Card className="p-5 border-2 border-primary/40 bg-primary/5">
        <h2 className="font-heading font-bold text-lg mb-1">Model Review</h2>
        <p className="text-xs text-muted-foreground mb-4">The critical post-mortem — answer with intent.</p>
        <div className="space-y-4">
          <div>
            <Label className="text-base">Did this trade follow the model?</Label>
            <RichTextEditor value={t.reviewFollowedModel} onChange={(v) => upd('reviewFollowedModel', v)} placeholder="Yes/No and why..." />
          </div>
          <div>
            <Label className="text-base">What was the narrative?</Label>
            <RichTextEditor value={t.reviewNarrative} onChange={(v) => upd('reviewNarrative', v)} placeholder="Describe the actual market story..." />
          </div>
          <div>
            <Label className="text-base">What would you do differently?</Label>
            <RichTextEditor value={t.reviewDifferently} onChange={(v) => upd('reviewDifferently', v)} placeholder="Lessons & adjustments..." />
          </div>
        </div>
      </Card>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <Card className="p-5">
      <div className="mb-4">
        <h3 className="font-heading font-semibold text-base">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </Card>
  );
}

function MultiPillGroup<T extends string>({ options, value, onToggle }: { options: readonly T[]; value: T[]; onToggle: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = value.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onToggle(opt)}
            className={cn(
              'rounded-full border px-4 py-1.5 text-sm transition-all',
              active
                ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                : 'bg-background border-border hover:border-primary/50 hover:bg-accent',
            )}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}
