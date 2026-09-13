import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import AdminNav from './components/AdminNav';
import OverviewDashboard from './components/OverviewDashboard';
import UsersManagement from './components/UsersManagement';
import TransactionsReport from './components/TransactionsReport';
import ConfigManagement from './components/ConfigManagement';
import GiftCatalog from './components/GiftCatalog';
import Operations from './components/Operations';
import WalletDashboard from './components/WalletDashboard';
import LoginPage from './components/LoginPage';
import { AdminAuthContext } from './context/AdminAuthContext';
import './AdminApp.css';

function AdminApp() {
  const [adminUser, setAdminUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const restoreSession = () => {
      const savedAdmin = localStorage.getItem('adminSession');
      if (savedAdmin) {
        const user = JSON.parse(savedAdmin);
        if (user.role === 'admin') {
          setAdminUser(user);
        } else {
          localStorage.removeItem('adminSession');
          navigate('/login');
        }
      }
      setLoading(false);
    };

    restoreSession();
  }, [navigate]);

  const handleAdminLogin = (user) => {
    if (user.role !== 'admin') {
      alert('This account does not have admin access');
      return;
    }
    setAdminUser(user);
    localStorage.setItem('adminSession', JSON.stringify(user));
    navigate('/');
  };

  const handleAdminLogout = () => {
    setAdminUser(null);
    localStorage.removeItem('adminSession');
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-navy via-softPurple to-coral flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <AdminAuthContext.Provider value={{ adminUser, setAdminUser }}>
      {!adminUser ? (
        <Routes>
          <Route path="/login" element={<LoginPage onLogin={handleAdminLogin} />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      ) : (
        <div className="flex h-screen bg-cream-50">
          <AdminNav adminUser={adminUser} onLogout={handleAdminLogout} />
          <main className="flex-1 overflow-auto">
            <Routes>
              <Route path="/" element={<OverviewDashboard adminUserId={adminUser.id} />} />
              <Route path="/users" element={<UsersManagement adminUserId={adminUser.id} />} />
              <Route path="/transactions" element={<TransactionsReport adminUserId={adminUser.id} />} />
              <Route path="/config" element={<ConfigManagement adminUserId={adminUser.id} />} />
              <Route path="/gifts" element={<GiftCatalog adminUserId={adminUser.id} />} />
              <Route path="/operations" element={<Operations adminUserId={adminUser.id} />} />
              <Route path="/wallet" element={<WalletDashboard adminUserId={adminUser.id} />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      )}
    </AdminAuthContext.Provider>
  );
}

export default AdminApp;
