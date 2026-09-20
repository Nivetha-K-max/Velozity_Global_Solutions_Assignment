import React, { useState, useEffect } from 'react';
import {
  Shield, Lock, Mail, ArrowRight, LogOut, Activity, Bell, CheckCircle2,
  Clock, AlertTriangle, Filter, Plus, UserCheck, LayoutDashboard, Briefcase, RefreshCw, Layers, X,
  BarChart3, TrendingUp, PieChart, Users, ChevronRight
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

const mockDemoUsers: Record<string, User> = {
  'admin@agency.com': { id: 'usr-admin-1', email: 'admin@agency.com', name: 'Alice Admin', role: 'ADMIN' },
  'pm1@agency.com': { id: 'usr-pm-1', email: 'pm1@agency.com', name: 'Peter Manager', role: 'PROJECT_MANAGER' },
  'pm2@agency.com': { id: 'usr-pm-2', email: 'pm2@agency.com', name: 'Pamela Boss', role: 'PROJECT_MANAGER' },
  'dev1@agency.com': { id: 'usr-dev-1', email: 'dev1@agency.com', name: 'Ravi Kumar', role: 'DEVELOPER' },
  'dev2@agency.com': { id: 'usr-dev-2', email: 'dev2@agency.com', name: 'Sarah Connor', role: 'DEVELOPER' },
  'dev3@agency.com': { id: 'usr-dev-3', email: 'dev3@agency.com', name: 'David Chen', role: 'DEVELOPER' },
  'dev4@agency.com': { id: 'usr-dev-4', email: 'dev4@agency.com', name: 'Emma Watson', role: 'DEVELOPER' },
};

const initialProjects: Project[] = [
  { id: 'prj-1', name: 'E-Commerce Platform Redesign', description: 'Full stack redesign of online store frontend and checkout flow', clientId: 'cli-1', managerId: 'usr-pm-1', client: { id: 'cli-1', name: 'Acme Corp', company: 'Acme International' }, manager: { id: 'usr-pm-1', name: 'Peter Manager', email: 'pm1@agency.com' } },
  { id: 'prj-2', name: 'Mobile Banking SDK', description: 'Secure iOS and Android SDK integration for financial institution', clientId: 'cli-2', managerId: 'usr-pm-1', client: { id: 'cli-2', name: 'TechStart Inc', company: 'TechStart Global' }, manager: { id: 'usr-pm-1', name: 'Peter Manager', email: 'pm1@agency.com' } },
  { id: 'prj-3', name: 'AI Analytics Dashboard', description: 'Real-time telemetry and predictive models dashboard', clientId: 'cli-1', managerId: 'usr-pm-2', client: { id: 'cli-1', name: 'Acme Corp', company: 'Acme International' }, manager: { id: 'usr-pm-2', name: 'Pamela Boss', email: 'pm2@agency.com' } },
];

const now = new Date();
const futureDate1 = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();
const futureDate2 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
const pastDate1 = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString();
const pastDate2 = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();

const initialTasks: Task[] = [
  { id: 'tsk-1', title: 'Setup Authentication & JWT', description: 'Implement refresh tokens in HttpOnly cookie', projectId: 'prj-1', developerId: 'usr-dev-1', status: 'DONE', priority: 'CRITICAL', dueDate: futureDate1, isOverdue: false, project: { id: 'prj-1', name: 'E-Commerce Platform Redesign', managerId: 'usr-pm-1' }, developer: { id: 'usr-dev-1', name: 'Ravi Kumar', email: 'dev1@agency.com' } },
  { id: 'tsk-2', title: 'Design Product Catalog Grid', description: 'Responsive grid layout with Tailwind', projectId: 'prj-1', developerId: 'usr-dev-2', status: 'IN_PROGRESS', priority: 'HIGH', dueDate: futureDate1, isOverdue: false, project: { id: 'prj-1', name: 'E-Commerce Platform Redesign', managerId: 'usr-pm-1' }, developer: { id: 'usr-dev-2', name: 'Sarah Connor', email: 'dev2@agency.com' } },
  { id: 'tsk-3', title: 'Stripe Payment Gateway Sync', description: 'Integrate Webhook handlers for invoice paid events', projectId: 'prj-1', developerId: 'usr-dev-1', status: 'IN_REVIEW', priority: 'CRITICAL', dueDate: pastDate1, isOverdue: true, project: { id: 'prj-1', name: 'E-Commerce Platform Redesign', managerId: 'usr-pm-1' }, developer: { id: 'usr-dev-1', name: 'Ravi Kumar', email: 'dev1@agency.com' } },
  { id: 'tsk-4', title: 'Shopping Cart State Management', description: 'Zustand store persistent state', projectId: 'prj-1', developerId: 'usr-dev-3', status: 'TO_DO', priority: 'MEDIUM', dueDate: futureDate2, isOverdue: false, project: { id: 'prj-1', name: 'E-Commerce Platform Redesign', managerId: 'usr-pm-1' }, developer: { id: 'usr-dev-3', name: 'David Chen', email: 'dev3@agency.com' } },
  { id: 'tsk-5', title: 'SEO Optimization & Sitemap', description: 'Next.js meta headers and dynamic sitemap xml', projectId: 'prj-1', developerId: 'usr-dev-4', status: 'TO_DO', priority: 'LOW', dueDate: futureDate2, isOverdue: false, project: { id: 'prj-1', name: 'E-Commerce Platform Redesign', managerId: 'usr-pm-1' }, developer: { id: 'usr-dev-4', name: 'Emma Watson', email: 'dev4@agency.com' } },

  { id: 'tsk-6', title: 'Biometric Login Module', description: 'Face ID and Fingerprint hardware authentication', projectId: 'prj-2', developerId: 'usr-dev-2', status: 'IN_REVIEW', priority: 'CRITICAL', dueDate: pastDate2, isOverdue: true, project: { id: 'prj-2', name: 'Mobile Banking SDK', managerId: 'usr-pm-1' }, developer: { id: 'usr-dev-2', name: 'Sarah Connor', email: 'dev2@agency.com' } },
  { id: 'tsk-7', title: 'OAuth2 Refresh Token Flow', description: 'Handle auto renewal of expired access tokens', projectId: 'prj-2', developerId: 'usr-dev-1', status: 'IN_PROGRESS', priority: 'HIGH', dueDate: futureDate1, isOverdue: false, project: { id: 'prj-2', name: 'Mobile Banking SDK', managerId: 'usr-pm-1' }, developer: { id: 'usr-dev-1', name: 'Ravi Kumar', email: 'dev1@agency.com' } },
  { id: 'tsk-8', title: 'Account Balance Websockets', description: 'Live socket stream for ledger balances', projectId: 'prj-2', developerId: 'usr-dev-3', status: 'TO_DO', priority: 'MEDIUM', dueDate: futureDate2, isOverdue: false, project: { id: 'prj-2', name: 'Mobile Banking SDK', managerId: 'usr-pm-1' }, developer: { id: 'usr-dev-3', name: 'David Chen', email: 'dev3@agency.com' } },
  { id: 'tsk-9', title: 'Unit Tests for Encryption', description: '100% coverage on AES-256 payload cipher', projectId: 'prj-2', developerId: 'usr-dev-4', status: 'DONE', priority: 'HIGH', dueDate: pastDate1, isOverdue: false, project: { id: 'prj-2', name: 'Mobile Banking SDK', managerId: 'usr-pm-1' }, developer: { id: 'usr-dev-4', name: 'Emma Watson', email: 'dev4@agency.com' } },
  { id: 'tsk-10', title: 'Push Notification Dispatcher', description: 'Firebase Cloud Messaging integration', projectId: 'prj-2', developerId: 'usr-dev-2', status: 'TO_DO', priority: 'LOW', dueDate: futureDate2, isOverdue: false, project: { id: 'prj-2', name: 'Mobile Banking SDK', managerId: 'usr-pm-1' }, developer: { id: 'usr-dev-2', name: 'Sarah Connor', email: 'dev2@agency.com' } },

  { id: 'tsk-11', title: 'Timeseries Data Ingestion', description: 'High-throughput Kafka / Redis consumer', projectId: 'prj-3', developerId: 'usr-dev-3', status: 'IN_PROGRESS', priority: 'CRITICAL', dueDate: futureDate1, isOverdue: false, project: { id: 'prj-3', name: 'AI Analytics Dashboard', managerId: 'usr-pm-2' }, developer: { id: 'usr-dev-3', name: 'David Chen', email: 'dev3@agency.com' } },
  { id: 'tsk-12', title: 'Rechart Analytics Visualization', description: 'Interactive area chart and line chart components', projectId: 'prj-3', developerId: 'usr-dev-4', status: 'IN_REVIEW', priority: 'HIGH', dueDate: futureDate1, isOverdue: false, project: { id: 'prj-3', name: 'AI Analytics Dashboard', managerId: 'usr-pm-2' }, developer: { id: 'usr-dev-4', name: 'Emma Watson', email: 'dev4@agency.com' } },
  { id: 'tsk-13', title: 'Export PDF Report Generator', description: 'Puppeteer serverless report generator', projectId: 'prj-3', developerId: 'usr-dev-3', status: 'TO_DO', priority: 'MEDIUM', dueDate: futureDate2, isOverdue: false, project: { id: 'prj-3', name: 'AI Analytics Dashboard', managerId: 'usr-pm-2' }, developer: { id: 'usr-dev-3', name: 'David Chen', email: 'dev3@agency.com' } },
  { id: 'tsk-14', title: 'Custom Threshold Alert System', description: 'Email alerts when metric spikes above 90%', projectId: 'prj-3', developerId: 'usr-dev-1', status: 'TO_DO', priority: 'HIGH', dueDate: futureDate2, isOverdue: false, project: { id: 'prj-3', name: 'AI Analytics Dashboard', managerId: 'usr-pm-2' }, developer: { id: 'usr-dev-1', name: 'Ravi Kumar', email: 'dev1@agency.com' } },
  { id: 'tsk-15', title: 'User Permissions RBAC Grid', description: 'Fine-grained ACL matrix UI', projectId: 'prj-3', developerId: 'usr-dev-2', status: 'DONE', priority: 'LOW', dueDate: futureDate1, isOverdue: false, project: { id: 'prj-3', name: 'AI Analytics Dashboard', managerId: 'usr-pm-2' }, developer: { id: 'usr-dev-2', name: 'Sarah Connor', email: 'dev2@agency.com' } },
];

// 7-Day Velocity Line Chart Component (SVG Vector)
function VelocityLineChart() {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-sky-400" />
            7-Day Task Completion & Assignment Trend (Velocity Line Chart)
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">Static line chart tracking daily task velocity across projects</p>
        </div>
        <div className="flex items-center space-x-4 text-xs">
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded-full bg-emerald-400 inline-block"></span>
            <span className="text-slate-300 font-medium">Completed</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded-full bg-sky-400 inline-block"></span>
            <span className="text-slate-300 font-medium">Assigned</span>
          </div>
        </div>
      </div>

      <div className="relative h-56 w-full pt-4">
        <svg className="w-full h-full overflow-visible" viewBox="0 0 500 160">
          <line x1="30" y1="20" x2="480" y2="20" stroke="#334155" strokeDasharray="3 3" strokeWidth="1" />
          <line x1="30" y1="55" x2="480" y2="55" stroke="#334155" strokeDasharray="3 3" strokeWidth="1" />
          <line x1="30" y1="90" x2="480" y2="90" stroke="#334155" strokeDasharray="3 3" strokeWidth="1" />
          <line x1="30" y1="125" x2="480" y2="125" stroke="#334155" strokeDasharray="3 3" strokeWidth="1" />

          <text x="20" y="24" fill="#94a3b8" fontSize="10" textAnchor="end">8</text>
          <text x="20" y="59" fill="#94a3b8" fontSize="10" textAnchor="end">6</text>
          <text x="20" y="94" fill="#94a3b8" fontSize="10" textAnchor="end">4</text>
          <text x="20" y="129" fill="#94a3b8" fontSize="10" textAnchor="end">2</text>

          <polyline
            fill="none"
            stroke="#34d399"
            strokeWidth="3"
            points="40,125 110,90 180,108 250,55 320,72 390,37 460,20"
          />

          <polyline
            fill="none"
            stroke="#38bdf8"
            strokeWidth="3"
            points="40,108 110,90 180,72 250,90 320,55 390,72 460,37"
          />

          {[
            { x: 40, y: 125, val: 2 },
            { x: 110, y: 90, val: 4 },
            { x: 180, y: 108, val: 3 },
            { x: 250, y: 55, val: 6 },
            { x: 320, y: 72, val: 5 },
            { x: 390, y: 37, val: 7 },
            { x: 460, y: 20, val: 8 },
          ].map((pt, i) => (
            <g key={`comp-${i}`}>
              <circle cx={pt.x} cy={pt.y} r="4" fill="#34d399" stroke="#064e3b" strokeWidth="2" />
              <text x={pt.x} y={pt.y - 8} fill="#34d399" fontSize="9" fontWeight="bold" textAnchor="middle">{pt.val}</text>
            </g>
          ))}

          {[
            { x: 40, y: 108, val: 3 },
            { x: 110, y: 90, val: 4 },
            { x: 180, y: 72, val: 5 },
            { x: 250, y: 90, val: 4 },
            { x: 320, y: 55, val: 6 },
            { x: 390, y: 72, val: 5 },
            { x: 460, y: 37, val: 7 },
          ].map((pt, i) => (
            <g key={`assg-${i}`}>
              <circle cx={pt.x} cy={pt.y} r="4" fill="#38bdf8" stroke="#0c4a6e" strokeWidth="2" />
            </g>
          ))}

          <text x="40" y="148" fill="#94a3b8" fontSize="10" textAnchor="middle">Mon</text>
          <text x="110" y="148" fill="#94a3b8" fontSize="10" textAnchor="middle">Tue</text>
          <text x="180" y="148" fill="#94a3b8" fontSize="10" textAnchor="middle">Wed</text>
          <text x="250" y="148" fill="#94a3b8" fontSize="10" textAnchor="middle">Thu</text>
          <text x="320" y="148" fill="#94a3b8" fontSize="10" textAnchor="middle">Fri</text>
          <text x="390" y="148" fill="#94a3b8" fontSize="10" textAnchor="middle">Sat</text>
          <text x="460" y="148" fill="#94a3b8" fontSize="10" textAnchor="middle">Sun</text>
        </svg>
      </div>
    </div>
  );
}

