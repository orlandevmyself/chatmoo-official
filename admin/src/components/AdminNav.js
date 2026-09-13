import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  BarChart3,
  Users,
  CreditCard,
  Settings,
  Gift,
  LogOut,
  Menu,
  Wrench,
} from 'lucide-react';

function AdminNav({ adminUser, onLogout }) {
  const location = useLocation();
  const [open, setOpen] = React.useState(false);

  const isActive = (path) => location.pathname === path;

  const navItems = [
    { path: '/', label: 'Overview', icon: BarChart3 },
    { path: '/wallet', label: 'Wallet', icon: CreditCard },
    { path: '/users', label: 'Users', icon: Users },
    { path: '/transactions', label: 'Transactions', icon: CreditCard },
    { path: '/gifts', label: 'Gifts', icon: Gift },
    { path: '/config', label: 'Config', icon: Settings },
    { path: '/operations', label: 'Operations', icon: Wrench },
  ];

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="md:hidden fixed top-4 left-4 z-40 p-2 bg-navy rounded-lg text-white"
      >
        <Menu size={24} />
      </button>

      <nav
        className={`fixed md:relative w-64 h-screen bg-navy text-white flex flex-col transition-transform duration-300 z-30 ${
          open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3 mb-4">
            <img src="/logo-graphic.png" alt="Chatmoo" className="h-8 w-8" />
            <img src="/logo-text.png" alt="Chatmoo" className="h-5" />
          </div>
          <p className="text-xs text-white/60 mt-3">Admin Panel</p>
          <p className="text-xs text-white/50 mt-2 break-words">{adminUser?.email}</p>
        </div>

        <ul className="flex-1 p-4 space-y-2">
          {navItems.map(({ path, label, icon: Icon }) => (
            <li key={path}>
              <Link
                to={path}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-4 py-2 rounded-lg transition ${
                  isActive(path)
                    ? 'bg-coral text-white'
                    : 'text-white/70 hover:bg-white/10'
                }`}
              >
                <Icon size={20} />
                <span>{label}</span>
              </Link>
            </li>
          ))}
        </ul>

        <div className="p-4 border-t border-white/10">
          <button
            onClick={() => {
              onLogout();
              setOpen(false);
            }}
            className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-white/70 hover:bg-white/10 transition"
          >
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </nav>

      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}
    </>
  );
}

export default AdminNav;
