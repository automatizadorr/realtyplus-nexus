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
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import Scanner from "./pages/Scanner";
import Campaigns from "./pages/Campaigns";
import Inbox from "./pages/Inbox";
import Automation from "./pages/Automation";
import AutomationInbox from "./pages/AutomationInbox";
import TaggedMessages from "./pages/TaggedMessages";
import TaggedExport from "./pages/TaggedExport";
import Settings from "./pages/Settings";
import VoiceCrm from "./pages/VoiceCrm";
import Etiquetas from "./pages/Etiquetas";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";

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
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <Layout>
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
                  </Layout>
                </ProtectedRoute>
              }
            />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

