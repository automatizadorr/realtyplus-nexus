import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminRoute } from "@/components/AdminRoute";
import { Layout } from "@/components/Layout";
import { InstallPrompt } from "@/components/InstallPrompt";

const Index        = lazy(() => import("./pages/Index"));
const Dashboard    = lazy(() => import("./pages/Dashboard"));
const Scanner      = lazy(() => import("./pages/Scanner"));
const Campaigns    = lazy(() => import("./pages/Campaigns"));
const Inbox        = lazy(() => import("./pages/Inbox"));
const Automation   = lazy(() => import("./pages/Automation"));
const AutomationInbox = lazy(() => import("./pages/AutomationInbox"));
const TaggedMessages  = lazy(() => import("./pages/TaggedMessages"));
const TaggedExport    = lazy(() => import("./pages/TaggedExport"));
const Settings     = lazy(() => import("./pages/Settings"));
const VoiceCrm     = lazy(() => import("./pages/VoiceCrm"));
const Etiquetas    = lazy(() => import("./pages/Etiquetas"));
const Auth         = lazy(() => import("./pages/Auth"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const NotFound     = lazy(() => import("./pages/NotFound"));

function PageSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-3">
        <div className="w-7 h-7 rounded-full border-2 border-[#003DA5]/20 border-t-[#003DA5] animate-spin" />
        <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-400">Cargando</p>
      </div>
    </div>
  );
}

// refetchOnWindowFocus desactivado: evita que React Query refetchee (y muestre estados
// de carga) cada vez que vuelves a la pestaña, lo que causaba parpadeos/recargas.
const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false } },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <InstallPrompt />
          <Suspense fallback={<PageSpinner />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route
                path="/*"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <Suspense fallback={<PageSpinner />}>
                        <Routes>
                          <Route path="/dashboard" element={<Dashboard />} />
                          <Route path="/scanner" element={<AdminRoute><Scanner /></AdminRoute>} />
                          <Route path="/campaigns" element={<AdminRoute><Campaigns /></AdminRoute>} />
                          <Route path="/inbox" element={<AdminRoute><Inbox /></AdminRoute>} />
                          <Route path="/automation" element={<AdminRoute><Automation /></AdminRoute>} />
                          <Route path="/automation-inbox" element={<AdminRoute><AutomationInbox /></AdminRoute>} />
                          <Route path="/tagged" element={<AdminRoute><TaggedMessages /></AdminRoute>} />
                          <Route path="/tagged/export" element={<AdminRoute><TaggedExport /></AdminRoute>} />
                          <Route path="/etiquetas" element={<AdminRoute><Etiquetas /></AdminRoute>} />
                          <Route path="/voice-crm" element={<AdminRoute><VoiceCrm /></AdminRoute>} />
                          <Route path="/settings" element={<Settings />} />
                          <Route path="*" element={<NotFound />} />
                        </Routes>
                      </Suspense>
                    </Layout>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

