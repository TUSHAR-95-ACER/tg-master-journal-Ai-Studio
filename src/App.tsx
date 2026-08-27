import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { lazy, Suspense } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PageVisibilityProvider } from "@/contexts/PageVisibilityContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import Login from "./pages/Login";
import OAuthConsent from "./pages/OAuthConsent";
import ResetPassword from "./pages/ResetPassword";
import { PostLoginRedirect } from "@/components/auth/PostLoginRedirect";
import { PasswordRecoveryModal } from "@/components/auth/PasswordRecoveryModal";


// PERFORMANCE: Route-level code splitting. Each page only downloads when navigated to,
// shrinking the initial bundle from ~all-pages to just shell + Login + Dashboard route.
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Trades = lazy(() => import("./pages/Trades"));
const Accounts = lazy(() => import("./pages/Accounts"));
const Analytics = lazy(() => import("./pages/Analytics"));
const Psychology = lazy(() => import("./pages/Psychology"));
const Mistakes = lazy(() => import("./pages/Mistakes"));
const WeeklyPlan = lazy(() => import("./pages/WeeklyPlan"));
const DailyPlan = lazy(() => import("./pages/DailyPlan"));
const Notebook = lazy(() => import("./pages/Notebook"));
const WeeklyReview = lazy(() => import("./pages/WeeklyReview"));
const SetupPlaybook = lazy(() => import("./pages/SetupPlaybook"));
const BehaviorPatterns = lazy(() => import("./pages/BehaviorPatterns"));
const TradeQuality = lazy(() => import("./pages/TradeQuality"));
const AIInsights = lazy(() => import("./pages/AIInsights"));

const TradingRules = lazy(() => import("./pages/TradingRules"));
const BiasAnalytics = lazy(() => import("./pages/BiasAnalytics"));
const ControlCenter = lazy(() => import("./pages/ControlCenter"));
const ResearchLab = lazy(() => import("./pages/ResearchLab"));
const ResearchStrategy = lazy(() => import("./pages/ResearchStrategy"));
const ResearchTest = lazy(() => import("./pages/ResearchTest"));
const ResearchAnalytics = lazy(() => import("./pages/ResearchAnalytics"));

const CalendarPage = lazy(() => import("./pages/CalendarPage"));
const Settings = lazy(() => import("./pages/Settings"));
const NotFound = lazy(() => import("./pages/NotFound"));
const SystemAnalytics = lazy(() => import("./pages/SystemAnalytics"));
const MacroIntelligence = lazy(() => import("./pages/MacroIntelligence"));
const TradingChecklist = lazy(() => import("./pages/TradingChecklist"));
const ChatGPTAssistant = lazy(() => import("./pages/ChatGPTAssistant"));


import { RealtimeSyncProvider } from "@/contexts/RealtimeSyncContext";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const RouteFallback = () => (
  <div className="flex items-center justify-center h-full p-12">
    <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <PageVisibilityProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <RealtimeSyncProvider>
          <PostLoginRedirect />
          <PasswordRecoveryModal />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/" element={<Suspense fallback={<RouteFallback />}><Dashboard /></Suspense>} />
              <Route path="/trades" element={<Suspense fallback={<RouteFallback />}><Trades /></Suspense>} />
              <Route path="/accounts" element={<Suspense fallback={<RouteFallback />}><Accounts /></Suspense>} />
              <Route path="/analytics" element={<Suspense fallback={<RouteFallback />}><Analytics /></Suspense>} />
              <Route path="/psychology" element={<Suspense fallback={<RouteFallback />}><Psychology /></Suspense>} />
              <Route path="/mistakes" element={<Suspense fallback={<RouteFallback />}><Mistakes /></Suspense>} />
              <Route path="/weekly-plan" element={<Suspense fallback={<RouteFallback />}><WeeklyPlan /></Suspense>} />
              <Route path="/daily-plan" element={<Suspense fallback={<RouteFallback />}><DailyPlan /></Suspense>} />
              <Route path="/notebook" element={<Suspense fallback={<RouteFallback />}><Notebook /></Suspense>} />
              <Route path="/weekly-review" element={<Suspense fallback={<RouteFallback />}><WeeklyReview /></Suspense>} />
              <Route path="/setup-playbook" element={<Suspense fallback={<RouteFallback />}><SetupPlaybook /></Suspense>} />
              <Route path="/behavior-patterns" element={<Suspense fallback={<RouteFallback />}><BehaviorPatterns /></Suspense>} />
              <Route path="/trade-quality" element={<Suspense fallback={<RouteFallback />}><TradeQuality /></Suspense>} />
              <Route path="/ai-insights" element={<Suspense fallback={<RouteFallback />}><AIInsights /></Suspense>} />
              <Route path="/trading-rules" element={<Suspense fallback={<RouteFallback />}><TradingRules /></Suspense>} />
              <Route path="/bias-analytics" element={<Suspense fallback={<RouteFallback />}><BiasAnalytics /></Suspense>} />
              <Route path="/control-center" element={<Suspense fallback={<RouteFallback />}><ControlCenter /></Suspense>} />
              <Route path="/research-lab" element={<Suspense fallback={<RouteFallback />}><ResearchLab /></Suspense>} />
              <Route path="/research-lab/analytics" element={<Suspense fallback={<RouteFallback />}><ResearchAnalytics /></Suspense>} />
              <Route path="/research-lab/:strategyId" element={<Suspense fallback={<RouteFallback />}><ResearchStrategy /></Suspense>} />
              <Route path="/research-lab/:strategyId/test/:testId" element={<Suspense fallback={<RouteFallback />}><ResearchTest /></Suspense>} />
              <Route path="/trading-checklist" element={<Suspense fallback={<RouteFallback />}><TradingChecklist /></Suspense>} />
              <Route path="/chat" element={<Suspense fallback={<RouteFallback />}><ChatGPTAssistant /></Suspense>} />
              <Route path="/chat/:threadId" element={<Suspense fallback={<RouteFallback />}><ChatGPTAssistant /></Suspense>} />
              <Route path="/daily-checklist" element={<Navigate to="/trading-checklist" replace />} />
              <Route path="/backtesting-lab" element={<Navigate to="/" replace />} />
              <Route path="/ai-coach" element={<Navigate to="/" replace />} />
              <Route path="/calendar" element={<Suspense fallback={<RouteFallback />}><CalendarPage /></Suspense>} />
              <Route path="/settings" element={<Suspense fallback={<RouteFallback />}><Settings /></Suspense>} />
              <Route path="/system-analytics" element={<Suspense fallback={<RouteFallback />}><SystemAnalytics /></Suspense>} />
              <Route path="/macro-news" element={<Navigate to="/" replace />} />
              <Route path="/macro-intelligence" element={<Suspense fallback={<RouteFallback />}><MacroIntelligence /></Suspense>} />
              <Route path="/ai-workspace" element={<Navigate to="/" replace />} />
            </Route>
            <Route path="*" element={<Suspense fallback={<RouteFallback />}><NotFound /></Suspense>} />
          </Routes>
          </RealtimeSyncProvider>
        </BrowserRouter>
      </TooltipProvider>
    </PageVisibilityProvider>
  </QueryClientProvider>
);

export default App;
