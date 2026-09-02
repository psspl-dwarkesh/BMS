import { useState, useEffect } from 'react';
import LandingPage from './components/LandingPage';
import LoginPage from './components/LoginPage';
import Layout from './components/Layout';
import Documentation from './components/Documentation';
import './index.css';

function App() {
  // Utility to decode JWT token payload safely
  const decodeJWT = (token) => {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
      return JSON.parse(jsonPayload);
    } catch (e) {
      return null;
    }
  };

  const [appState, setAppState] = useState(() => {
    return localStorage.getItem('bms_jwt') ? 'portal' : 'landing';
  });
  
  const [analyticsData, setAnalyticsData] = useState(null);
  
  const [user, setUser] = useState(() => {
    const token = localStorage.getItem('bms_jwt');
    if (token) {
      const decoded = decodeJWT(token);
      if (decoded && decoded.exp > Date.now() / 1000) return decoded;
    }
    return null;
  });

  // Load sample data if user was already logged in (new tab / refresh)
  useEffect(() => {
    if (user && !analyticsData) {
      loadSampleData();
    }
  }, [user, analyticsData]);

  const loadSampleData = async () => {
    try {
      const response = await fetch('/sample_bms_data.csv');
      const text = await response.text();
      const file = new File([text], 'sample_bms_data.csv', { type: 'text/csv' });
      const { parseCSV } = await import('./utils/csvParser');
      const data = await parseCSV(file);
      setAnalyticsData(data);
    } catch (err) {
      console.error('Failed to auto-load sample data', err);
    }
  };

  const handleEnterPortal = () => {
    setAppState('login');
  };

  const handleLogin = async (token) => {
    const decoded = decodeJWT(token);
    if (decoded) {
      setUser(decoded);
      localStorage.setItem('bms_jwt', token);
      await loadSampleData();
      setAppState('portal');
    }
  };

  const handleDataProcessed = async (data, append = false) => {
    if (append && analyticsData?.datasets) {
      const { reprocessDatasets } = await import('./utils/csvParser');
      const combinedDatasets = [...analyticsData.datasets, ...(data.datasets || [])];
      const combinedData = reprocessDatasets(combinedDatasets);
      setAnalyticsData(combinedData);
    } else {
      setAnalyticsData(data);
    }
  };

  const handleUpdateDatasets = async (newDatasets) => {
    const { reprocessDatasets } = await import('./utils/csvParser');
    const recalculated = reprocessDatasets(newDatasets);
    if (recalculated) {
      setAnalyticsData(recalculated);
    } else {
      setAnalyticsData({ ...analyticsData, status: 'No Data', anomalies: [], timeSeries: [], datasetNames: [], datasets: newDatasets });
    }
  };

  const handleBackToLanding = () => {
    setAppState('landing');
    setUser(null);
    localStorage.removeItem('bms_jwt');
  };

  if (appState === 'landing') {
    return <LandingPage onEnter={handleEnterPortal} onDocs={() => setAppState('docs')} />;
  }

  if (appState === 'login') {
    return <LoginPage onLogin={handleLogin} onBack={handleBackToLanding} />;
  }

  if (appState === 'docs') {
    return <Documentation onBack={handleBackToLanding} />;
  }

  return (
    <Layout
      user={user}
      analyticsData={analyticsData}
      onDataProcessed={handleDataProcessed}
      onUpdateDatasets={handleUpdateDatasets}
      onBackToLanding={handleBackToLanding}
    />
  );
}

export default App;
