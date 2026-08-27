import { cn } from '@/lib/utils';
import { PropFirmStage } from '@/types/trading';

interface PhaseProgressBarProps {
  currentStage?: PropFirmStage;
  progress: number;
  steps?: 1 | 2 | 3;
  completedPhases?: string[];
}

export function PhaseProgressBar({ currentStage, progress, steps = 2, completedPhases = [] }: PhaseProgressBarProps) {
  if (!currentStage) return null;

  // Build phases based on steps
  const phases: string[] = [];
  for (let i = 1; i <= steps; i++) phases.push(`Phase ${i}`);
  phases.push('Funded');

  const currentIdx = phases.indexOf(currentStage === 'Scale Up' ? 'Funded' : currentStage);

  return (
    <div className="mt-3 space-y-1.5">
      {/* Phase labels */}
      <div className="flex justify-between text-[9px] font-semibold uppercase tracking-wider">
        {phases.map((phase, i) => {
          const isComplete = i < currentIdx || completedPhases.includes(phase);
          const isCurrent = i === currentIdx;
          return (
            <span
              key={phase}
              className={cn(
                isComplete && 'text-success',
                isCurrent && 'text-primary',
                !isComplete && !isCurrent && 'text-muted-foreground/50'
              )}
            >
              {phase === 'Funded' ? '✓ Funded' : phase}
              {isComplete && ' ✓'}
            </span>
          );
        })}
      </div>
      {/* Progress track */}
      <div className="flex gap-0.5 h-1.5">
        {phases.map((phase, i) => {
          const isComplete = i < currentIdx || completedPhases.includes(phase);
          const isCurrent = i === currentIdx;
          return (
            <div key={phase} className="flex-1 bg-muted/30 rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  isComplete && 'bg-success',
                  isCurrent && 'bg-primary',
                )}
                style={{ width: isComplete ? '100%' : isCurrent ? `${progress}%` : '0%' }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
