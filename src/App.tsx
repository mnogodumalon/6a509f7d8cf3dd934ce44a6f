import '@/lib/sentry';
import { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { ActionsProvider } from '@/context/ActionsContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ErrorBusProvider } from '@/components/ErrorBus';
import { Layout } from '@/components/Layout';
import DashboardOverview from '@/pages/DashboardOverview';
import AdminPage from '@/pages/AdminPage';
import ObjektverwaltungPage from '@/pages/ObjektverwaltungPage';
import ObjektverwaltungDetailPage from '@/pages/ObjektverwaltungDetailPage';
import MaengelverwaltungPage from '@/pages/MaengelverwaltungPage';
import MaengelverwaltungDetailPage from '@/pages/MaengelverwaltungDetailPage';
import PublicFormObjektverwaltung from '@/pages/public/PublicForm_Objektverwaltung';
import PublicFormMaengelverwaltung from '@/pages/public/PublicForm_Maengelverwaltung';
// <public:imports>
// </public:imports>
// <custom:imports>
// </custom:imports>

export default function App() {
  return (
    <ErrorBoundary>
      <ErrorBusProvider>
        <HashRouter>
          <ActionsProvider>
            <Routes>
              <Route path="public/6a509f6c054779eb935038b7" element={<PublicFormObjektverwaltung />} />
              <Route path="public/6a509f6e847d39d638f5f86a" element={<PublicFormMaengelverwaltung />} />
              {/* <public:routes> */}
              {/* </public:routes> */}
              <Route element={<Layout />}>
                <Route index element={<DashboardOverview />} />
                <Route path="objektverwaltung" element={<ObjektverwaltungPage />} />
                <Route path="objektverwaltung/:id" element={<ObjektverwaltungDetailPage />} />
                <Route path="maengelverwaltung" element={<MaengelverwaltungPage />} />
                <Route path="maengelverwaltung/:id" element={<MaengelverwaltungDetailPage />} />
                <Route path="admin" element={<AdminPage />} />
                {/* <custom:routes> */}
                {/* </custom:routes> */}
              </Route>
            </Routes>
          </ActionsProvider>
        </HashRouter>
      </ErrorBusProvider>
    </ErrorBoundary>
  );
}
