import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { AuthProvider, useAuth } from './context/AuthContext';

import LandingPage from './components/LandingPage';
import LoginPage from './components/LoginPage';
import Layout from './components/Layout';
import Documentation from './components/Documentation';

// Pages to be created in subsequent phases
import FleetDashboard from './components/FleetDashboard';
import DeviceRealtime from './components/DeviceRealtime';
import DeviceHistory from './components/DeviceHistory';
import AlertsPage from './components/AlertsPage';
import CellAnalysis from './components/CellAnalysis';
import LocationTracker from './components/LocationTracker';
import UserManagement from './components/UserManagement';
import DeviceManagement from './components/DeviceManagement';
import DataIngestion from './components/DataIngestion';
// import DeviceManagement from './pages/DeviceManagement';
// import AlertsPage from './pages/AlertsPage';
// import DeviceRealtime from './pages/DeviceRealtime';
// import DeviceHistory from './pages/DeviceHistory';
// import CellAnalysis from './components/CellAnalysis';
// import DeviceLocation from './pages/DeviceLocation';
// import DataIngestion from './components/DataIngestion';

// Existing pages
import DegradationAnalysis from './components/DegradationAnalysis';
import DataQuality from './components/DataQuality';
import ThermalAnalysis from './components/ThermalAnalysis';
import ReportGenerator from './components/ReportGenerator';
import AutomatedFindings from './components/AutomatedFindings';
import DeviceAnalyticsRoute from './components/DeviceAnalyticsRoute';

import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function RequireAuth({ children, adminOnly = false }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">Loading...</div>;
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  if (adminOnly && user.role !== 'admin') {
    // Redirect non-admin to their first assigned device if they try to access admin routes
    if (user.device_ids && user.device_ids.length > 0) {
      return <Navigate to={`/app/devices/${user.device_ids[0]}/realtime`} replace />;
    }
    // Fallback if they have no devices
    return <div className="p-8 text-white">Unauthorized: Admin access required</div>;
  }
  
  return children;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/docs" element={<Documentation />} />
            
            <Route path="/app" element={
              <RequireAuth>
                <Layout />
              </RequireAuth>
            }>
              {/* Admin only routes */}
              <Route path="fleet" element={
                <RequireAuth adminOnly>
                  <FleetDashboard />
                </RequireAuth>
              } />
              <Route path="fleet/users" element={<RequireAuth adminOnly><UserManagement /></RequireAuth>} />
              <Route path="fleet/devices" element={<RequireAuth adminOnly><DeviceManagement /></RequireAuth>} />
              <Route path="fleet/alerts" element={<RequireAuth adminOnly><AlertsPage /></RequireAuth>} />
              
              {/* Device scoped routes */}
              <Route path="devices/:id/realtime" element={<DeviceRealtime />} />
              <Route path="devices/:id/history" element={<DeviceHistory />} />
              <Route path="devices/:id/cells" element={<CellAnalysis />} />
              <Route path="devices/:id/location" element={<LocationTracker />} />
              <Route path="devices/:id/degradation" element={<DeviceAnalyticsRoute component={DegradationAnalysis} propName="data" />} />
              <Route path="devices/:id/quality" element={<DeviceAnalyticsRoute component={DataQuality} propName="analyticsData" />} />
              <Route path="devices/:id/thermal" element={<DeviceAnalyticsRoute component={ThermalAnalysis} propName="data" />} />
              <Route path="devices/:id/findings" element={<DeviceAnalyticsRoute component={AutomatedFindings} propName="data" />} />
              <Route path="devices/:id/alerts" element={<AlertsPage />} />
              <Route path="devices/:id/upload" element={<DataIngestion />} />
              <Route path="devices/:id/reports" element={<DeviceAnalyticsRoute component={ReportGenerator} propName="data" />} />
              
              {/* Default redirect inside app shell */}
              <Route index element={<Navigate to="fleet" replace />} />
            </Route>
            
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </AuthProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}

export default App;
