import { useState } from 'react';
import { SUPABASE_URL } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/use-toast';
import { TOGGLEABLE_PAGES, usePageVisibility } from '@/contexts/PageVisibilityContext';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Settings as SettingsIcon,
  ToggleLeft,
  CheckCircle2,
  XCircle,
  Target,
  BarChart3,
  Brain,
  Globe,
  Palette,
  Bell,
  Sun,
  Moon,
  Shield,
  Database,
  Sliders,
  User,
  Lock,
  KeyRound,
  Eye,
  EyeOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from 'next-themes';

import { useUserPreferences } from '@/hooks/useUserPreferences';

function SettingCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-5 space-y-4 hover:border-border transition-colors">
      <div>
        <h3 className="text-sm font-heading font-bold text-foreground">{title}</h3>
        {description && <p className="text-[11px] text-muted-foreground mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  );
}

function SettingRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 border-b border-border/10 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground">{label}</p>
        {description && <p className="text-[10px] text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

const moduleSectionOrder = ['OVERVIEW', 'PLANNING & REVIEW', 'INTELLIGENCE', 'SYSTEM'];

function WorkspaceModulesPanel() {
  const { enabledPages, togglePage, enableAll } = usePageVisibility();
  const grouped = moduleSectionOrder.map(section => ({
    section,
    pages: TOGGLEABLE_PAGES.filter(p => p.section === section),
  }));
  const enabledCount = Object.values(enabledPages).filter(Boolean).length;
  const totalCount = TOGGLEABLE_PAGES.length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-heading font-bold">Workspace Modules</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Toggle pages on/off. Hidden pages won't appear in sidebar.</p>
        </div>
        <Button variant="outline" size="sm" onClick={enableAll} className="gap-1.5">
          <ToggleLeft className="h-4 w-4" /> Enable All
        </Button>
      </div>
      <div className="flex gap-3">
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
          <CheckCircle2 className="h-3.5 w-3.5 text-success" />
          <span className="text-xs font-medium">{enabledCount} Active</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
          <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium">{totalCount - enabledCount} Hidden</span>
        </div>
      </div>
      {grouped.map(({ section, pages }) => (
        <div key={section} className="space-y-2">
          <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-1">{section}</h3>
          <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border/50">
            {pages.map(page => {
              const enabled = enabledPages[page.path] !== false;
              return (
                <div key={page.path} className={cn("flex items-center justify-between px-4 py-3 transition-colors", !enabled && "bg-muted/20")}>
                  <div className="flex items-center gap-3">
                    <div className={cn("h-2 w-2 rounded-full", enabled ? 'bg-success' : 'bg-muted-foreground/30')} />
                    <span className={cn("text-sm font-medium", enabled ? 'text-foreground' : 'text-muted-foreground')}>{page.label}</span>
                  </div>
                  <Switch checked={enabled} onCheckedChange={() => togglePage(page.path)} />
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function TradingPreferencesPanel({ prefs, update }: { prefs: any; update: (k: string, v: any) => void }) {
  return (
    <div className="space-y-5">
      <h2 className="text-lg font-heading font-bold">Trading Preferences</h2>
      <SettingCard title="Risk Management" description="Default risk parameters for new trades">
        <SettingRow label="Default Risk %" description="Applied to each new trade">
          <Input type="number" value={prefs.defaultRiskPercent ?? 1} onChange={e => update('defaultRiskPercent', parseFloat(e.target.value) || 0)} step="0.5" min="0.1" max="10" className="h-8 w-20 text-xs font-mono rounded-lg" />
        </SettingRow>
        <SettingRow label="Default Risk:Reward" description="Target RR ratio">
          <Input type="number" value={prefs.defaultRR ?? 2} onChange={e => update('defaultRR', parseFloat(e.target.value) || 0)} step="0.5" min="0.5" max="10" className="h-8 w-20 text-xs font-mono rounded-lg" />
        </SettingRow>
        <SettingRow label="Max Daily Trades" description="Limit trades per day">
          <Input type="number" value={prefs.maxDailyTrades ?? 3} onChange={e => update('maxDailyTrades', parseInt(e.target.value) || 1)} min="1" max="20" className="h-8 w-20 text-xs font-mono rounded-lg" />
        </SettingRow>
        <SettingRow label="Max Daily Loss" description="Stop trading after hitting this loss">
          <Input type="number" value={prefs.maxDailyLoss ?? 3} onChange={e => update('maxDailyLoss', parseFloat(e.target.value) || 0)} step="0.5" className="h-8 w-20 text-xs font-mono rounded-lg" />
        </SettingRow>
      </SettingCard>
      <SettingCard title="Session & Pairs" description="Primary trading focus">
        <SettingRow label="Default Session">
          <Select value={prefs.defaultSession ?? 'New York Kill Zone'} onValueChange={v => update('defaultSession', v)}>
            <SelectTrigger className="h-8 w-44 text-xs rounded-lg"><SelectValue /></SelectTrigger>
            <SelectContent>
              {['Asia', 'London', 'New York', 'New York Kill Zone', 'London Close'].map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>
        <SettingRow label="Preferred Pairs" description="Comma-separated">
          <Input value={prefs.preferredPairs ?? ''} onChange={e => update('preferredPairs', e.target.value)} className="h-8 w-56 text-xs rounded-lg" />
        </SettingRow>
        <SettingRow label="Default Market">
          <Select value={prefs.defaultMarket ?? 'Forex'} onValueChange={v => update('defaultMarket', v)}>
            <SelectTrigger className="h-8 w-36 text-xs rounded-lg"><SelectValue /></SelectTrigger>
            <SelectContent>
              {['Forex', 'Crypto', 'Commodities', 'Indices', 'Stocks', 'Futures'].map(m => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>
      </SettingCard>
    </div>
  );
}

function JournalBehaviorPanel({ prefs, update }: { prefs: any; update: (k: string, v: any) => void }) {
  return (
    <div className="space-y-5">
      <h2 className="text-lg font-heading font-bold">Journal Behavior</h2>
      <SettingCard title="Trade Logging" description="Control trade entry defaults and behaviors">
        <SettingRow label="Default Trade Size" description="Pre-filled lot size">
          <Input type="number" value={prefs.defaultTradeSize ?? 0.1} onChange={e => update('defaultTradeSize', parseFloat(e.target.value) || 0)} step="0.01" className="h-8 w-20 text-xs font-mono rounded-lg" />
        </SettingRow>
        <SettingRow label="Auto-save Plans" description="Save plans automatically as you type">
          <Switch checked={prefs.autoSavePlans ?? true} onCheckedChange={v => update('autoSavePlans', v)} />
        </SettingRow>
        <SettingRow label="Require Grade" description="Force grade selection on every trade">
          <Switch checked={prefs.requireGrade ?? true} onCheckedChange={v => update('requireGrade', v)} />
        </SettingRow>
        <SettingRow label="Require Psychology" description="Force emotion/focus/discipline entry">
          <Switch checked={prefs.requirePsychology ?? true} onCheckedChange={v => update('requirePsychology', v)} />
        </SettingRow>
        <SettingRow label="Show Entry Gate" description="Show checklist confirmation before logging trades">
          <Switch checked={prefs.showEntryGate ?? true} onCheckedChange={v => update('showEntryGate', v)} />
        </SettingRow>
      </SettingCard>
      <SettingCard title="Plan Defaults" description="Default values for daily and weekly plans">
        <SettingRow label="Default Max Trades" description="Pre-filled max trades per day">
          <Input type="number" value={prefs.defaultMaxTrades ?? 3} onChange={e => update('defaultMaxTrades', parseInt(e.target.value) || 1)} min="1" max="10" className="h-8 w-20 text-xs font-mono rounded-lg" />
        </SettingRow>
        <SettingRow label="Default Risk Limit" description="Pre-filled risk limit text">
          <Input value={prefs.defaultRiskLimit ?? '1% per trade'} onChange={e => update('defaultRiskLimit', e.target.value)} className="h-8 w-40 text-xs rounded-lg" />
        </SettingRow>
      </SettingCard>
    </div>
  );
}

function MCPIntegrationPanel() {
  const mcpUrl = `${SUPABASE_URL}/functions/v1/mcp`;
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(mcpUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };

  return (
    <SettingCard title="ChatGPT / MCP Integration" description="Connect ChatGPT, Claude, or Cursor to your journal">
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Use this URL to connect external AI assistants to TG Master Journal via MCP. They will be able to read your recent trades, daily plans, and performance stats after you authorize them.
        </p>
        <div className="flex items-center gap-2">
          <Input value={mcpUrl} readOnly className="h-8 text-xs font-mono rounded-lg flex-1" />
          <Button onClick={copy} variant="outline" size="sm" className="text-xs">
            {copied ? 'Copied' : 'Copy URL'}
          </Button>
        </div>
        <ol className="text-[11px] text-muted-foreground list-decimal pl-4 space-y-1">
          <li>Copy the MCP URL above.</li>
          <li>In ChatGPT / Claude / Cursor, add a new MCP server and paste this URL.</li>
          <li>Sign in when prompted and approve the connection on the consent screen.</li>
        </ol>
      </div>
    </SettingCard>
  );
}

function AISettingsPanel({ prefs, update }: { prefs: any; update: (k: string, v: any) => void }) {
  return (
    <div className="space-y-5">
      <h2 className="text-lg font-heading font-bold">AI Settings</h2>
      <SettingCard title="AI Coach" description="Personalize AI-powered trading analysis">
        <SettingRow label="AI Coach" description="Enable AI-powered trade analysis">
          <Switch checked={prefs.aiCoachEnabled ?? true} onCheckedChange={v => update('aiCoachEnabled', v)} />
        </SettingRow>
        <SettingRow label="Analysis Depth">
          <Select value={prefs.analysisDepth ?? 'advanced'} onValueChange={v => update('analysisDepth', v)}>
            <SelectTrigger className="h-8 w-36 text-xs rounded-lg"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="basic">Basic</SelectItem>
              <SelectItem value="advanced">Advanced</SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>
        <SettingRow label="Response Style">
          <Select value={prefs.responseStyle ?? 'direct'} onValueChange={v => update('responseStyle', v)}>
            <SelectTrigger className="h-8 w-44 text-xs rounded-lg"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="direct">Direct & Actionable</SelectItem>
              <SelectItem value="detailed">Detailed & Educational</SelectItem>
              <SelectItem value="motivational">Motivational</SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>
        <SettingRow label="Auto-generate Insights" description="AI reviews trades automatically after logging">
          <Switch checked={prefs.autoGenerateInsights ?? false} onCheckedChange={v => update('autoGenerateInsights', v)} />
        </SettingRow>
      </SettingCard>
      <MCPIntegrationPanel />
    </div>
  );
}

function MarketSettingsPanel({ prefs, update }: { prefs: any; update: (k: string, v: any) => void }) {
  return (
    <div className="space-y-5">
      <h2 className="text-lg font-heading font-bold">Market & Data</h2>
      <SettingCard title="Timezone" description="Your trading timezone">
        <SettingRow label="Default Timezone">
          <Select value={prefs.defaultTimezone ?? 'America/New_York'} onValueChange={v => update('defaultTimezone', v)}>
            <SelectTrigger className="h-8 w-48 text-xs rounded-lg"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[
                { value: 'America/New_York', label: 'New York (EST)' },
                { value: 'Europe/London', label: 'London (GMT)' },
                { value: 'Europe/Berlin', label: 'Berlin (CET)' },
                { value: 'Asia/Kolkata', label: 'Kolkata / Mumbai (IST)' },
                { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
                { value: 'Asia/Dubai', label: 'Dubai (GST)' },
                { value: 'Australia/Sydney', label: 'Sydney (AEST)' },
                { value: 'UTC', label: 'UTC' },
              ].map(tz => (
                <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>
      </SettingCard>
      <SettingCard title="Market Ticker" description="Live market ticker settings">
        <SettingRow label="Show Ticker" description="Display live ticker at top">
          <Switch checked={prefs.showTicker ?? true} onCheckedChange={v => update('showTicker', v)} />
        </SettingRow>
        <SettingRow label="Ticker Symbols" description="Comma-separated symbols">
          <Input value={prefs.tickerSymbols ?? ''} onChange={e => update('tickerSymbols', e.target.value)} className="h-8 w-56 text-xs rounded-lg" />
        </SettingRow>
      </SettingCard>
    </div>
  );
}

function UIPreferencesPanel({ prefs, update }: { prefs: any; update: (k: string, v: any) => void }) {
  const { theme, setTheme } = useTheme();
  return (
    <div className="space-y-5">
      <h2 className="text-lg font-heading font-bold">UI Preferences</h2>
      <SettingCard title="Appearance" description="Theme and visual settings">
        <SettingRow label="Theme" description="Switch between light and dark mode">
          <div className="flex gap-1 rounded-lg border border-border p-0.5">
            <button onClick={() => setTheme('light')} className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
              theme === 'light' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            )}>
              <Sun className="h-3.5 w-3.5" /> Light
            </button>
            <button onClick={() => setTheme('dark')} className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
              theme === 'dark' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            )}>
              <Moon className="h-3.5 w-3.5" /> Dark
            </button>
          </div>
        </SettingRow>
        <SettingRow label="Journal Font" description="Global mono typography across the entire workspace">
          <Select value={prefs.journalFont ?? 'notion'} onValueChange={v => update('journalFont', v)}>
            <SelectTrigger className="h-8 w-44 text-xs rounded-lg"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="notion"><span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>Notion Mono</span></SelectItem>
              <SelectItem value="jetbrains"><span style={{ fontFamily: '"JetBrains Mono", monospace' }}>JetBrains Mono</span></SelectItem>
              <SelectItem value="ibm"><span style={{ fontFamily: '"IBM Plex Mono", monospace' }}>IBM Plex Mono</span></SelectItem>
              <SelectItem value="space"><span style={{ fontFamily: '"Space Mono", monospace' }}>Space Mono</span></SelectItem>
              <SelectItem value="fira"><span style={{ fontFamily: '"Fira Code", monospace' }}>Fira Code</span></SelectItem>
              <SelectItem value="roboto"><span style={{ fontFamily: '"Roboto Mono", monospace' }}>Roboto Mono</span></SelectItem>
              <SelectItem value="source"><span style={{ fontFamily: '"Source Code Pro", monospace' }}>Source Code Pro</span></SelectItem>
              <SelectItem value="geist"><span style={{ fontFamily: '"Geist Mono", monospace' }}>Geist Mono</span></SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>
        <SettingRow label="Layout Density">
          <Select value={prefs.layoutDensity ?? 'comfortable'} onValueChange={v => update('layoutDensity', v)}>
            <SelectTrigger className="h-8 w-36 text-xs rounded-lg"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="compact">Compact</SelectItem>
              <SelectItem value="comfortable">Comfortable</SelectItem>
              <SelectItem value="spacious">Spacious</SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>
        <SettingRow label="Chart Theme" description="Color scheme for charts">
          <Select value={prefs.chartTheme ?? 'default'} onValueChange={v => update('chartTheme', v)}>
            <SelectTrigger className="h-8 w-36 text-xs rounded-lg"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Default</SelectItem>
              <SelectItem value="monochrome">Monochrome</SelectItem>
              <SelectItem value="vivid">Vivid</SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>
        <SettingRow label="Sidebar Collapsed" description="Start with sidebar collapsed">
          <Switch checked={prefs.sidebarCollapsed ?? false} onCheckedChange={v => update('sidebarCollapsed', v)} />
        </SettingRow>
      </SettingCard>
    </div>
  );
}

function NotificationsPanel({ prefs, update }: { prefs: any; update: (k: string, v: any) => void }) {
  return (
    <div className="space-y-5">
      <h2 className="text-lg font-heading font-bold">Notifications</h2>
      <SettingCard title="Alert Preferences" description="Control reminders and alerts">
        <SettingRow label="Daily Plan Reminder" description="Remind to fill daily plan each morning">
          <Switch checked={prefs.dailyPlanReminder ?? false} onCheckedChange={v => update('dailyPlanReminder', v)} />
        </SettingRow>
        <SettingRow label="Weekly Review Reminder" description="Remind to review at end of week">
          <Switch checked={prefs.weeklyReviewReminder ?? false} onCheckedChange={v => update('weeklyReviewReminder', v)} />
        </SettingRow>
        <SettingRow label="Trade Limit Warning" description="Alert when approaching max daily trades">
          <Switch checked={prefs.tradeLimitWarning ?? true} onCheckedChange={v => update('tradeLimitWarning', v)} />
        </SettingRow>
      </SettingCard>
    </div>
  );
}

function AccountPanel({ prefs, update }: { prefs: any; update: (k: string, v: any) => void }) {
  const { user, updatePassword } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }

    setSavingPassword(true);
    try {
      await updatePassword(newPassword);
      setNewPassword('');
      setConfirmPassword('');
      toast({
        title: 'Password updated',
        description: 'Your account password has been updated successfully.',
      });
    } catch (err: any) {
      setPasswordError(err?.message || 'Failed to update password.');
      toast({
        title: 'Update failed',
        description: err?.message || 'Could not update password',
        variant: 'destructive',
      });
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-heading font-bold">Account & Profile</h2>
      <SettingCard title="Profile" description="Your account information">
        <SettingRow label="Email Address" description="Associated with this trading account">
          <span className="text-xs font-mono text-muted-foreground">{user?.email || 'Guest / Local Session'}</span>
        </SettingRow>
        <SettingRow label="Display Name">
          <Input value={prefs.displayName ?? ''} onChange={e => update('displayName', e.target.value)} placeholder="Your name" className="h-8 w-48 text-xs rounded-lg" />
        </SettingRow>
        <SettingRow label="Trading Style">
          <Select value={prefs.tradingStyle ?? 'scalper'} onValueChange={v => update('tradingStyle', v)}>
            <SelectTrigger className="h-8 w-40 text-xs rounded-lg"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="scalper">Scalper</SelectItem>
              <SelectItem value="day">Day Trader</SelectItem>
              <SelectItem value="swing">Swing Trader</SelectItem>
              <SelectItem value="position">Position Trader</SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>
        <SettingRow label="Experience Level">
          <Select value={prefs.experienceLevel ?? 'intermediate'} onValueChange={v => update('experienceLevel', v)}>
            <SelectTrigger className="h-8 w-40 text-xs rounded-lg"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="beginner">Beginner</SelectItem>
              <SelectItem value="intermediate">Intermediate</SelectItem>
              <SelectItem value="advanced">Advanced</SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>
      </SettingCard>

      <SettingCard title="Security & Password" description="Create or change your account password">
        <form onSubmit={handleUpdatePassword} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">New Password</Label>
              <div className="relative">
                <Lock className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Min. 6 characters"
                  className="h-8 pl-8 pr-8 text-xs rounded-lg"
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    if (passwordError) setPasswordError(null);
                  }}
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Confirm Password</Label>
              <div className="relative">
                <Lock className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Repeat new password"
                  className="h-8 pl-8 text-xs rounded-lg"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (passwordError) setPasswordError(null);
                  }}
                  minLength={6}
                />
              </div>
            </div>
          </div>

          {passwordError && (
            <p className="text-xs text-destructive">{passwordError}</p>
          )}

          <div className="flex justify-end pt-1">
            <Button
              type="submit"
              size="sm"
              className="text-xs h-8 gap-1.5"
              disabled={savingPassword || !newPassword || !confirmPassword}
            >
              <KeyRound className="h-3.5 w-3.5" />
              {savingPassword ? 'Updating...' : 'Update Password'}
            </Button>
          </div>
        </form>
      </SettingCard>
    </div>
  );
}

function RiskManagementPanel({ prefs, update }: { prefs: any; update: (k: string, v: any) => void }) {
  return (
    <div className="space-y-5">
      <h2 className="text-lg font-heading font-bold">Risk Rules</h2>
      <SettingCard title="Trading Rules" description="Rules enforced during trade entry">
        <SettingRow label="Max Concurrent Trades" description="Maximum open positions at once">
          <Input type="number" value={prefs.maxConcurrentTrades ?? 2} onChange={e => update('maxConcurrentTrades', parseInt(e.target.value) || 1)} min="1" max="10" className="h-8 w-20 text-xs font-mono rounded-lg" />
        </SettingRow>
        <SettingRow label="Max Lot Size" description="Maximum lot size per trade">
          <Input type="number" value={prefs.maxLotSize ?? 1.0} onChange={e => update('maxLotSize', parseFloat(e.target.value) || 0)} step="0.1" className="h-8 w-20 text-xs font-mono rounded-lg" />
        </SettingRow>
        <SettingRow label="Enforce Daily Loss Limit" description="Block trade entry after daily loss limit hit">
          <Switch checked={prefs.enforceDailyLossLimit ?? false} onCheckedChange={v => update('enforceDailyLossLimit', v)} />
        </SettingRow>
        <SettingRow label="Enforce Trade Count Limit" description="Block trade entry after max trades reached">
          <Switch checked={prefs.enforceTradeCountLimit ?? true} onCheckedChange={v => update('enforceTradeCountLimit', v)} />
        </SettingRow>
      </SettingCard>
    </div>
  );
}

function DataPanel() {
  return (
    <div className="space-y-5">
      <h2 className="text-lg font-heading font-bold">Data Management</h2>
      <SettingCard title="Import & Export" description="Manage your trading data">
        <SettingRow label="Export Trades" description="Download all trades as CSV">
          <Button variant="outline" size="sm" className="text-xs">Export CSV</Button>
        </SettingRow>
        <SettingRow label="Export Plans" description="Download all plans as JSON">
          <Button variant="outline" size="sm" className="text-xs">Export JSON</Button>
        </SettingRow>
        <SettingRow label="Import Trades" description="Import trades from CSV file">
          <Button variant="outline" size="sm" className="text-xs">Import</Button>
        </SettingRow>
      </SettingCard>
      <SettingCard title="Reset" description="Danger zone — these actions cannot be undone">
        <SettingRow label="Clear All Trades" description="Permanently delete all trade records">
          <Button variant="destructive" size="sm" className="text-xs">Clear Trades</Button>
        </SettingRow>
        <SettingRow label="Reset All Settings" description="Restore all settings to defaults">
          <Button variant="destructive" size="sm" className="text-xs">Reset</Button>
        </SettingRow>
      </SettingCard>
    </div>
  );
}

const tabs = [
  { id: 'modules', label: 'Modules', icon: Sliders },
  { id: 'trading', label: 'Trading', icon: Target },
  { id: 'journal', label: 'Journal', icon: BarChart3 },
  { id: 'risk', label: 'Risk Rules', icon: Shield },
  { id: 'ai', label: 'AI', icon: Brain },
  { id: 'market', label: 'Market', icon: Globe },
  { id: 'ui', label: 'Appearance', icon: Palette },
  { id: 'notifications', label: 'Alerts', icon: Bell },
  { id: 'account', label: 'Profile', icon: User },
  { id: 'data', label: 'Data', icon: Database },
  
] as const;

export default function Settings() {
  const [activeTab, setActiveTab] = useState('modules');
  const { prefs, updatePref, loaded } = useUserPreferences();

  const update = (key: string, value: any) => updatePref(key as any, value);

  const renderPanel = () => {
    switch (activeTab) {
      case 'modules': return <WorkspaceModulesPanel />;
      case 'trading': return <TradingPreferencesPanel prefs={prefs} update={update} />;
      case 'journal': return <JournalBehaviorPanel prefs={prefs} update={update} />;
      case 'risk': return <RiskManagementPanel prefs={prefs} update={update} />;
      case 'ai': return <AISettingsPanel prefs={prefs} update={update} />;
      case 'market': return <MarketSettingsPanel prefs={prefs} update={update} />;
      case 'ui': return <UIPreferencesPanel prefs={prefs} update={update} />;
      case 'notifications': return <NotificationsPanel prefs={prefs} update={update} />;
      case 'account': return <AccountPanel prefs={prefs} update={update} />;
      case 'data': return <DataPanel />;
      
      default: return <WorkspaceModulesPanel />;
    }
  };

  return (
    <div className="px-3 sm:px-4 py-3 w-full">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <SettingsIcon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-heading font-bold">Settings</h1>
          <p className="text-xs text-muted-foreground">Customize your trading workspace</p>
        </div>
      </div>

      <div className="mb-6 overflow-x-auto">
        <div className="flex gap-1 p-1 bg-muted/30 rounded-xl border border-border/50 min-w-max">
          {tabs.map(tab => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap",
                  active
                    ? "bg-card text-foreground shadow-sm border border-border/50"
                    : "text-muted-foreground hover:text-foreground hover:bg-card/50"
                )}
              >
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-h-[400px]">
        {!loaded ? (
          <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">Loading settings...</div>
        ) : renderPanel()}
      </div>
    </div>
  );
}
