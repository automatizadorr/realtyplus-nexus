import { lazy, Suspense, Component, type ReactNode, type ErrorInfo } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminRoute } from "@/components/AdminRoute";
import { OportunidadesRoute } from "@/components/OportunidadesRoute";
import { VendedorRoute } from "@/components/VendedorRoute";
import { InstallPrompt } from "@/components/InstallPrompt";
import { EcosystemAgentsFab } from "@/components/global/EcosystemAgentsFab";

// Layout (shell del CRM: sidebar + header) solo se usa tras login → lazy, para
// no arrastrar AppSidebar (framer-motion + radix-sidebar) al bundle de la landing.
const Layout       = lazy(() => import("@/components/Layout").then((m) => ({ default: m.Layout })));
const Index        = lazy(() => import("./pages/Index"));
const Blog         = lazy(() => import("./pages/public/Blog"));
const BlogArticle  = lazy(() => import("./pages/public/BlogArticle"));
const Dashboard    = lazy(() => import("./pages/Dashboard"));
const Scanner      = lazy(() => import("./pages/Scanner"));
const Campaigns    = lazy(() => import("./pages/Campaigns"));
const CorreosPersonalizados = lazy(() => import("./pages/CorreosPersonalizados"));
const SeguimientoCorreos = lazy(() => import("./pages/SeguimientoCorreos"));
const BuscarLeads  = lazy(() => import("./pages/BuscarLeads"));
const Plantillas   = lazy(() => import("./pages/Plantillas"));
const AdminVendedores = lazy(() => import("./pages/AdminVendedores"));
const MisLeads     = lazy(() => import("./pages/MisLeads"));
const Inbox        = lazy(() => import("./pages/Inbox"));
const Automation   = lazy(() => import("./pages/Automation"));
const AutomationInbox = lazy(() => import("./pages/AutomationInbox"));
const TaggedMessages  = lazy(() => import("./pages/TaggedMessages"));
const TaggedExport    = lazy(() => import("./pages/TaggedExport"));
const Settings     = lazy(() => import("./pages/Settings"));
const VoiceCrm     = lazy(() => import("./pages/VoiceCrm"));
const AnalizarContrato = lazy(() => import("./pages/AnalizarContrato"));
const Etiquetas    = lazy(() => import("./pages/Etiquetas"));
const Auth         = lazy(() => import("./pages/Auth"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const NotFound     = lazy(() => import("./pages/NotFound"));

// Captura errores de carga de chunks (lazy) y errores de render.
// Sin esto, un chunk que no carga → React desmonta todo → pantalla blanca.
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info);
  }

  render() {
    if (this.state.error) {
      const msg = this.state.error.message ?? "";
      const isChunk = msg.includes("Loading chunk") || msg.includes("Failed to fetch") || msg.includes("dynamically imported");
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
          <div className="text-center max-w-sm">
            <p className="text-base font-semibold text-slate-800 mb-2">
              {isChunk ? "Nueva versión disponible" : "Algo salió mal"}
            </p>
            <p className="text-sm text-slate-500 mb-6">
              {isChunk
                ? "Se desplegó una actualización. Recarga para continuar."
                : "Ocurrió un error inesperado en la aplicación."}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white bg-[#003DA5] hover:opacity-90 transition-opacity"
            >
              Recargar página
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

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
          <EcosystemAgentsFab />
          <ErrorBoundary>
          <Suspense fallback={<PageSpinner />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/blog" element={<Blog />} />
              <Route path="/blog/:slug" element={<BlogArticle />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route
                path="/*"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <ErrorBoundary>
                      <Suspense fallback={<PageSpinner />}>
                        <Routes>
                          <Route path="/dashboard" element={<Dashboard />} />
                          <Route path="/scanner" element={<AdminRoute><Scanner /></AdminRoute>} />
                          <Route path="/campaigns" element={<AdminRoute><Campaigns /></AdminRoute>} />
                          <Route path="/buscar-leads" element={<AdminRoute><BuscarLeads /></AdminRoute>} />
                          <Route path="/plantillas" element={<AdminRoute><Plantillas /></AdminRoute>} />
                          <Route path="/vendedores" element={<AdminRoute><AdminVendedores /></AdminRoute>} />
                          <Route path="/mis-leads" element={<Navigate to="/mis-leads/hoy" replace />} />
                          <Route path="/mis-leads/:tab" element={<VendedorRoute><MisLeads /></VendedorRoute>} />
                          <Route path="/correos-personalizados" element={<OportunidadesRoute><CorreosPersonalizados /></OportunidadesRoute>} />
                          <Route path="/seguimiento-correos" element={<AdminRoute><SeguimientoCorreos /></AdminRoute>} />
                          <Route path="/inbox" element={<AdminRoute><Inbox /></AdminRoute>} />
                          <Route path="/automation" element={<AdminRoute><Automation /></AdminRoute>} />
                          <Route path="/automation-inbox" element={<OportunidadesRoute><AutomationInbox /></OportunidadesRoute>} />
                          <Route path="/tagged" element={<AdminRoute><TaggedMessages /></AdminRoute>} />
                          <Route path="/tagged/export" element={<AdminRoute><TaggedExport /></AdminRoute>} />
                          <Route path="/etiquetas" element={<AdminRoute><Etiquetas /></AdminRoute>} />
                          <Route path="/voice-crm" element={<AdminRoute><VoiceCrm /></AdminRoute>} />
                          <Route path="/analizar-contrato" element={<AdminRoute><AnalizarContrato /></AdminRoute>} />
                          <Route path="/settings" element={<Settings />} />
                          <Route path="*" element={<NotFound />} />
                        </Routes>
                      </Suspense>
                      </ErrorBoundary>
                    </Layout>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </Suspense>
          </ErrorBoundary>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

