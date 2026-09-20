import React, { useState, useEffect } from 'react';
import {
  Shield, Lock, Mail, ArrowRight, LogOut, Activity, Bell, CheckCircle2,
  Clock, AlertTriangle, Filter, Plus, UserCheck, LayoutDashboard, Briefcase, RefreshCw, Layers, X
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';

// Application Types & Data Models
export type Role = 'ADMIN' | 'PROJECT_MANAGER' | 'DEVELOPER';
export type TaskStatus = 'TO_DO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE';
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  projectId: string;
  developerId?: string | null;
  status: TaskStatus;
  priority: Priority;
  dueDate: string;
  isOverdue: boolean;
  project?: { id: string; name: string; managerId: string };
  developer?: { id: string; name: string; email: string } | null;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  clientId: string;
  managerId: string;
  client?: { id: string; name: string; company: string };
  manager?: { id: string; name: string; email: string };
  tasks?: Task[];
}

export interface ActivityItem {
  id: string;
  taskId: string;
  taskTitle: string;
  userName: string;
  action: string;
  oldStatus: string | null;
  newStatus: string | null;
  timestamp: string;
  textFormatted: string;
  projectId: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

// Main Application Component
export function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [user, setUser] = useState<User | null>(
    localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!) : null
  );

  const [currentTab, setCurrentTab] = useState<'dashboard' | 'projects'>('dashboard');

  // Login form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // App data state
  const [stats, setStats] = useState<any>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Drawer toggles
  const [showActivityDrawer, setShowActivityDrawer] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');

  // Socket
  const [socket, setSocket] = useState<Socket | null>(null);
  const [onlineCount, setOnlineCount] = useState(1);

  // Auto-refresh token on initial mount
  useEffect(() => {
    if (!token) {
      fetch('/api/auth/refresh', { method: 'POST' })
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setToken(data.data.accessToken);
            setUser(data.data.user);
            localStorage.setItem('token', data.data.accessToken);
            localStorage.setItem('user', JSON.stringify(data.data.user));
          }
        })
        .catch(() => {});
    }
  }, []);

  // Socket connection setup
  useEffect(() => {
    if (!token) return;

    const newSocket = io({ auth: { token }, transports: ['websocket'] });
    setSocket(newSocket);

    newSocket.on('presence:update', (data: { onlineCount: number }) => {
      setOnlineCount(data.onlineCount);
    });

    newSocket.on('activity:new', (newAct: ActivityItem) => {
      setActivities((prev) => [newAct, ...prev.slice(0, 19)]);
    });

    newSocket.on('notification:new', (data: { notification: NotificationItem; unreadCount: number }) => {
      setNotifications((prev) => [data.notification, ...prev]);
      setUnreadCount(data.unreadCount);
    });

    return () => {
      newSocket.disconnect();
    };
  }, [token]);

  // Fetch initial data when authenticated
  useEffect(() => {
    if (!token) return;
    loadDashboardStats();
    loadProjects();
    loadTasks();
    loadActivity();
    loadNotifications();
  }, [token, statusFilter, priorityFilter]);

  const loadDashboardStats = async () => {
    try {
      const res = await fetch('/api/dashboard/stats', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) setStats(data.data);
    } catch (e) {}
  };

  const loadProjects = async () => {
    try {
      const res = await fetch('/api/projects', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) setProjects(data.data);
    } catch (e) {}
  };

  const loadTasks = async () => {
    try {
      let query = [];
      if (statusFilter) query.push(`status=${statusFilter}`);
      if (priorityFilter) query.push(`priority=${priorityFilter}`);
      const queryString = query.length > 0 ? `?${query.join('&')}` : '';

      const res = await fetch(`/api/tasks${queryString}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) setTasks(data.data);
    } catch (e) {}
  };

  const loadActivity = async () => {
    try {
      const res = await fetch('/api/activity', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) setActivities(data.data);
    } catch (e) {}
  };

  const loadNotifications = async () => {
    try {
      const res = await fetch('/api/notifications', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) {
        setNotifications(data.data.notifications);
        setUnreadCount(data.data.unreadCount);
      }
    } catch (e) {}
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message || 'Login failed');

      setToken(data.data.accessToken);
      setUser(data.data.user);
      localStorage.setItem('token', data.data.accessToken);
      localStorage.setItem('user', JSON.stringify(data.data.user));
    } catch (err: any) {
      setLoginError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const quickLogin = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('password123');
    fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: demoEmail, password: 'password123' }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setToken(data.data.accessToken);
          setUser(data.data.user);
          localStorage.setItem('token', data.data.accessToken);
          localStorage.setItem('user', JSON.stringify(data.data.user));
        }
      });
  };

  const handleLogout = () => {
    fetch('/api/auth/logout', { method: 'POST' });
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  const updateTaskStatus = async (taskId: string, newStatus: TaskStatus) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        loadTasks();
        loadDashboardStats();
      }
    } catch (e) {}
  };

  const markNotificationsRead = async () => {
    fetch('/api/notifications/read', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ markAll: true }),
    });
    setUnreadCount(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  // Login View Render
  if (!token || !user) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-3 mb-8">
          <div className="mx-auto w-12 h-12 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-xl shadow-sky-500/20">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight">Velozity Agency Dashboard</h2>
          <p className="text-sm text-slate-400">Real-Time Client Project Management & Role Control</p>
        </div>

        <div className="mx-auto w-full max-w-4xl">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* LEFT SIDE: 1-CLICK QUICK EVALUATION DEMO LOGIN */}
            <div className="space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center space-x-2 text-amber-400 font-bold text-sm tracking-wider uppercase mb-1">
                  <span>⚡ 1-Click Evaluation Sign-In</span>
                </div>
                <p className="text-xs text-slate-400">Click any role card below to instantly test the portal:</p>
              </div>

              <div className="space-y-3 my-auto">
                <button
                  onClick={() => quickLogin('admin@agency.com')}
                  className="w-full p-3.5 rounded-2xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-300 text-xs font-semibold text-left flex items-center justify-between transition-all group shadow-sm hover:shadow-purple-500/10"
                >
                  <div className="flex flex-col">
                    <span className="text-slate-100 font-bold text-sm group-hover:text-purple-300">Login as Admin</span>
                    <span className="text-slate-400 text-[11px]">(Alice Admin)</span>
                  </div>
                  <span className="text-[10px] bg-purple-500/30 text-purple-200 font-bold px-2.5 py-1 rounded-lg">Full Access</span>
                </button>

                <button
                  onClick={() => quickLogin('pm1@agency.com')}
                  className="w-full p-3.5 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-semibold text-left flex items-center justify-between transition-all group shadow-sm hover:shadow-amber-500/10"
                >
                  <div className="flex flex-col">
                    <span className="text-slate-100 font-bold text-sm group-hover:text-amber-300">Login as PM 1</span>
                    <span className="text-slate-400 text-[11px]">(Peter Manager)</span>
                  </div>
                  <span className="text-[10px] bg-amber-500/30 text-amber-200 font-bold px-2.5 py-1 rounded-lg">2 Projects</span>
                </button>

                <button
                  onClick={() => quickLogin('pm2@agency.com')}
                  className="w-full p-3.5 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-semibold text-left flex items-center justify-between transition-all group shadow-sm hover:shadow-amber-500/10"
                >
                  <div className="flex flex-col">
                    <span className="text-slate-100 font-bold text-sm group-hover:text-amber-300">Login as PM 2</span>
                    <span className="text-slate-400 text-[11px]">(Pamela Boss)</span>
                  </div>
                  <span className="text-[10px] bg-amber-500/30 text-amber-200 font-bold px-2.5 py-1 rounded-lg">1 Project</span>
                </button>

                <button
                  onClick={() => quickLogin('dev1@agency.com')}
                  className="w-full p-3.5 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold text-left flex items-center justify-between transition-all group shadow-sm hover:shadow-emerald-500/10"
                >
                  <div className="flex flex-col">
                    <span className="text-slate-100 font-bold text-sm group-hover:text-emerald-300">Login as Developer</span>
                    <span className="text-slate-400 text-[11px]">(Ravi Kumar)</span>
                  </div>
                  <span className="text-[10px] bg-emerald-500/30 text-emerald-200 font-bold px-2.5 py-1 rounded-lg">Assigned Tasks</span>
                </button>
              </div>

              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl text-[11px] text-slate-400 text-center">
                All demo accounts password: <code className="text-sky-400 font-mono">password123</code>
              </div>
            </div>

            {/* RIGHT SIDE: MANUAL EMAIL & PASSWORD LOGIN FORM */}
            <div className="md:border-l md:border-slate-800 md:pl-8 flex flex-col justify-between pt-6 md:pt-0 border-t md:border-t-0 border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider mb-1">
                  🔑 Account Sign-In
                </h3>
                <p className="text-xs text-slate-400 mb-5">Click here to log in with your email & password:</p>

                {loginError && (
                  <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-medium text-center">
                    {loginError}
                  </div>
                )}

                <form className="space-y-4" onSubmit={handleLogin}>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                      Email Address
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                        <Mail className="w-4 h-4" />
                      </div>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@agency.com"
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-sky-500 transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                      Password
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-sky-500 transition-colors"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3 px-4 mt-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-semibold text-sm shadow-lg shadow-sky-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                  >
                    {isSubmitting ? 'Authenticating...' : 'Sign In'}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              </div>

              <div className="mt-6 text-center text-[11px] text-slate-500">
                Velozity Global Solutions &copy; 2026
              </div>
            </div>

          </div>
        </div>
      </div>
    );
  }

  // Authenticated Portal Layout
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* NAVBAR */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-sky-500/20">
                <Shield className="w-5 h-5" />
              </div>
              <span className="font-bold text-white text-lg tracking-tight hidden sm:inline">Velozity Agency</span>
            </div>

            <nav className="flex space-x-1">
              <button
                onClick={() => setCurrentTab('dashboard')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center space-x-2 transition-colors ${
                  currentTab === 'dashboard' ? 'bg-slate-800 text-sky-400' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Dashboard</span>
              </button>

              <button
                onClick={() => setCurrentTab('projects')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center space-x-2 transition-colors ${
                  currentTab === 'projects' ? 'bg-slate-800 text-sky-400' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Briefcase className="w-4 h-4" />
                <span>Projects & Tasks</span>
              </button>
            </nav>
          </div>

          <div className="flex items-center space-x-3">
            {user.role === 'ADMIN' && (
              <div className="hidden md:flex items-center space-x-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>{onlineCount} Online Now</span>
              </div>
            )}

            {/* Activity Stream Drawer Button */}
            <button
              onClick={() => setShowActivityDrawer(!showActivityDrawer)}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 relative transition-colors"
              title="Live Activity Feed"
            >
              <Activity className="w-4 h-4 text-sky-400" />
            </button>

            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  if (!showNotifications) markNotificationsRead();
                }}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 relative transition-colors"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-4 z-50">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
                    <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Notifications</h4>
                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] text-slate-400">{notifications.length} Total</span>
                      <button
                        onClick={() => setShowNotifications(false)}
                        className="text-slate-400 hover:text-white p-0.5 rounded-md hover:bg-slate-800 transition-colors"
                        title="Close Notifications"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="max-h-60 overflow-y-auto space-y-2">
                    {notifications.length === 0 ? (
                      <p className="text-xs text-slate-500 text-center py-4">No notifications yet</p>
                    ) : (
                      notifications.map((n) => (
                        <div key={n.id} className="p-2 rounded-lg bg-slate-950 border border-slate-800/80 text-xs">
                          <p className="font-semibold text-slate-200">{n.title}</p>
                          <p className="text-slate-400 text-[11px] mt-0.5">{n.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User Profile Badge */}
            <div className="flex items-center space-x-2 pl-2 border-l border-slate-800">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-semibold text-slate-200">{user.name}</p>
                <p className="text-[10px] text-sky-400 font-bold uppercase">{user.role}</p>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentTab === 'dashboard' ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Overview Dashboard</h1>
                <p className="text-xs text-slate-400">Welcome back, {user.name} ({user.role})</p>
              </div>
              <button onClick={loadDashboardStats} className="p-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-400 hover:text-white">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {stats && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {user.role === 'ADMIN' && (
                  <>
                    <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
                      <p className="text-xs font-semibold text-slate-400 uppercase">Total Projects</p>
                      <p className="text-3xl font-bold text-white mt-1">{stats.totalProjects}</p>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
                      <p className="text-xs font-semibold text-slate-400 uppercase">Total Tasks</p>
                      <p className="text-3xl font-bold text-sky-400 mt-1">{stats.totalTasks}</p>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
                      <p className="text-xs font-semibold text-slate-400 uppercase">Overdue Tasks</p>
                      <p className="text-3xl font-bold text-rose-400 mt-1">{stats.overdueTaskCount}</p>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
                      <p className="text-xs font-semibold text-slate-400 uppercase">Users Online</p>
                      <p className="text-3xl font-bold text-emerald-400 mt-1">{stats.activeUsersOnline}</p>
                    </div>
                  </>
                )}

                {user.role === 'PROJECT_MANAGER' && (
                  <>
                    <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
                      <p className="text-xs font-semibold text-slate-400 uppercase">My Managed Projects</p>
                      <p className="text-3xl font-bold text-amber-400 mt-1">{stats.totalProjects}</p>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
                      <p className="text-xs font-semibold text-slate-400 uppercase">High Priority Tasks</p>
                      <p className="text-3xl font-bold text-rose-400 mt-1">{stats.tasksByPriority?.HIGH || 0}</p>
                    </div>
                  </>
                )}

                {user.role === 'DEVELOPER' && (
                  <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl col-span-2">
                    <p className="text-xs font-semibold text-slate-400 uppercase">Assigned Tasks</p>
                    <p className="text-3xl font-bold text-emerald-400 mt-1">{stats.totalAssigned || 0}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* PROJECTS & TASKS TAB */
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Project Tasks Kanban</h1>
                <p className="text-xs text-slate-400">View and manage tasks across projects</p>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-slate-900 border border-slate-800 text-xs text-slate-200 px-3 py-2 rounded-lg"
                >
                  <option value="">All Statuses</option>
                  <option value="TO_DO">To Do</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="IN_REVIEW">In Review</option>
                  <option value="DONE">Done</option>
                </select>

                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="bg-slate-900 border border-slate-800 text-xs text-slate-200 px-3 py-2 rounded-lg"
                >
                  <option value="">All Priorities</option>
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>
            </div>

            {/* Task Kanban Columns */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {(['TO_DO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'] as TaskStatus[]).map((colStatus) => {
                const colTasks = tasks.filter((t) => t.status === colStatus);
                return (
                  <div key={colStatus} className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 flex flex-col">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
                      <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">{colStatus.replace('_', ' ')}</h3>
                      <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-semibold">
                        {colTasks.length}
                      </span>
                    </div>

                    <div className="space-y-3 flex-1 overflow-y-auto max-h-[500px]">
                      {colTasks.length === 0 ? (
                        <p className="text-xs text-slate-600 text-center py-6">No tasks</p>
                      ) : (
                        colTasks.map((t) => (
                          <div key={t.id} className="bg-slate-900 border border-slate-800 p-3 rounded-lg shadow-sm space-y-2">
                            <div className="flex items-start justify-between">
                              <h4 className="text-xs font-semibold text-slate-100">{t.title}</h4>
                              <span
                                className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                  t.priority === 'CRITICAL' || t.priority === 'HIGH'
                                    ? 'bg-rose-500/20 text-rose-300'
                                    : 'bg-sky-500/20 text-sky-300'
                                }`}
                              >
                                {t.priority}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 line-clamp-2">{t.description}</p>

                            <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-500">
                              <span>Dev: {t.developer?.name || 'Unassigned'}</span>

                              {/* Simple Status Move Actions */}
                              <select
                                value={t.status}
                                onChange={(e) => updateTaskStatus(t.id, e.target.value as TaskStatus)}
                                className="bg-slate-950 border border-slate-800 text-slate-300 rounded px-1 py-0.5 text-[10px]"
                              >
                                <option value="TO_DO">To Do</option>
                                <option value="IN_PROGRESS">In Progress</option>
                                <option value="IN_REVIEW">In Review</option>
                                <option value="DONE">Done</option>
                              </select>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* LIVE ACTIVITY SIDEBAR DRAWER */}
      {showActivityDrawer && (
        <div className="fixed inset-y-0 right-0 w-80 bg-slate-900 border-l border-slate-800 shadow-2xl p-4 z-50 flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center space-x-2 text-sky-400">
              <Activity className="w-4 h-4" />
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Live Activity Feed</h3>
            </div>
            <button onClick={() => setShowActivityDrawer(false)} className="text-slate-500 hover:text-white text-xs">✕</button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 py-4">
            {activities.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6">No recent activity</p>
            ) : (
              activities.map((act) => (
                <div key={act.id} className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs space-y-1">
                  <p className="text-slate-200 font-medium">{act.textFormatted}</p>
                  <p className="text-[10px] text-slate-500">{new Date(act.timestamp).toLocaleTimeString()}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
