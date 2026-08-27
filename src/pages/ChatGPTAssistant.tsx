import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '@/integrations/supabase/client';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { Chat } from '@ai-sdk/react';
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation';
import {
  Message,
  MessageContent,
  MessageResponse,
} from '@/components/ai-elements/message';
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from '@/components/ai-elements/prompt-input';
import { Shimmer } from '@/components/ai-elements/shimmer';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Bot, MessageSquarePlus, MoreVertical, Trash2, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const PAGE_TITLE = 'AI Assistant';

function generateUUID() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function loadThreadMessages(threadId: string): Promise<UIMessage[]> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('id,role,content,parts,created_at')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true });
  if (error) {
    console.error('Failed to load messages:', error);
    return [];
  }
  return (data || []).map((row: any) => ({
    id: row.id,
    role: row.role,
    content: row.content || '',
    parts: Array.isArray(row.parts) ? row.parts : [{ type: 'text', text: row.content || '' }],
    createdAt: row.created_at,
  }));
}

async function createThread(threadId: string) {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return;
  await supabase.from('chat_threads').upsert({ id: threadId, user_id: userId, title: 'New conversation' }, { onConflict: 'id' });
}

async function deleteThread(threadId: string) {
  await supabase.from('chat_threads').delete().eq('id', threadId);
}

async function updateThreadTitle(threadId: string, title: string) {
  await supabase.from('chat_threads').update({ title }).eq('id', threadId);
}

function useThreads() {
  const { user } = useAuth();
  const [threads, setThreads] = useState<{ id: string; title: string; updated_at: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    const fetchThreads = async () => {
      const { data, error } = await supabase
        .from('chat_threads')
        .select('id,title,updated_at')
        .order('updated_at', { ascending: false });
      if (cancelled) return;
      if (error) {
        console.error('Failed to load threads:', error);
      } else {
        setThreads(data || []);
      }
      setLoading(false);
    };

    fetchThreads();

    channel = supabase.channel('chat-threads-list');
    channel.on(
      'postgres_changes' as any,
      { event: '*', schema: 'public', table: 'chat_threads' },
      () => fetchThreads(),
    );
    channel.subscribe();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [user?.id]);

  return { threads, loading };
}

function ThreadList({ activeThreadId }: { activeThreadId: string }) {
  const { threads, loading } = useThreads();
  const navigate = useNavigate();

  const handleNew = async () => {
    const id = generateUUID();
    await createThread(id);
    navigate(`/chat/${id}`);
  };

  return (
    <div className="flex flex-col h-full w-64 shrink-0 border-r border-border bg-card/30">
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Bot className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-heading font-bold text-foreground">AI Assistant</h2>
            <p className="text-[10px] text-muted-foreground">ChatGPT-powered</p>
          </div>
        </div>
        <Button onClick={handleNew} className="w-full gap-1.5 text-xs" size="sm">
          <MessageSquarePlus className="h-3.5 w-3.5" /> New conversation
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {loading && (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        )}
        {!loading && threads.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-6 px-2">No conversations yet.</p>
        )}
        {threads.map((thread) => (
          <ThreadRow
            key={thread.id}
            thread={thread}
            active={thread.id === activeThreadId}
            onDelete={() => deleteThread(thread.id)}
          />
        ))}
      </div>
    </div>
  );
}

