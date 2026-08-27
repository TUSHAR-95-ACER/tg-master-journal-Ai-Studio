import { cn } from '@/lib/utils';

interface PillGroupProps<T extends string> {
  options: readonly T[] | T[];
  value: T | '';
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
  className?: string;
}

export function PillGroup<T extends string>({ options, value, onChange, size = 'md', className }: PillGroupProps<T>) {
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {options.map((opt) => {
        const active = value === opt;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={cn(
              'rounded-full border transition-all',
              size === 'sm' ? 'px-3 py-1 text-xs' : 'px-4 py-1.5 text-sm',
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
