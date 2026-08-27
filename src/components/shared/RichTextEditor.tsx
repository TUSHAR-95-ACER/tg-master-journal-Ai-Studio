import { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, Code, Heading1, Heading2, Heading3,
  List, ListOrdered, Quote, Link as LinkIcon, Highlighter, Palette, Undo, Redo, Check,
  Sparkles, Loader2, Wand2,
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  onPaste?: (e: React.ClipboardEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  /** Called on every transaction with the editor instance — useful to bubble up plain text. */
  onEditorReady?: (editor: Editor) => void;
}

const COLOR_SWATCHES = [
  { label: 'Default', value: 'inherit' },
  { label: 'Blue',    value: 'hsl(210 100% 55%)' },
  { label: 'Green',   value: 'hsl(142 71% 45%)' },
  { label: 'Amber',   value: 'hsl(38 92% 50%)' },
  { label: 'Red',     value: 'hsl(0 84% 60%)' },
  { label: 'Purple',  value: 'hsl(268 83% 65%)' },
  { label: 'Pink',    value: 'hsl(330 80% 60%)' },
];

const HIGHLIGHT_SWATCHES = [
  { label: 'None',   value: null },
  { label: 'Yellow', value: 'hsl(48 100% 60% / 0.35)' },
  { label: 'Green',  value: 'hsl(142 71% 45% / 0.25)' },
  { label: 'Blue',   value: 'hsl(210 100% 55% / 0.25)' },
  { label: 'Pink',   value: 'hsl(330 80% 60% / 0.25)' },
  { label: 'Red',    value: 'hsl(0 84% 60% / 0.25)' },
];

/** Wrap legacy plain text as a paragraph so Tiptap can hydrate it cleanly. */
export function coerceEditorHtml(raw: string): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (trimmed.startsWith('<') && trimmed.endsWith('>')) return raw;
  // Plain text → paragraph(s)
  return raw
    .split(/\n{2,}/)
    .map((block) => `<p>${block.replace(/\n/g, '<br/>')}</p>`)
    .join('');
}