function ThreadRow({
  thread,
  active,
  onDelete,
}: {
  thread: { id: string; title: string; updated_at: string };
  active: boolean;
  onDelete: () => void;
}) {
  const [isDeleted, setIsDeleted] = useState(false);
  if (isDeleted) return null;

  return (
    <div
      className={cn(
        'group flex items-center justify-between rounded-lg px-2.5 py-2 transition-colors',
        active ? 'bg-primary/10 text-foreground border border-primary/20' : 'hover:bg-muted/50 text-muted-foreground',
      )}
    >
      <Link to={`/chat/${thread.id}`} className="flex-1 min-w-0 mr-1">
        <p className={cn('text-xs font-medium truncate', active && 'text-foreground')}>{thread.title || 'New conversation'}</p>
        <p className="text-[10px] text-muted-foreground truncate">
          {new Date(thread.updated_at).toLocaleDateString()}
        </p>
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="opacity-0 group-hover:opacity-100 h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreVertical className="h-3 w-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            className="text-xs text-destructive focus:text-destructive"
            onClick={() => {
              onDelete();
              setIsDeleted(true);
            }}
          >
            <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function ChatWindow({ threadId }: { threadId: string }) {
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadThreadMessages(threadId).then((msgs) => {
      if (cancelled) return;
      setInitialMessages(msgs);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [threadId]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `${SUPABASE_URL}/functions/v1/chatgpt-assistant`,
        headers: async () => {
          const { data } = await supabase.auth.getSession();
          return {
            Authorization: `Bearer ${data.session?.access_token ?? SUPABASE_PUBLISHABLE_KEY}`,
            apikey: SUPABASE_PUBLISHABLE_KEY,
          };
        },

        body: { threadId },
      }),
    [threadId],
  );

  const chat = useMemo(
    () =>
      new Chat({
        id: threadId,
        messages: initialMessages,
        transport,
      }),
    [threadId, initialMessages, transport],
  );

  const { messages, sendMessage, status, error } = useChat({ chat });

  const isBusy = status === 'submitted' || status === 'streaming';

  const handleSubmit = async ({ text }: { text: string }) => {
    if (!text.trim()) return;
    await sendMessage({ text: text.trim() });
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-background">
      <Conversation className="flex-1">
        <ConversationContent className="px-4 py-6 md:px-8 lg:px-12 max-w-3xl mx-auto w-full">
          {messages.length === 0 ? (
            <ConversationEmptyState
              icon={<Bot className="h-6 w-6" />}
              title="ChatGPT Assistant"
              description="Ask about your trades, plans, psychology, or market analysis. Your journal data is included automatically."
            />
          ) : (
            messages.map((message) => (
              <Message key={message.id} from={message.role} className="py-2">
                <MessageContent>
                  {message.role === 'assistant' ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown>
                        {message.parts
                          .filter((part) => part.type === 'text')
                          .map((part) => (part as any).text)
                          .join('')}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <span>
                      {message.parts
                        .filter((part) => part.type === 'text')
                        .map((part) => (part as any).text)
                        .join('')}
                    </span>
                  )}
                </MessageContent>
                {message.role === 'assistant' && isBusy && message.id === messages[messages.length - 1]?.id && (
                  <div className="mt-1 ml-1">
                    <Shimmer className="text-xs text-muted-foreground">Thinking...</Shimmer>
                  </div>
                )}
              </Message>
            ))
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {error && (
        <div className="px-4 pb-2">
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error.message || 'Something went wrong. Please try again.'}
          </div>
        </div>
      )}

      <div className="p-4 border-t border-border">
        <div className="max-w-3xl mx-auto">
          <PromptInput onSubmit={handleSubmit}>
            <PromptInputTextarea
              placeholder="Ask about your journal, trades, or plans..."
              disabled={isBusy}
              className="min-h-[56px]"
            />
            <PromptInputFooter className="justify-end pt-2">
              <PromptInputSubmit status={status} disabled={isBusy} />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </div>
    </div>
  );
}

export default function ChatGPTAssistant() {
  const { threadId: routeThreadId } = useParams<{ threadId?: string }>();
  const navigate = useNavigate();
  const [bootstrapping, setBootstrapping] = useState(!routeThreadId);

  useEffect(() => {
    if (!routeThreadId) {
      const id = generateUUID();
      createThread(id).then(() => {
        navigate(`/chat/${id}`, { replace: true });
      });
      setBootstrapping(true);
    } else {
      setBootstrapping(false);
    }
  }, [routeThreadId, navigate]);

  if (bootstrapping || !routeThreadId) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <ThreadList activeThreadId={routeThreadId} />
      <ChatWindow key={routeThreadId} threadId={routeThreadId} />
    </div>
  );
}
