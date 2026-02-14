import React from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import { AuthProvider, useAuth } from "./auth";
import { ErrorBoundary } from "./ErrorBoundary";
import { AppShell } from "./Shell";
import { FiltersProvider } from "./filters";
import { ChatAssistant } from "../components/ChatAssistant";
import { LoginPage } from "../pages/LoginPage";
import { LandingPage } from "../pages/LandingPage";
import { DashboardPage } from "../pages/DashboardPage";
import { WellsListPage } from "../pages/WellsListPage";
import { WellDetailPage } from "../pages/WellDetailPage";
import { ForecastRunPage } from "../pages/ForecastRunPage";
import { ForecastResultsPage } from "../pages/ForecastResultsPage";
import { ForecastsListPage } from "../pages/ForecastsListPage";
import { NotificationsPage } from "../pages/NotificationsPage";
import { ReportsListPage } from "../pages/ReportsListPage";
import { ReportWizardPage } from "../pages/ReportWizardPage";
import { ProfileSettingsPage } from "../pages/ProfileSettingsPage";
import { DatasetsListPage } from "../pages/DatasetsListPage";
import { DatasetDetailPage } from "../pages/DatasetDetailPage";
import { ScenarioListPage } from "../pages/ScenarioListPage";
import { ScenarioCreatePage } from "../pages/ScenarioCreatePage";
import { ScenarioResultsPage } from "../pages/ScenarioResultsPage";
import { ModelsListPage } from "../pages/ModelsListPage";
import { ModelTrainPage } from "../pages/ModelTrainPage";
import { ModelDetailPage } from "../pages/ModelDetailPage";
import { AlertsListPage } from "../pages/AlertsListPage";
import { AlertEditorPage } from "../pages/AlertEditorPage";
import { AlertHistoryPage } from "../pages/AlertHistoryPage";
import { UsersListPage } from "../pages/UsersListPage";
import { UserEditorPage } from "../pages/UserEditorPage";
import { OrgSettingsPage } from "../pages/OrgSettingsPage";
import { AuditLogsPage } from "../pages/AuditLogsPage";
import { OrgsPage } from "../pages/OrgsPage";
import { AccessDeniedPage } from "../pages/AccessDeniedPage";
import { NotFoundPage } from "../pages/NotFoundPage";

const qc = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false }
  }
});

function RequireAuth({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  if (!auth.ready) return null;
  if (!auth.user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireMinRole({ min, children }: { min: Parameters<ReturnType<typeof useAuth>["hasMinRole"]>[0]; children: React.ReactNode }) {
  const auth = useAuth();
  if (!auth.ready) return null;
  if (!auth.user) return <Navigate to="/login" replace />;
  if (!auth.hasMinRole(min as any)) return <AccessDeniedPage />;
  return <>{children}</>;
}

export function App() {
  return (
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <ErrorBoundary>
          <FiltersProvider>
            <BrowserRouter>
              <Routes>
                <Route index element={<LandingPage />} />
                <Route path="login" element={<LoginPage />} />

                <Route
                  element={
                    <RequireAuth>
                      <AppShell />
                    </RequireAuth>
                  }
                >
                  <Route path="dashboard" element={<DashboardPage />} />
                  <Route path="wells" element={<WellsListPage />} />
                  <Route path="wells/:id" element={<WellDetailPage />} />

                  <Route path="forecasts" element={<ForecastsListPage />} />
                  <Route path="forecasts/run" element={<ForecastRunPage />} />
                  <Route path="forecasts/:id" element={<ForecastResultsPage />} />

                  <Route path="notifications" element={<NotificationsPage />} />
                  <Route path="reports" element={<ReportsListPage />} />
                  <Route path="reports/new" element={<ReportWizardPage />} />
                  <Route path="settings/profile" element={<ProfileSettingsPage />} />

                  <Route
                    path="datasets"
                    element={
                      <RequireMinRole min={"analyst" as any}>
                        <DatasetsListPage />
                      </RequireMinRole>
                    }
                  />
                  <Route
                    path="datasets/:id"
                    element={
                      <RequireMinRole min={"analyst" as any}>
                        <DatasetDetailPage />
                      </RequireMinRole>
                    }
                  />

                  <Route
                    path="scenarios"
                    element={
                      <RequireMinRole min={"analyst" as any}>
                        <ScenarioListPage />
                      </RequireMinRole>
                    }
                  />
                  <Route
                    path="scenarios/new"
                    element={
                      <RequireMinRole min={"analyst" as any}>
                        <ScenarioCreatePage />
                      </RequireMinRole>
                    }
                  />
                  <Route
                    path="scenarios/:id"
                    element={
                      <RequireMinRole min={"analyst" as any}>
                        <ScenarioResultsPage />
                      </RequireMinRole>
                    }
                  />

                  <Route
                    path="models"
                    element={
                      <RequireMinRole min={"analyst" as any}>
                        <ModelsListPage />
                      </RequireMinRole>
                    }
                  />
                  <Route
                    path="models/train"
                    element={
                      <RequireMinRole min={"analyst" as any}>
                        <ModelTrainPage />
                      </RequireMinRole>
                    }
                  />
                  <Route
                    path="models/:id"
                    element={
                      <RequireMinRole min={"analyst" as any}>
                        <ModelDetailPage />
                      </RequireMinRole>
                    }
                  />

                  <Route
                    path="alerts"
                    element={
                      <RequireMinRole min={"analyst" as any}>
                        <AlertsListPage />
                      </RequireMinRole>
                    }
                  />
                  <Route
                    path="alerts/new"
                    element={
                      <RequireMinRole min={"analyst" as any}>
                        <AlertEditorPage />
                      </RequireMinRole>
                    }
                  />
                  <Route
                    path="alerts/:id"
                    element={
                      <RequireMinRole min={"analyst" as any}>
                        <AlertEditorPage />
                      </RequireMinRole>
                    }
                  />
                  <Route
                    path="alerts/:id/history"
                    element={
                      <RequireMinRole min={"analyst" as any}>
                        <AlertHistoryPage />
                      </RequireMinRole>
                    }
                  />

                  <Route
                    path="users"
                    element={
                      <RequireMinRole min={"org_admin" as any}>
                        <UsersListPage />
                      </RequireMinRole>
                    }
                  />
                  <Route
                    path="users/new"
                    element={
                      <RequireMinRole min={"org_admin" as any}>
                        <UserEditorPage />
                      </RequireMinRole>
                    }
                  />
                  <Route
                    path="users/:id"
                    element={
                      <RequireMinRole min={"org_admin" as any}>
                        <UserEditorPage />
                      </RequireMinRole>
                    }
                  />

                  <Route
                    path="settings/org"
                    element={
                      <RequireMinRole min={"org_admin" as any}>
                        <OrgSettingsPage />
                      </RequireMinRole>
                    }
                  />
                  <Route
                    path="audit-logs"
                    element={
                      <RequireMinRole min={"org_admin" as any}>
                        <AuditLogsPage />
                      </RequireMinRole>
                    }
                  />

                  <Route
                    path="orgs"
                    element={
                      <RequireMinRole min={"super_admin" as any}>
                        <OrgsPage />
                      </RequireMinRole>
                    }
                  />

                  <Route path="*" element={<NotFoundPage />} />
                </Route>
              </Routes>
            </BrowserRouter>
            <ChatAssistant />
          </FiltersProvider>
        </ErrorBoundary>
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: "rgb(var(--card))",
              color: "rgb(var(--text))",
              border: "1px solid rgb(var(--border))"
            }
          }}
        />
      </AuthProvider>
    </QueryClientProvider>
  );
}