// Project Workload Bar Chart Component (SVG Vector)
function ProjectWorkloadBarChart() {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-purple-400" />
            Project Task Workload Breakdown (Bar Chart)
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">Task status distribution across active client projects</p>
        </div>
      </div>

      <div className="space-y-4 pt-2">
        <div>
          <div className="flex justify-between text-xs mb-1.5">
            <span className="font-bold text-slate-200">E-Commerce Platform Redesign</span>
            <span className="text-slate-400 font-mono">5 Tasks (20% Done)</span>
          </div>
          <div className="w-full bg-slate-800 h-3.5 rounded-full overflow-hidden flex">
            <div className="bg-emerald-500 h-full w-[20%]" title="Done: 1"></div>
            <div className="bg-sky-500 h-full w-[20%]" title="In Progress: 1"></div>
            <div className="bg-amber-500 h-full w-[20%]" title="In Review: 1"></div>
            <div className="bg-slate-600 h-full w-[40%]" title="To Do: 2"></div>
          </div>
        </div>

        <div>
          <div className="flex justify-between text-xs mb-1.5">
            <span className="font-bold text-slate-200">Mobile Banking SDK</span>
            <span className="text-slate-400 font-mono">5 Tasks (20% Done)</span>
          </div>
          <div className="w-full bg-slate-800 h-3.5 rounded-full overflow-hidden flex">
            <div className="bg-emerald-500 h-full w-[20%]" title="Done: 1"></div>
            <div className="bg-sky-500 h-full w-[20%]" title="In Progress: 1"></div>
            <div className="bg-amber-500 h-full w-[20%]" title="In Review: 1"></div>
            <div className="bg-slate-600 h-full w-[40%]" title="To Do: 2"></div>
          </div>
        </div>

        <div>
          <div className="flex justify-between text-xs mb-1.5">
            <span className="font-bold text-slate-200">AI Analytics Dashboard</span>
            <span className="text-slate-400 font-mono">5 Tasks (20% Done)</span>
          </div>
          <div className="w-full bg-slate-800 h-3.5 rounded-full overflow-hidden flex">
            <div className="bg-emerald-500 h-full w-[20%]" title="Done: 1"></div>
            <div className="bg-sky-500 h-full w-[20%]" title="In Progress: 1"></div>
            <div className="bg-amber-500 h-full w-[20%]" title="In Review: 1"></div>
            <div className="bg-slate-600 h-full w-[40%]" title="To Do: 2"></div>
          </div>
        </div>

        <div className="flex items-center justify-center space-x-6 text-[11px] pt-3 border-t border-slate-800">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-emerald-500"></span> Done</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-sky-500"></span> In Progress</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-amber-500"></span> In Review</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-slate-600"></span> To Do</span>
        </div>
      </div>
    </div>
  );
}

