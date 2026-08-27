import * as React from 'react';
import { cn } from '@/lib/utils';

export interface AutoExpandTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  minRows?: number;
}

/**
 * Notion-style auto-expanding textarea.
 * - No internal scrollbar
 * - Grows to fit content
 * - Inherits theme colors via semantic tokens
 */
export const AutoExpandTextarea = React.forwardRef<HTMLTextAreaElement, AutoExpandTextareaProps>(
  ({ className, minRows = 3, value, onChange, ...props }, ref) => {
    const innerRef = React.useRef<HTMLTextAreaElement | null>(null);

    const setRefs = (el: HTMLTextAreaElement | null) => {
      innerRef.current = el;
      if (typeof ref === 'function') ref(el);
      else if (ref) (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
    };

    const resize = React.useCallback(() => {
      const el = innerRef.current;
      if (!el) return;
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    }, []);

    React.useLayoutEffect(() => {
      resize();
    }, [value, resize]);

    React.useEffect(() => {
      const onResize = () => resize();
      window.addEventListener('resize', onResize);
      return () => window.removeEventListener('resize', onResize);
    }, [resize]);

    return (
      <textarea
        ref={setRefs}
        rows={minRows}
        value={value}
        onChange={(e) => {
          onChange?.(e);
          resize();
        }}
        className={cn(
          'w-full resize-none overflow-hidden bg-transparent text-sm leading-relaxed',
          'text-foreground placeholder:text-muted-foreground',
          'focus:outline-none focus:ring-0 border-0 p-0',
          className,
        )}
        {...props}
      />
    );
  },
);
AutoExpandTextarea.displayName = 'AutoExpandTextarea';
