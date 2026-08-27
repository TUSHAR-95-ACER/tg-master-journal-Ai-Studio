import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { usePageVisibility } from '@/contexts/PageVisibilityContext';
import { supabase } from '@/integrations/supabase/client';
import {
  LayoutDashboard, ArrowLeftRight, Wallet,
  Brain, Target, FlaskConical, ClipboardList, BarChart3,
  Pin, PinOff, BookOpen, FileText,
  Eye, Gem, Sparkles, Shield, Crosshair, Sliders, Beaker, LogOut, Settings, Activity, MessageCircle, Compass, ClipboardCheck, Bot } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem { path: string; label: string; icon: any; }
interface NavSection { title: string; items: NavItem[]; }

const sections: NavSection[] = [
  {
    title: 'OVERVIEW',
    items: [
      { path: '/', label: 'Dashboard', icon: LayoutDashboard },
      { path: '/trades', label: 'Trades', icon: ArrowLeftRight },
      { path: '/accounts', label: 'Accounts', icon: Wallet },
      { path: '/notebook', label: 'Notebook', icon: BookOpen },
    ],
  },
  {
    title: 'PLANNING & REVIEW',
    items: [
      { path: '/macro-intelligence', label: 'Macro Intelligence', icon: Compass },
      { path: '/weekly-plan', label: 'Weekly Plan', icon: ClipboardList },
      { path: '/daily-plan', label: 'Daily Plan', icon: FileText },
      { path: '/trading-checklist', label: 'Checklist', icon: ClipboardCheck },
      { path: '/weekly-review', label: 'Weekly Review', icon: FileText },
      { path: '/psychology', label: 'Psychology', icon: Brain },
      { path: '/mistakes', label: 'Mistakes', icon: Target },
      { path: '/setup-playbook', label: 'Setup Playbook', icon: FlaskConical },
    ],
  },
  {
    title: 'INTELLIGENCE',
    items: [
      { path: '/chat', label: 'AI Assistant', icon: Bot },
      { path: '/analytics', label: 'Analytics', icon: BarChart3 },
      { path: '/bias-analytics', label: 'Bias Analytics', icon: Crosshair },
      { path: '/behavior-patterns', label: 'Behavior', icon: Eye },
      { path: '/trade-quality', label: 'Trade Quality', icon: Gem },
      { path: '/ai-insights', label: 'AI Insights', icon: Sparkles },
      { path: '/research-lab', label: 'Research Lab', icon: Beaker },
    ],
  },
  {
    title: 'SYSTEM',
    items: [
      { path: '/trading-rules', label: 'Trading Rules', icon: Shield },
      { path: '/control-center', label: 'Control Center', icon: Sliders },
      
      { path: '/system-analytics', label: 'System Analytics', icon: Activity },
      { path: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

const SLIM = 56;   // px collapsed width (footprint)
const WIDE = 232;  // px expanded width (overlay) — 2-col card grid

export function Sidebar() {
  // Default to unpinned (slim, hover-to-expand overlay). User can opt-in via pin toggle.
  const [pinned, setPinned] = useState<boolean>(() => {
    try { return localStorage.getItem('sidebar-pinned-v2') === '1'; } catch { return false; }
  });
  const [hover, setHover] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut, user } = useAuth();
  const { isPageEnabled } = usePageVisibility();
  const [profileName, setProfileName] = useState<string>('');

  const expanded = pinned || hover;

  useEffect(() => {
    if (!user) { setProfileName(''); return; }
    let cancelled = false;
    const metaName = (user.user_metadata as any)?.full_name || (user.user_metadata as any)?.name;
    if (metaName) setProfileName(metaName);
    supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle().then(({ data }) => {
      if (cancelled) return;
      const name = (data as any)?.full_name || metaName || '';
      if (name) setProfileName(name);
    });
    return () => { cancelled = true; };
  }, [user]);

  const togglePin = () => {
    setPinned(p => {
      const next = !p;
      try { localStorage.setItem('sidebar-pinned-v2', next ? '1' : '0'); } catch {}
      return next;
    });
  };

  const displayName = profileName || 'Trader Workspace';

  const filteredSections = sections.map(section => ({
    ...section,
    items: section.items.filter(item => item.path === '/settings' || isPageEnabled(item.path)),
  })).filter(section => section.items.length > 0);

  return (
    // Outer reserves only slim width so main content stays wide.
    <div
      style={{ width: SLIM }}
      className="relative shrink-0 h-screen"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <aside
        style={{ width: expanded ? WIDE : SLIM }}
        className={cn(
          "absolute inset-y-0 left-0 z-50 flex flex-col bg-sidebar border-r border-sidebar-border/80 transition-[width] duration-150 ease-out overflow-hidden",
          expanded && !pinned && "shadow-[0_8px_40px_-4px_rgba(0,0,0,0.55)] border-r-foreground/10"
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-2.5 h-11 border-b border-sidebar-border/80 shrink-0">
          <div className="h-7 w-7 rounded-md border border-sidebar-border bg-sidebar-accent flex items-center justify-center shrink-0">
            <span className="text-foreground font-heading font-bold text-[10px]">MJ</span>
          </div>
          {expanded && (
            <div className="flex flex-col overflow-hidden flex-1 min-w-0">
              <span className="font-heading text-[12px] font-bold text-foreground leading-tight truncate tracking-tight">Master Journal</span>
              <span className="text-[9px] font-medium text-muted-foreground leading-tight truncate">{displayName}</span>
            </div>
          )}
          {expanded && (
            <button
              onClick={togglePin}
              title={pinned ? "Unpin sidebar" : "Pin sidebar open"}
              className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors shrink-0"
            >
              {pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
            </button>
          )}
        </div>

        {/* Nav — 2-col card grid launcher */}
        <nav className="flex-1 py-2 overflow-y-auto overflow-x-hidden scrollbar-hide">
          {filteredSections.map(section => (
            <div key={section.title} className="mb-2.5">
              {expanded ? (
                <p className="px-2.5 mb-1.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">{section.title}</p>
              ) : (
                <div className="mx-2 mb-1.5 h-px bg-sidebar-border/60" />
              )}
              <div className={cn("px-1.5", expanded ? "grid grid-cols-2 gap-1" : "flex flex-col gap-1")}>
                {section.items.map(item => {
                  const active = location.pathname === item.path;
                  return (
                    <button
                      key={item.path}
                      onClick={() => navigate(item.path)}
                      title={!expanded ? item.label : item.label}
                      className={cn(
                        "group relative flex flex-col items-center justify-center gap-1 rounded-md border transition-all",
                        expanded
                          ? "h-[52px] px-1.5 py-1.5"
                          : "h-9 w-9 mx-auto border-transparent",
                        active
                          ? "bg-gradient-to-br from-primary/15 via-sidebar to-[hsl(var(--gold)/0.12)] border-[hsl(var(--gold)/0.55)] text-foreground shadow-[inset_0_0_0_1px_hsl(var(--gold)/0.25),0_0_12px_-2px_hsl(var(--gold)/0.35)]"
                          : expanded
                            ? "bg-sidebar border-sidebar-border/60 text-foreground/75 hover:bg-sidebar-accent hover:text-foreground hover:border-sidebar-border"
                            : "text-foreground/70 hover:bg-sidebar-accent hover:text-foreground"
                      )}
                    >
                      <item.icon className={cn("shrink-0 transition-colors", expanded ? "h-4 w-4" : "h-4 w-4", active && "text-gold drop-shadow-[0_0_4px_hsl(var(--gold)/0.6)]")} />
                      {expanded && (
                        <span className={cn("text-[9.5px] font-medium leading-tight tracking-tight text-center truncate w-full", active && "text-gold")}>{item.label}</span>
                      )}
                      {active && expanded && (
                        <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-gold shadow-[0_0_6px_hsl(var(--gold)/0.8)]" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-sidebar-border shrink-0">
          <button
            onClick={signOut}
            title="Logout"
            className={cn(
              "flex items-center gap-2 w-full h-8 text-[11px] text-destructive hover:bg-destructive/10 transition-colors",
              expanded ? "px-2.5 justify-start" : "justify-center"
            )}
          >
            <LogOut className="h-3.5 w-3.5 shrink-0" />
            {expanded && <span>Logout</span>}
          </button>
        </div>
      </aside>
    </div>
  );
}