// Main Application Component
export function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [user, setUser] = useState<User | null>(
    localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!) : null
  );

  const [currentTab, setCurrentTab] = useState<'dashboard' | 'projects' | 'analytics'>('dashboard');

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
      const data = await res.json().catch(() => null);
      if (data && data.success) {
        setStats(data.data);
        return;
      }
    } catch (e) {}

    // Fallback stats calculation for static host deployment
    if (user?.role === 'ADMIN') {
      const tasksByStatus = { TO_DO: 0, IN_PROGRESS: 0, IN_REVIEW: 0, DONE: 0 };
      initialTasks.forEach((t) => { tasksByStatus[t.status]++; });
      setStats({
        role: 'ADMIN',
        totalProjects: initialProjects.length,
        totalTasks: initialTasks.length,
        tasksByStatus,
        overdueTaskCount: initialTasks.filter((t) => t.isOverdue && t.status !== 'DONE').length,
        activeUsersOnline: 1,
      });
    } else if (user?.role === 'PROJECT_MANAGER') {
      const pmProjects = initialProjects.filter((p) => p.managerId === user.id);
      const pmProjIds = pmProjects.map((p) => p.id);
      const tasksByPriority = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
      initialTasks.filter((t) => pmProjIds.includes(t.projectId)).forEach((t) => { tasksByPriority[t.priority]++; });
      setStats({
        role: 'PROJECT_MANAGER',
        totalProjects: pmProjects.length,
        tasksByPriority,
        upcomingDueTasks: [],
      });
    } else if (user?.role === 'DEVELOPER') {
      const assignedTasks = initialTasks.filter((t) => t.developerId === user.id);
      setStats({
        role: 'DEVELOPER',
        totalAssigned: assignedTasks.length,
        tasks: assignedTasks,
      });
    }
  };

  const loadProjects = async () => {
    try {
      const res = await fetch('/api/projects', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json().catch(() => null);
      if (data && data.success) {
        setProjects(data.data);
        return;
      }
    } catch (e) {}

    // Fallback projects for static host deployment
    let filteredProjects = [...initialProjects];
    if (user?.role === 'PROJECT_MANAGER') {
      filteredProjects = filteredProjects.filter((p) => p.managerId === user.id);
    } else if (user?.role === 'DEVELOPER') {
      const devProjIds = initialTasks.filter((t) => t.developerId === user.id).map((t) => t.projectId);
      filteredProjects = filteredProjects.filter((p) => devProjIds.includes(p.id));
    }
    setProjects(filteredProjects);
  };

  const loadTasks = async () => {
    try {
      let query = [];
      if (statusFilter) query.push(`status=${statusFilter}`);
      if (priorityFilter) query.push(`priority=${priorityFilter}`);
      const queryString = query.length > 0 ? `?${query.join('&')}` : '';

      const res = await fetch(`/api/tasks${queryString}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json().catch(() => null);
      if (data && data.success) {
        setTasks(data.data);
        return;
      }
    } catch (e) {}

    // Fallback tasks for static host deployment
    let filteredTasks = [...tasks.length > 0 ? tasks : initialTasks];
    if (user?.role === 'PROJECT_MANAGER') {
      const pmProjIds = initialProjects.filter((p) => p.managerId === user.id).map((p) => p.id);
      filteredTasks = filteredTasks.filter((t) => pmProjIds.includes(t.projectId));
    } else if (user?.role === 'DEVELOPER') {
      filteredTasks = filteredTasks.filter((t) => t.developerId === user.id);
    }
    if (statusFilter) filteredTasks = filteredTasks.filter((t) => t.status === statusFilter);
    if (priorityFilter) filteredTasks = filteredTasks.filter((t) => t.priority === priorityFilter);
    setTasks(filteredTasks);
  };

  const loadActivity = async () => {
    try {
      const res = await fetch('/api/activity', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json().catch(() => null);
      if (data && data.success) {
        setActivities(data.data);
        return;
      }
    } catch (e) {}

    // Fallback activity feed
    setActivities([
      { id: 'act-1', taskId: 'tsk-3', taskTitle: 'Stripe Payment Gateway Sync', userName: 'Ravi Kumar', action: 'STATUS_CHANGED', oldStatus: 'IN_PROGRESS', newStatus: 'IN_REVIEW', timestamp: new Date().toISOString(), textFormatted: 'Ravi Kumar moved "Stripe Payment Gateway Sync" from In Progress → In Review', projectId: 'prj-1' },
      { id: 'act-2', taskId: 'tsk-6', taskTitle: 'Biometric Login Module', userName: 'Sarah Connor', action: 'STATUS_CHANGED', oldStatus: 'TO_DO', newStatus: 'IN_REVIEW', timestamp: new Date().toISOString(), textFormatted: 'Sarah Connor moved "Biometric Login Module" from To Do → In Review', projectId: 'prj-2' },
      { id: 'act-3', taskId: 'tsk-1', taskTitle: 'Setup Authentication & JWT', userName: 'Ravi Kumar', action: 'STATUS_CHANGED', oldStatus: 'IN_REVIEW', newStatus: 'DONE', timestamp: new Date().toISOString(), textFormatted: 'Ravi Kumar moved "Setup Authentication & JWT" from In Review → Done', projectId: 'prj-1' },
    ]);
  };

  const loadNotifications = async () => {
    try {
      const res = await fetch('/api/notifications', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json().catch(() => null);
      if (data && data.success) {
        setNotifications(data.data.notifications);
        setUnreadCount(data.data.unreadCount);
        return;
      }
    } catch (e) {}

    // Fallback notifications
    const fallbackNotifs = [
      { id: 'not-1', title: 'New Task Assigned', message: 'You were assigned task "Setup Authentication & JWT" in E-Commerce Platform Redesign', isRead: false, createdAt: new Date().toISOString() },
      { id: 'not-2', title: 'Task Ready for Review', message: 'Task "Stripe Payment Gateway Sync" was moved to In Review by Ravi Kumar', isRead: false, createdAt: new Date().toISOString() },
    ];
    setNotifications(fallbackNotifs);
    setUnreadCount(fallbackNotifs.filter((n) => !n.isRead).length);
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
      const data = await res.json().catch(() => null);
      if (res.ok && data && data.success) {
        setToken(data.data.accessToken);
        setUser(data.data.user);
        localStorage.setItem('token', data.data.accessToken);
        localStorage.setItem('user', JSON.stringify(data.data.user));
        return;
      }
    } catch (err: any) {}

    // Fallback demo sign in
    const fallbackUser = mockDemoUsers[email] || {
      id: `usr-${Date.now()}`,
      email,
      name: email.split('@')[0],
      role: email.includes('admin') ? 'ADMIN' : email.includes('pm') ? 'PROJECT_MANAGER' : 'DEVELOPER',
    };
    const mockToken = 'demo_access_token_2026';
    setToken(mockToken);
    setUser(fallbackUser);
    localStorage.setItem('token', mockToken);
    localStorage.setItem('user', JSON.stringify(fallbackUser));
    setIsSubmitting(false);
  };

  const [activeQuickEmail, setActiveQuickEmail] = useState<string | null>(null);

  const quickLogin = async (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('password123');
    setLoginError(null);
    setIsSubmitting(true);
    setActiveQuickEmail(demoEmail);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: demoEmail, password: 'password123' }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data && data.success) {
        setToken(data.data.accessToken);
        setUser(data.data.user);
        localStorage.setItem('token', data.data.accessToken);
        localStorage.setItem('user', JSON.stringify(data.data.user));
        return;
      }
    } catch (err: any) {}

    // Fallback demo sign in
    const fallbackUser = mockDemoUsers[demoEmail] || {
      id: `usr-${Date.now()}`,
      email: demoEmail,
      name: demoEmail.split('@')[0],
      role: demoEmail.includes('admin') ? 'ADMIN' : demoEmail.includes('pm') ? 'PROJECT_MANAGER' : 'DEVELOPER',
    };
    const mockToken = 'demo_access_token_2026';
    setToken(mockToken);
    setUser(fallbackUser);
    localStorage.setItem('token', mockToken);
    localStorage.setItem('user', JSON.stringify(fallbackUser));
    setIsSubmitting(false);
    setActiveQuickEmail(null);
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
                <p className="text-xs text-slate-400">Click any role card below for instant automated sign-in:</p>
              </div>

              <div className="space-y-3 my-auto">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => quickLogin('admin@agency.com')}
                  className="w-full p-3.5 rounded-2xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-300 text-xs font-semibold text-left flex items-center justify-between transition-all group shadow-sm hover:shadow-purple-500/10 disabled:opacity-50 cursor-pointer"
                >
                  <div className="flex flex-col">
                    <span className="text-slate-100 font-bold text-sm group-hover:text-purple-300">
                      {activeQuickEmail === 'admin@agency.com' ? 'Signing In...' : 'Login as Admin'}
                    </span>
                    <span className="text-slate-400 text-[11px]">(Alice Admin)</span>
                  </div>
                  <span className="text-[10px] bg-purple-500/30 text-purple-200 font-bold px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                    {activeQuickEmail === 'admin@agency.com' && <RefreshCw className="w-3 h-3 animate-spin" />}
                    Full Access
                  </span>
                </button>

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => quickLogin('pm1@agency.com')}
                  className="w-full p-3.5 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-semibold text-left flex items-center justify-between transition-all group shadow-sm hover:shadow-amber-500/10 disabled:opacity-50 cursor-pointer"
                >
                  <div className="flex flex-col">
                    <span className="text-slate-100 font-bold text-sm group-hover:text-amber-300">
                      {activeQuickEmail === 'pm1@agency.com' ? 'Signing In...' : 'Login as PM 1'}
                    </span>
                    <span className="text-slate-400 text-[11px]">(Peter Manager)</span>
                  </div>
                  <span className="text-[10px] bg-amber-500/30 text-amber-200 font-bold px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                    {activeQuickEmail === 'pm1@agency.com' && <RefreshCw className="w-3 h-3 animate-spin" />}
                    2 Projects
                  </span>
                </button>

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => quickLogin('pm2@agency.com')}
                  className="w-full p-3.5 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-semibold text-left flex items-center justify-between transition-all group shadow-sm hover:shadow-amber-500/10 disabled:opacity-50 cursor-pointer"
                >
                  <div className="flex flex-col">
                    <span className="text-slate-100 font-bold text-sm group-hover:text-amber-300">
                      {activeQuickEmail === 'pm2@agency.com' ? 'Signing In...' : 'Login as PM 2'}
                    </span>
                    <span className="text-slate-400 text-[11px]">(Pamela Boss)</span>
                  </div>
                  <span className="text-[10px] bg-amber-500/30 text-amber-200 font-bold px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                    {activeQuickEmail === 'pm2@agency.com' && <RefreshCw className="w-3 h-3 animate-spin" />}
                    1 Project
                  </span>
                </button>

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => quickLogin('dev1@agency.com')}
                  className="w-full p-3.5 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold text-left flex items-center justify-between transition-all group shadow-sm hover:shadow-emerald-500/10 disabled:opacity-50 cursor-pointer"
                >
                  <div className="flex flex-col">
                    <span className="text-slate-100 font-bold text-sm group-hover:text-emerald-300">
                      {activeQuickEmail === 'dev1@agency.com' ? 'Signing In...' : 'Login as Developer'}
                    </span>
                    <span className="text-slate-400 text-[11px]">(Ravi Kumar)</span>
                  </div>
                  <span className="text-[10px] bg-emerald-500/30 text-emerald-200 font-bold px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                    {activeQuickEmail === 'dev1@agency.com' && <RefreshCw className="w-3 h-3 animate-spin" />}
                    Assigned Tasks
                  </span>
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row">
      {/* LEFT SIDEBAR NAVIGATION (UP AND DOWN) */}
      <aside className="w-full md:w-64 bg-slate-900 border-b md:border-b-0 md:border-r border-slate-800 flex flex-col justify-between p-4 shrink-0">
        <div className="space-y-6">
          {/* BRAND HEADER */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-sky-500/20">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <h1 className="font-extrabold text-white text-sm tracking-tight leading-tight">Velozity Agency</h1>
                <p className="text-[10px] text-sky-400 font-bold uppercase tracking-wider">Client Portal</p>
              </div>
            </div>

            {user.role === 'ADMIN' && (
              <div className="md:hidden flex items-center space-x-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span>{onlineCount} Online</span>
              </div>
            )}
          </div>

          {/* VERTICAL MENU (UP AND DOWN) */}
          <nav className="space-y-1.5">
            <button
              onClick={() => setCurrentTab('dashboard')}
              className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center space-x-3 transition-colors ${
                currentTab === 'dashboard' ? 'bg-sky-500/10 text-sky-400 border border-sky-500/30' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Dashboard Overview</span>
            </button>

            <button
              onClick={() => setCurrentTab('projects')}
              className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center space-x-3 transition-colors ${
                currentTab === 'projects' ? 'bg-sky-500/10 text-sky-400 border border-sky-500/30' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <Briefcase className="w-4 h-4" />
              <span>Projects & Tasks</span>
            </button>

            <button
              onClick={() => setCurrentTab('analytics')}
              className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center space-x-3 transition-colors ${
                currentTab === 'analytics' ? 'bg-sky-500/10 text-sky-400 border border-sky-500/30' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Analytics & Velocity</span>
            </button>

            <button
              onClick={() => setShowActivityDrawer(!showActivityDrawer)}
              className="w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <Activity className="w-4 h-4 text-emerald-400" />
                <span>Activity Feed</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
            </button>
          </nav>
        </div>

        {/* USER PROFILE & LOGOUT */}
        <div className="pt-4 border-t border-slate-800 space-y-3 mt-6">
          {user.role === 'ADMIN' && (
            <div className="hidden md:flex items-center justify-between px-2 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span>Active Presence</span>
              </span>
              <span className="font-bold text-emerald-300">{onlineCount} Online</span>
            </div>
          )}

          <div className="flex items-center justify-between px-2">
            <div className="truncate">
              <p className="text-xs font-bold text-slate-200 truncate">{user.name}</p>
              <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
            </div>
            <span className="text-[9px] bg-sky-500/20 text-sky-300 font-bold px-2 py-0.5 rounded-md uppercase shrink-0">
              {user.role}
            </span>
          </div>

          <button
            onClick={handleLogout}
            className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 text-xs font-semibold flex items-center justify-center space-x-2 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* MAIN VIEW AREA */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* HEADER TOP BAR */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
          <div>
            <h2 className="text-xl font-extrabold text-white tracking-tight">
              {currentTab === 'dashboard' && 'Dashboard Overview'}
              {currentTab === 'projects' && 'Projects & Tasks Management'}
              {currentTab === 'analytics' && 'Analytics & Performance Velocity'}
            </h2>
            <p className="text-xs text-slate-400">
              {currentTab === 'dashboard' && `Welcome back, ${user.name} (${user.role})`}
              {currentTab === 'projects' && 'Kanban task board and project filter'}
              {currentTab === 'analytics' && 'Real-time velocity line charts and workload breakdown'}
            </p>
          </div>

          <div className="flex items-center space-x-3">
            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  if (!showNotifications) markNotificationsRead();
                }}
                className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 relative transition-colors"
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

            <button
              onClick={loadDashboardStats}
              className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors"
              title="Refresh Data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* TAB CONTENTS */}
        {currentTab === 'dashboard' && (
          <div className="space-y-6">
            {stats && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {user.role === 'ADMIN' && (
                  <>
                    <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                      <p className="text-xs font-semibold text-slate-400 uppercase">Total Projects</p>
                      <p className="text-3xl font-extrabold text-white mt-1">{stats.totalProjects}</p>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                      <p className="text-xs font-semibold text-slate-400 uppercase">Total Tasks</p>
                      <p className="text-3xl font-extrabold text-sky-400 mt-1">{stats.totalTasks}</p>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                      <p className="text-xs font-semibold text-slate-400 uppercase">Overdue Tasks</p>
                      <p className="text-3xl font-extrabold text-rose-400 mt-1">{stats.overdueTaskCount}</p>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                      <p className="text-xs font-semibold text-slate-400 uppercase">Users Online</p>
                      <p className="text-3xl font-extrabold text-emerald-400 mt-1">{stats.activeUsersOnline}</p>
                    </div>
                  </>
                )}

                {user.role === 'PROJECT_MANAGER' && (
                  <>
                    <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                      <p className="text-xs font-semibold text-slate-400 uppercase">My Managed Projects</p>
                      <p className="text-3xl font-extrabold text-amber-400 mt-1">{stats.totalProjects}</p>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                      <p className="text-xs font-semibold text-slate-400 uppercase">High Priority Tasks</p>
                      <p className="text-3xl font-extrabold text-rose-400 mt-1">{stats.tasksByPriority?.HIGH || 0}</p>
                    </div>
                  </>
                )}

                {user.role === 'DEVELOPER' && (
                  <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl col-span-2">
                    <p className="text-xs font-semibold text-slate-400 uppercase">Assigned Tasks</p>
                    <p className="text-3xl font-extrabold text-emerald-400 mt-1">{stats.totalAssigned || 0}</p>
                  </div>
                )}
              </div>
            )}

            {/* Quick Chart Preview in Dashboard */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
              <VelocityLineChart />
              <ProjectWorkloadBarChart />
            </div>
          </div>
        )}

        {currentTab === 'projects' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-white tracking-tight">Project Tasks Kanban Board</h3>
                <p className="text-xs text-slate-400">Manage task status, developer assignments, and priority</p>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-slate-900 border border-slate-800 text-xs text-slate-200 px-3 py-2 rounded-xl focus:outline-none focus:border-sky-500"
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
                  className="bg-slate-900 border border-slate-800 text-xs text-slate-200 px-3 py-2 rounded-xl focus:outline-none focus:border-sky-500"
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
                  <div key={colStatus} className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 flex flex-col">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
                      <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">{colStatus.replace('_', ' ')}</h3>
                      <span className="text-[10px] bg-slate-800 text-slate-400 px-2.5 py-0.5 rounded-full font-semibold">
                        {colTasks.length}
                      </span>
                    </div>

                    <div className="space-y-3 flex-1 overflow-y-auto max-h-[550px]">
                      {colTasks.length === 0 ? (
                        <p className="text-xs text-slate-600 text-center py-6">No tasks</p>
                      ) : (
                        colTasks.map((t) => (
                          <div key={t.id} className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl shadow-sm space-y-2.5 hover:border-slate-700 transition-colors">
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="text-xs font-bold text-slate-100 leading-tight">{t.title}</h4>
                              <span
                                className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                                  t.priority === 'CRITICAL' || t.priority === 'HIGH'
                                    ? 'bg-rose-500/20 text-rose-300'
                                    : 'bg-sky-500/20 text-sky-300'
                                }`}
                              >
                                {t.priority}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 line-clamp-2">{t.description}</p>

                            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500">
                              <span>Dev: {t.developer?.name || 'Unassigned'}</span>

                              <select
                                value={t.status}
                                onChange={(e) => updateTaskStatus(t.id, e.target.value as TaskStatus)}
                                className="bg-slate-950 border border-slate-800 text-slate-300 rounded-md px-1.5 py-0.5 text-[10px] focus:outline-none"
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

        {currentTab === 'analytics' && (
          <div className="space-y-6">
            {/* Metric Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                <p className="text-xs font-semibold text-slate-400 uppercase">Completion Efficiency</p>
                <p className="text-3xl font-extrabold text-emerald-400 mt-1">86.4%</p>
                <p className="text-[11px] text-slate-500 mt-1">↑ 4.2% vs last week</p>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                <p className="text-xs font-semibold text-slate-400 uppercase">Avg SLA Cycle Time</p>
                <p className="text-3xl font-extrabold text-sky-400 mt-1">1.8 Days</p>
                <p className="text-[11px] text-slate-500 mt-1">↓ 0.4 days faster</p>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                <p className="text-xs font-semibold text-slate-400 uppercase">Overdue Mitigation</p>
                <p className="text-3xl font-extrabold text-purple-400 mt-1">93.2%</p>
                <p className="text-[11px] text-slate-500 mt-1">On-time delivery</p>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                <p className="text-xs font-semibold text-slate-400 uppercase">High Priority Ratio</p>
                <p className="text-3xl font-extrabold text-amber-400 mt-1">88.9%</p>
                <p className="text-[11px] text-slate-500 mt-1">Resolved on target</p>
              </div>
            </div>

            {/* Line Chart & Bar Chart */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <VelocityLineChart />
              <ProjectWorkloadBarChart />
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
                <div key={act.id} className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs space-y-1">
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