/** Strip HTML to plain text for previews/AI context. */
export function htmlToPlain(html: string): string {
  if (!html) return '';
  if (typeof document === 'undefined') return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const div = document.createElement('div');
  div.innerHTML = html;
  return (div.textContent || div.innerText || '').replace(/\s+/g, ' ').trim();
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Start writing…',
  className,
  onPaste,
  onDrop,
  onEditorReady,
}: RichTextEditorProps) {
  const lastEmittedRef = useRef<string>(value);
  const [aiBusy, setAiBusy] = useState<null | 'improve' | 'polish'>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      Highlight.configure({ multicolor: true }),
      TextStyle,
      Color,
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { class: 'text-primary underline' } }),
      Placeholder.configure({ placeholder }),
    ],
    content: coerceEditorHtml(value),
    editorProps: {
      attributes: {
        class: cn(
          'tiptap prose prose-sm prose-invert max-w-none focus:outline-none',
          'min-h-[120px] text-sm leading-relaxed font-journal text-foreground',
        ),
      },
      // Strip hardcoded color / background-color from pasted HTML so dark-mode text
      // (and light-mode text) always inherits the theme palette and stays visible.
      transformPastedHTML(html: string) {
        if (typeof window === 'undefined' || !html) return html;
        try {
          const tpl = document.createElement('template');
          tpl.innerHTML = html;
          tpl.content.querySelectorAll<HTMLElement>('[style]').forEach((el) => {
            // Remove just color & background-color, keep other styles (bold/size/etc).
            el.style.removeProperty('color');
            el.style.removeProperty('background');
            el.style.removeProperty('background-color');
            el.style.removeProperty('-webkit-text-fill-color');
            if (!el.getAttribute('style')?.trim()) el.removeAttribute('style');
          });
          // Drop legacy <font color="..."> attributes too.
          tpl.content.querySelectorAll('font[color]').forEach((el) => el.removeAttribute('color'));
          return tpl.innerHTML;
        } catch {
          return html;
        }
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      lastEmittedRef.current = html;
      onChange(html);
    },
  });

  // Keep editor in sync when external value changes (e.g. draft restore).
  useEffect(() => {
    if (!editor) return;
    if (value === lastEmittedRef.current) return;
    const current = editor.getHTML();
    const incoming = coerceEditorHtml(value);
    if (incoming !== current) {
      editor.commands.setContent(incoming, { emitUpdate: false });
      lastEmittedRef.current = incoming;
    }
  }, [value, editor]);

  useEffect(() => {
    if (editor && onEditorReady) onEditorReady(editor);
  }, [editor, onEditorReady]);

  if (!editor) return null;

  const ToolbarBtn = ({
    onClick, active, title, children,
  }: { onClick: () => void; active?: boolean; title: string; children: React.ReactNode }) => (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className={cn(
        'inline-flex h-7 w-7 items-center justify-center rounded-md text-foreground/80 hover:bg-muted hover:text-foreground transition-colors',
        active && 'bg-primary/15 text-primary',
      )}
    >
      {children}
    </button>
  );

  const setLink = () => {
    const prev = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('Link URL', prev || 'https://');
    if (url === null) return;
    if (!url) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const runAiRewrite = async (mode: 'improve' | 'polish') => {
    if (aiBusy) return;
    const html = editor.getHTML();
    const plain = htmlToPlain(html);
    if (!plain) {
      toast({ title: 'Nothing to rewrite', description: 'Write some text first.' });
      return;
    }
    setAiBusy(mode);
    try {
      const { data, error } = await supabase.functions.invoke('ai-rewrite', { body: { mode, html } });
      if (error) throw error;
      const next = (data as { html?: string })?.html?.trim();
      if (!next) throw new Error('Empty AI response');
      editor.commands.setContent(next, { emitUpdate: true });
      toast({
        title: mode === 'improve' ? '✨ Notes improved' : '🧠 Journal polished',
        description: 'Updated in place. Undo (⌘Z) to revert.',
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'AI request failed';
      toast({ title: 'AI rewrite failed', description: msg.slice(0, 140), variant: 'destructive' });
    } finally {
      setAiBusy(null);
    }
  };

  return (
    <div className={cn('relative overflow-visible', className)} onPaste={onPaste} onDrop={onDrop} onDragOver={(e) => e.preventDefault()}>
      <BubbleMenu
        editor={editor}
        updateDelay={0}
        shouldShow={({ editor, from, to }) => {
          if (from === to) return false;
          const text = editor.state.doc.textBetween(from, to, ' ').trim();
          return text.length > 0;
        }}
        options={{ placement: 'top', strategy: 'fixed' }}
        className="z-[9999] flex items-center gap-0.5 rounded-xl border border-border bg-popover/95 px-1.5 py-1 shadow-xl backdrop-blur"
      >
        <ToolbarBtn title="Heading 1" active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}><Heading1 className="h-3.5 w-3.5" /></ToolbarBtn>
        <ToolbarBtn title="Heading 2" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 className="h-3.5 w-3.5" /></ToolbarBtn>
        <ToolbarBtn title="Heading 3" active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 className="h-3.5 w-3.5" /></ToolbarBtn>
        <div className="mx-1 h-5 w-px bg-border" />
        <ToolbarBtn title="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="h-3.5 w-3.5" /></ToolbarBtn>
        <ToolbarBtn title="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="h-3.5 w-3.5" /></ToolbarBtn>
        <ToolbarBtn title="Underline" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon className="h-3.5 w-3.5" /></ToolbarBtn>
        <ToolbarBtn title="Strikethrough" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough className="h-3.5 w-3.5" /></ToolbarBtn>
        <ToolbarBtn title="Inline code" active={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()}><Code className="h-3.5 w-3.5" /></ToolbarBtn>
        <div className="mx-1 h-5 w-px bg-border" />
        <ToolbarBtn title="Bulleted list" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="h-3.5 w-3.5" /></ToolbarBtn>
        <ToolbarBtn title="Numbered list" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="h-3.5 w-3.5" /></ToolbarBtn>
        <ToolbarBtn title="Quote" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote className="h-3.5 w-3.5" /></ToolbarBtn>
        <div className="mx-1 h-5 w-px bg-border" />
        <ToolbarBtn title="Link" active={editor.isActive('link')} onClick={setLink}><LinkIcon className="h-3.5 w-3.5" /></ToolbarBtn>
        <SwatchPopover
          icon={<Palette className="h-3.5 w-3.5" />}
          title="Text color"
          swatches={COLOR_SWATCHES}
          activeValue={(editor.getAttributes('textStyle').color as string) || 'inherit'}
          onPick={(val) => {
            if (val === 'inherit') editor.chain().focus().unsetColor().run();
            else editor.chain().focus().setColor(val).run();
          }}
        />
        <SwatchPopover
          icon={<Highlighter className="h-3.5 w-3.5" />}
          title="Highlight"
          swatches={HIGHLIGHT_SWATCHES.map((s) => ({ label: s.label, value: s.value ?? 'inherit' }))}
          activeValue={(editor.getAttributes('highlight').color as string) || 'inherit'}
          onPick={(val) => {
            if (val === 'inherit') editor.chain().focus().unsetHighlight().run();
            else editor.chain().focus().setHighlight({ color: val }).run();
          }}
        />
        <div className="mx-1 h-5 w-px bg-border" />
        <ToolbarBtn title="Undo" onClick={() => editor.chain().focus().undo().run()}><Undo className="h-3.5 w-3.5" /></ToolbarBtn>
        <ToolbarBtn title="Redo" onClick={() => editor.chain().focus().redo().run()}><Redo className="h-3.5 w-3.5" /></ToolbarBtn>
        <div className="mx-1 h-5 w-px bg-border" />
        <ToolbarBtn
          title="✨ Improve Notes — fix grammar, keep your voice"
          active={aiBusy === 'improve'}
          onClick={() => runAiRewrite('improve')}
        >
          {aiBusy === 'improve' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
        </ToolbarBtn>
        <ToolbarBtn
          title="🧠 Journal Polish — restructure for readability"
          active={aiBusy === 'polish'}
          onClick={() => runAiRewrite('polish')}
        >
          {aiBusy === 'polish' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
        </ToolbarBtn>
      </BubbleMenu>

      <EditorContent editor={editor} />
    </div>
  );
}

interface Swatch { label: string; value: string }
function SwatchPopover({
  icon, title, swatches, activeValue, onPick,
}: { icon: React.ReactNode; title: string; swatches: Swatch[]; activeValue: string; onPick: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={title}
          onMouseDown={(e) => e.preventDefault()}
          className={cn(
            'inline-flex h-7 w-7 items-center justify-center rounded-md text-foreground/80 hover:bg-muted hover:text-foreground transition-colors',
            open && 'bg-primary/15 text-primary',
          )}
        >
          {icon}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="center"
        sideOffset={6}
        className="z-[60] w-auto p-2 rounded-xl border-border bg-popover shadow-xl"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="grid grid-cols-4 gap-1.5">
          {swatches.map((c) => {
            const isActive = c.value === activeValue;
            return (
              <button
                key={c.label}
                type="button"
                title={c.label}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { onPick(c.value); }}
                className={cn(
                  'group relative h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-muted transition-colors',
                )}
              >
                <span
                  className={cn(
                    'h-5 w-5 rounded-full border border-border/70 shadow-sm',
                    c.value === 'inherit' && 'bg-[conic-gradient(at_top_left,_transparent,_hsl(var(--muted-foreground)/0.4))]',
                  )}
                  style={{ background: c.value === 'inherit' ? undefined : c.value }}
                />
                {isActive && (
                  <Check className="absolute h-3 w-3 text-foreground drop-shadow-[0_0_2px_rgba(0,0,0,0.6)]" />
                )}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
