import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cron from 'node-cron';
import { z } from 'zod';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { PrismaClient, Role, TaskStatus, Priority } from '@prisma/client';

dotenv.config();

// Environment & Config
const config = {
  port: process.env.PORT || 5001,
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || 'velozity_access_secret_key_2026_super_secure',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'velozity_refresh_secret_key_2026_super_secure',
  clientUrl: process.env.CLIENT_URL || '*',
};

let prisma: PrismaClient | null = null;
if (process.env.DATABASE_URL) {
  try {
    prisma = new PrismaClient();
  } catch (e) {
    console.log('[Prisma] Database URL not available, falling back to In-Memory store');
  }
}

// Auth User interface for request extensions
export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  name: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

// ==========================================
// IN-MEMORY FALLBACK DATABASE STORE
// ==========================================
const defaultPasswordHash = bcrypt.hashSync('password123', 10);

const mockUsers: Array<any> = [
  { id: 'usr-admin-1', email: 'admin@agency.com', name: 'Alice Admin', passwordHash: defaultPasswordHash, role: 'ADMIN' },
  { id: 'usr-pm-1', email: 'pm1@agency.com', name: 'Peter Manager', passwordHash: defaultPasswordHash, role: 'PROJECT_MANAGER' },
  { id: 'usr-pm-2', email: 'pm2@agency.com', name: 'Pamela Boss', passwordHash: defaultPasswordHash, role: 'PROJECT_MANAGER' },
  { id: 'usr-dev-1', email: 'dev1@agency.com', name: 'Ravi Kumar', passwordHash: defaultPasswordHash, role: 'DEVELOPER' },
  { id: 'usr-dev-2', email: 'dev2@agency.com', name: 'Sarah Connor', passwordHash: defaultPasswordHash, role: 'DEVELOPER' },
  { id: 'usr-dev-3', email: 'dev3@agency.com', name: 'David Chen', passwordHash: defaultPasswordHash, role: 'DEVELOPER' },
  { id: 'usr-dev-4', email: 'dev4@agency.com', name: 'Emma Watson', passwordHash: defaultPasswordHash, role: 'DEVELOPER' },
];

const mockClients: Array<any> = [
  { id: 'cli-1', name: 'Acme Corp', company: 'Acme International', email: 'contact@acme.com' },
  { id: 'cli-2', name: 'TechStart Inc', company: 'TechStart Global', email: 'hello@techstart.io' },
];

const mockProjects: Array<any> = [
  { id: 'prj-1', name: 'E-Commerce Platform Redesign', description: 'Full stack redesign of online store frontend and checkout flow', clientId: 'cli-1', managerId: 'usr-pm-1', createdAt: new Date() },
  { id: 'prj-2', name: 'Mobile Banking SDK', description: 'Secure iOS and Android SDK integration for financial institution', clientId: 'cli-2', managerId: 'usr-pm-1', createdAt: new Date() },
  { id: 'prj-3', name: 'AI Analytics Dashboard', description: 'Real-time telemetry and predictive models dashboard', clientId: 'cli-1', managerId: 'usr-pm-2', createdAt: new Date() },
];

const now = new Date();
const pastDate1 = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString();
const pastDate2 = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
const futureDate1 = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();
const futureDate2 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

const mockTasks: Array<any> = [
  { id: 'tsk-1', title: 'Setup Authentication & JWT', description: 'Implement refresh tokens in HttpOnly cookie', projectId: 'prj-1', developerId: 'usr-dev-1', status: 'DONE', priority: 'CRITICAL', dueDate: futureDate1, isOverdue: false, createdAt: new Date() },
  { id: 'tsk-2', title: 'Design Product Catalog Grid', description: 'Responsive grid layout with Tailwind', projectId: 'prj-1', developerId: 'usr-dev-2', status: 'IN_PROGRESS', priority: 'HIGH', dueDate: futureDate1, isOverdue: false, createdAt: new Date() },
  { id: 'tsk-3', title: 'Stripe Payment Gateway Sync', description: 'Integrate Webhook handlers for invoice paid events', projectId: 'prj-1', developerId: 'usr-dev-1', status: 'IN_REVIEW', priority: 'CRITICAL', dueDate: pastDate1, isOverdue: true, createdAt: new Date() },
  { id: 'tsk-4', title: 'Shopping Cart State Management', description: 'Zustand store persistent state', projectId: 'prj-1', developerId: 'usr-dev-3', status: 'TO_DO', priority: 'MEDIUM', dueDate: futureDate2, isOverdue: false, createdAt: new Date() },
  { id: 'tsk-5', title: 'SEO Optimization & Sitemap', description: 'Next.js meta headers and dynamic sitemap xml', projectId: 'prj-1', developerId: 'usr-dev-4', status: 'TO_DO', priority: 'LOW', dueDate: futureDate2, isOverdue: false, createdAt: new Date() },
  
  { id: 'tsk-6', title: 'Biometric Login Module', description: 'Face ID and Fingerprint hardware authentication', projectId: 'prj-2', developerId: 'usr-dev-2', status: 'IN_REVIEW', priority: 'CRITICAL', dueDate: pastDate2, isOverdue: true, createdAt: new Date() },
  { id: 'tsk-7', title: 'OAuth2 Refresh Token Flow', description: 'Handle auto renewal of expired access tokens', projectId: 'prj-2', developerId: 'usr-dev-1', status: 'IN_PROGRESS', priority: 'HIGH', dueDate: futureDate1, isOverdue: false, createdAt: new Date() },
  { id: 'tsk-8', title: 'Account Balance Websockets', description: 'Live socket stream for ledger balances', projectId: 'prj-2', developerId: 'usr-dev-3', status: 'TO_DO', priority: 'MEDIUM', dueDate: futureDate2, isOverdue: false, createdAt: new Date() },
  { id: 'tsk-9', title: 'Unit Tests for Encryption', description: '100% coverage on AES-256 payload cipher', projectId: 'prj-2', developerId: 'usr-dev-4', status: 'DONE', priority: 'HIGH', dueDate: pastDate1, isOverdue: false, createdAt: new Date() },
  { id: 'tsk-10', title: 'Push Notification Dispatcher', description: 'Firebase Cloud Messaging integration', projectId: 'prj-2', developerId: 'usr-dev-2', status: 'TO_DO', priority: 'LOW', dueDate: futureDate2, isOverdue: false, createdAt: new Date() },

  { id: 'tsk-11', title: 'Timeseries Data Ingestion', description: 'High-throughput Kafka / Redis consumer', projectId: 'prj-3', developerId: 'usr-dev-3', status: 'IN_PROGRESS', priority: 'CRITICAL', dueDate: futureDate1, isOverdue: false, createdAt: new Date() },
  { id: 'tsk-12', title: 'Rechart Analytics Visualization', description: 'Interactive area chart and line chart components', projectId: 'prj-3', developerId: 'usr-dev-4', status: 'IN_REVIEW', priority: 'HIGH', dueDate: futureDate1, isOverdue: false, createdAt: new Date() },
  { id: 'tsk-13', title: 'Export PDF Report Generator', description: 'Puppeteer serverless report generator', projectId: 'prj-3', developerId: 'usr-dev-3', status: 'TO_DO', priority: 'MEDIUM', dueDate: futureDate2, isOverdue: false, createdAt: new Date() },
  { id: 'tsk-14', title: 'Custom Threshold Alert System', description: 'Email alerts when metric spikes above 90%', projectId: 'prj-3', developerId: 'usr-dev-1', status: 'TO_DO', priority: 'HIGH', dueDate: futureDate2, isOverdue: false, createdAt: new Date() },
  { id: 'tsk-15', title: 'User Permissions RBAC Grid', description: 'Fine-grained ACL matrix UI', projectId: 'prj-3', developerId: 'usr-dev-2', status: 'DONE', priority: 'LOW', dueDate: futureDate1, isOverdue: false, createdAt: new Date() },
];

const mockActivities: Array<any> = [
  { id: 'act-1', taskId: 'tsk-3', userId: 'usr-dev-1', action: 'STATUS_CHANGED', oldStatus: 'IN_PROGRESS', newStatus: 'IN_REVIEW', timestamp: new Date() },
  { id: 'act-2', taskId: 'tsk-6', userId: 'usr-dev-2', action: 'STATUS_CHANGED', oldStatus: 'TO_DO', newStatus: 'IN_REVIEW', timestamp: new Date(now.getTime() - 3600000) },
  { id: 'act-3', taskId: 'tsk-1', userId: 'usr-dev-1', action: 'STATUS_CHANGED', oldStatus: 'IN_REVIEW', newStatus: 'DONE', timestamp: new Date(now.getTime() - 7200000) },
];

const mockNotifications: Array<any> = [
  { id: 'not-1', userId: 'usr-dev-1', title: 'New Task Assigned', message: 'You were assigned task "Setup Authentication & JWT" in project E-Commerce Platform Redesign', isRead: false, createdAt: new Date() },
  { id: 'not-2', userId: 'usr-pm-1', title: 'Task Ready for Review', message: 'Task "Stripe Payment Gateway Sync" was moved to In Review by Ravi Kumar', isRead: false, createdAt: new Date() },
];

// Helper to hydrate Task object with relations
function hydrateTask(task: any) {
  const project = mockProjects.find((p) => p.id === task.projectId);
  const developer = mockUsers.find((u) => u.id === task.developerId);
  return {
    ...task,
    project: project ? { id: project.id, name: project.name, managerId: project.managerId } : undefined,
    developer: developer ? { id: developer.id, name: developer.name, email: developer.email } : null,
  };
}

// FAILSAFE DB QUERY HELPER
async function findUserByEmail(email: string) {
  if (prisma) {
    try {
      const user = await prisma.user.findUnique({ where: { email } });
      if (user) return user;
    } catch (e) {
      console.warn('[Prisma Error] Falling back to mock user data for email:', email);
    }
  }
  return mockUsers.find((u) => u.email === email) || null;
}

async function findUserById(id: string) {
  if (prisma) {
    try {
      const user = await prisma.user.findUnique({ where: { id } });
      if (user) return user;
    } catch (e) {
      console.warn('[Prisma Error] Falling back to mock user data for id:', id);
    }
  }
  return mockUsers.find((u) => u.id === id) || null;
}

// Token Verification Middleware
function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      error: { message: 'Authentication token missing', code: 'UNAUTHORIZED' },
    });
  }

  try {
    const payload = jwt.verify(token, config.jwtAccessSecret) as AuthUser;
    req.user = payload;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: { message: 'Invalid or expired token', code: 'INVALID_TOKEN' },
    });
  }
}

// Role-Based Authorization Middleware
function requireRoles(...allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { message: 'Authentication required', code: 'UNAUTHORIZED' },
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: { message: 'Forbidden: Insufficient role permissions', code: 'FORBIDDEN' },
      });
    }

    next();
  };
}

// Helper to format status names for logs
function formatStatus(status: TaskStatus | null): string {
  if (!status) return '';
  switch (status) {
    case 'TO_DO': return 'To Do';
    case 'IN_PROGRESS': return 'In Progress';
    case 'IN_REVIEW': return 'In Review';
    case 'DONE': return 'Done';
    default: return status;
  }
}

// Initialize Express & HTTP server
const app = express();
const server = http.createServer(app);

// Socket.io Server Setup
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    credentials: true,
  },
});

const onlineUsers = new Map<string, number>();

interface AuthenticatedSocket extends Socket {
  user?: AuthUser;
}

io.use((socket: AuthenticatedSocket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Token missing'));

  try {
    const decoded = jwt.verify(token, config.jwtAccessSecret) as AuthUser;
    socket.user = decoded;
    next();
  } catch (err) {
    next(new Error('Authentication failed'));
  }
});

io.on('connection', (socket: AuthenticatedSocket) => {
  const user = socket.user;
  if (!user) return;

  const currentCount = onlineUsers.get(user.id) || 0;
  onlineUsers.set(user.id, currentCount + 1);

  socket.join(`user:${user.id}`);
  if (user.role === 'ADMIN') {
    socket.join('role:ADMIN');
  } else if (user.role === 'PROJECT_MANAGER') {
    socket.join(`role:PM:${user.id}`);
  } else if (user.role === 'DEVELOPER') {
    socket.join(`role:DEV:${user.id}`);
  }

  io.to('role:ADMIN').emit('presence:update', { onlineCount: onlineUsers.size });

  socket.on('join_project', (projectId: string) => {
    socket.join(`project:${projectId}`);
  });

  socket.on('disconnect', () => {
    const count = onlineUsers.get(user.id) || 1;
    if (count <= 1) {
      onlineUsers.delete(user.id);
    } else {
      onlineUsers.set(user.id, count - 1);
    }
    io.to('role:ADMIN').emit('presence:update', { onlineCount: onlineUsers.size });
  });
});

function broadcastActivity(activityData: any) {
  io.to('role:ADMIN').emit('activity:new', activityData);
  io.to(`role:PM:${activityData.managerId}`).emit('activity:new', activityData);
  if (activityData.developerId) {
    io.to(`role:DEV:${activityData.developerId}`).emit('activity:new', activityData);
  }
  io.to(`project:${activityData.projectId}`).emit('activity:new', activityData);
}

function sendLiveNotification(userId: string, notification: any, unreadCount: number) {
  io.to(`user:${userId}`).emit('notification:new', { notification, unreadCount });
}

// Background scheduler checking overdue tasks every minute
if (!process.env.VERCEL) {
  cron.schedule('* * * * *', async () => {
    try {
      const nowTime = new Date();
      mockTasks.forEach((t) => {
        if (new Date(t.dueDate) < nowTime && t.status !== 'DONE') {
          t.isOverdue = true;
        }
      });
    } catch (error) {}
  });
}

// Server Middleware Configuration
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Authentication Endpoints
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

app.post('/api/auth/login', async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: { message: 'Invalid credentials format', code: 'VALIDATION_ERROR' } });
  }

  const { email, password } = parsed.data;
  try {
    const user = await findUserByEmail(email);

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ success: false, error: { message: 'Invalid email or password', code: 'INVALID_CREDENTIALS' } });
    }

    const tokenPayload: AuthUser = { id: user.id, email: user.email, role: user.role, name: user.name };
    const accessToken = jwt.sign(tokenPayload, config.jwtAccessSecret, { expiresIn: '15m' });
    const refreshToken = jwt.sign({ id: user.id }, config.jwtRefreshSecret, { expiresIn: '7d' });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.json({ success: true, data: { accessToken, user: tokenPayload } });
  } catch (error) {
    return res.status(500).json({ success: false, error: { message: 'Server authentication error', code: 'SERVER_ERROR' } });
  }
});

app.post('/api/auth/refresh', async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.refreshToken;
  if (!refreshToken) return res.status(401).json({ success: false, error: { message: 'Missing refresh token', code: 'UNAUTHORIZED' } });

  try {
    const decoded = jwt.verify(refreshToken, config.jwtRefreshSecret) as { id: string };
    const user = await findUserById(decoded.id);

    if (!user) return res.status(401).json({ success: false, error: { message: 'User not found', code: 'UNAUTHORIZED' } });

    const tokenPayload: AuthUser = { id: user.id, email: user.email, role: user.role, name: user.name };
    const accessToken = jwt.sign(tokenPayload, config.jwtAccessSecret, { expiresIn: '15m' });
    return res.json({ success: true, data: { accessToken, user: tokenPayload } });
  } catch (error) {
    return res.status(401).json({ success: false, error: { message: 'Expired refresh token', code: 'INVALID_TOKEN' } });
  }
});

app.post('/api/auth/logout', (req: Request, res: Response) => {
  res.clearCookie('refreshToken', { httpOnly: true, sameSite: 'lax' });
  return res.json({ success: true, message: 'Logged out successfully' });
});

app.get('/api/auth/me', authenticateToken, (req: Request, res: Response) => {
  return res.json({ success: true, data: req.user });
});

app.get('/api/users', authenticateToken, async (req: Request, res: Response) => {
  const { role } = req.query;
  try {
    let users = mockUsers.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role }));
    if (role && typeof role === 'string') {
      users = users.filter((u) => u.role === role);
    }
    return res.json({ success: true, data: users });
  } catch (error) {
    return res.status(500).json({ success: false, error: { message: 'Failed to fetch users', code: 'SERVER_ERROR' } });
  }
});

// Clients & Projects Endpoints
app.get('/api/clients', authenticateToken, async (req: Request, res: Response) => {
  return res.json({ success: true, data: mockClients });
});

app.get('/api/projects', authenticateToken, async (req: Request, res: Response) => {
  const user = req.user!;
  try {
    let projects = [...mockProjects];
    if (user.role === 'PROJECT_MANAGER') {
      projects = projects.filter((p) => p.managerId === user.id);
    } else if (user.role === 'DEVELOPER') {
      const devTaskProjIds = mockTasks.filter((t) => t.developerId === user.id).map((t) => t.projectId);
      projects = projects.filter((p) => devTaskProjIds.includes(p.id));
    }

    const formatted = projects.map((p) => {
      const client = mockClients.find((c) => c.id === p.clientId);
      const manager = mockUsers.find((u) => u.id === p.managerId);
      const taskCount = mockTasks.filter((t) => t.projectId === p.id).length;
      return {
        ...p,
        client: client ? { id: client.id, name: client.name, company: client.company } : undefined,
        manager: manager ? { id: manager.id, name: manager.name, email: manager.email } : undefined,
        _count: { tasks: taskCount },
      };
    });

    return res.json({ success: true, data: formatted });
  } catch (error) {
    return res.status(500).json({ success: false, error: { message: 'Failed to fetch projects', code: 'SERVER_ERROR' } });
  }
});

app.get('/api/projects/:id', authenticateToken, async (req: Request, res: Response) => {
  const user = req.user!;
  const { id } = req.params;
  try {
    const project = mockProjects.find((p) => p.id === id);
    if (!project) return res.status(404).json({ success: false, error: { message: 'Project not found', code: 'NOT_FOUND' } });

    if (user.role === 'PROJECT_MANAGER' && project.managerId !== user.id) {
      return res.status(403).json({ success: false, error: { message: 'Forbidden', code: 'FORBIDDEN' } });
    }

    const client = mockClients.find((c) => c.id === project.clientId);
    const manager = mockUsers.find((u) => u.id === project.managerId);
    let projectTasks = mockTasks.filter((t) => t.projectId === project.id).map(hydrateTask);

    if (user.role === 'DEVELOPER') {
      projectTasks = projectTasks.filter((t) => t.developerId === user.id);
    }

    const data = {
      ...project,
      client,
      manager: manager ? { id: manager.id, name: manager.name, email: manager.email } : undefined,
      tasks: projectTasks,
    };

    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, error: { message: 'Failed to fetch project detail', code: 'SERVER_ERROR' } });
  }
});

const projectSchema = z.object({ name: z.string().min(2), description: z.string().min(2), clientId: z.string() });
app.post('/api/projects', authenticateToken, requireRoles('ADMIN', 'PROJECT_MANAGER'), async (req: Request, res: Response) => {
  const parsed = projectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: { message: 'Invalid data', code: 'VALIDATION_ERROR' } });

  try {
    const newPrj = {
      id: `prj-${Date.now()}`,
      name: parsed.data.name,
      description: parsed.data.description,
      clientId: parsed.data.clientId,
      managerId: req.user!.id,
      createdAt: new Date(),
    };
    mockProjects.unshift(newPrj);

    const client = mockClients.find((c) => c.id === newPrj.clientId);
    const manager = mockUsers.find((u) => u.id === newPrj.managerId);

    return res.status(201).json({
      success: true,
      data: {
        ...newPrj,
        client,
        manager: manager ? { id: manager.id, name: manager.name, email: manager.email } : undefined,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: { message: 'Failed to create project', code: 'SERVER_ERROR' } });
  }
});

// Tasks & Activity Feed Endpoints
app.get('/api/tasks', authenticateToken, async (req: Request, res: Response) => {
  const user = req.user!;
  const { status, priority, projectId } = req.query;

  try {
    let filtered = [...mockTasks];
    if (user.role === 'PROJECT_MANAGER') {
      const pmProjIds = mockProjects.filter((p) => p.managerId === user.id).map((p) => p.id);
      filtered = filtered.filter((t) => pmProjIds.includes(t.projectId));
    } else if (user.role === 'DEVELOPER') {
      filtered = filtered.filter((t) => t.developerId === user.id);
    }

    if (status && typeof status === 'string') filtered = filtered.filter((t) => t.status === status);
    if (priority && typeof priority === 'string') filtered = filtered.filter((t) => t.priority === priority);
    if (projectId && typeof projectId === 'string') filtered = filtered.filter((t) => t.projectId === projectId);

    const data = filtered.map(hydrateTask);
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, error: { message: 'Failed to fetch tasks', code: 'SERVER_ERROR' } });
  }
});

const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string(),
  projectId: z.string(),
  developerId: z.string().optional().nullable(),
  priority: z.nativeEnum(Priority).default(Priority.MEDIUM),
  dueDate: z.string(),
});

app.post('/api/tasks', authenticateToken, requireRoles('ADMIN', 'PROJECT_MANAGER'), async (req: Request, res: Response) => {
  const parsed = createTaskSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: { message: 'Invalid data input', code: 'VALIDATION_ERROR' } });

  const { title, description, projectId, developerId, priority, dueDate } = parsed.data;
  const user = req.user!;

  try {
    const project = mockProjects.find((p) => p.id === projectId);
    if (!project) return res.status(404).json({ success: false, error: { message: 'Project not found', code: 'NOT_FOUND' } });

    const dueDateObj = new Date(dueDate);
    const newTask = {
      id: `tsk-${Date.now()}`,
      title,
      description,
      projectId,
      developerId: developerId || null,
      priority,
      dueDate: dueDateObj.toISOString(),
      isOverdue: dueDateObj < new Date(),
      status: 'TO_DO',
      createdAt: new Date(),
    };
    mockTasks.unshift(newTask);

    const activity = {
      id: `act-${Date.now()}`,
      taskId: newTask.id,
      userId: user.id,
      action: 'CREATED',
      oldStatus: null,
      newStatus: 'TO_DO',
      timestamp: new Date(),
    };
    mockActivities.unshift(activity);

    if (developerId) {
      const notification = {
        id: `not-${Date.now()}`,
        userId: developerId,
        title: 'New Task Assigned',
        message: `Assigned "${newTask.title}" in ${project.name}`,
        isRead: false,
        createdAt: new Date(),
      };
      mockNotifications.unshift(notification);
      const unreadCount = mockNotifications.filter((n) => n.userId === developerId && !n.isRead).length;
      sendLiveNotification(developerId, notification, unreadCount);
    }

    return res.status(201).json({ success: true, data: hydrateTask(newTask) });
  } catch (error) {
    return res.status(500).json({ success: false, error: { message: 'Failed to create task', code: 'SERVER_ERROR' } });
  }
});

app.patch('/api/tasks/:id/status', authenticateToken, async (req: Request, res: Response) => {
  const { status: newStatus } = req.body;
  const user = req.user!;
  const { id } = req.params;

  try {
    const task = mockTasks.find((t) => t.id === id);
    if (!task) return res.status(404).json({ success: false, error: { message: 'Task not found', code: 'NOT_FOUND' } });

    const oldStatus = task.status;
    task.status = newStatus;

    const project = mockProjects.find((p) => p.id === task.projectId);
    const userObj = mockUsers.find((u) => u.id === user.id) || { name: user.name };

    const activity = {
      id: `act-${Date.now()}`,
      taskId: id,
      userId: user.id,
      action: 'STATUS_CHANGED',
      oldStatus,
      newStatus,
      timestamp: new Date(),
    };
    mockActivities.unshift(activity);

    const textFormatted = `${userObj.name} moved "${task.title}" from ${formatStatus(oldStatus)} → ${formatStatus(newStatus)}`;

    if (project) {
      broadcastActivity({
        id: activity.id,
        taskId: task.id,
        taskTitle: task.title,
        userName: userObj.name,
        action: 'STATUS_CHANGED',
        oldStatus,
        newStatus,
        timestamp: activity.timestamp,
        textFormatted,
        projectId: task.projectId,
        managerId: project.managerId,
        developerId: task.developerId,
      });

      if (newStatus === 'IN_REVIEW') {
        const pmUserId = project.managerId;
        const notification = {
          id: `not-${Date.now()}`,
          userId: pmUserId,
          title: 'Task Ready for Review',
          message: `Task "${task.title}" is in review`,
          isRead: false,
          createdAt: new Date(),
        };
        mockNotifications.unshift(notification);
        const unreadCount = mockNotifications.filter((n) => n.userId === pmUserId && !n.isRead).length;
        sendLiveNotification(pmUserId, notification, unreadCount);
      }
    }

    return res.json({ success: true, data: hydrateTask(task) });
  } catch (error) {
    return res.status(500).json({ success: false, error: { message: 'Failed to update task status', code: 'SERVER_ERROR' } });
  }
});

app.get('/api/activity', authenticateToken, async (req: Request, res: Response) => {
  const user = req.user!;
  try {
    let activities = [...mockActivities];
    if (user.role === 'PROJECT_MANAGER') {
      const pmProjIds = mockProjects.filter((p) => p.managerId === user.id).map((p) => p.id);
      activities = activities.filter((a) => {
        const task = mockTasks.find((t) => t.id === a.taskId);
        return task && pmProjIds.includes(task.projectId);
      });
    } else if (user.role === 'DEVELOPER') {
      activities = activities.filter((a) => {
        const task = mockTasks.find((t) => t.id === a.taskId);
        return task && task.developerId === user.id;
      });
    }

    const formatted = activities.slice(0, 20).map((act) => {
      const u = mockUsers.find((usr) => usr.id === act.userId) || { name: 'User' };
      const t = mockTasks.find((tsk) => tsk.id === act.taskId) || { title: 'Task', projectId: '', developerId: null };
      const p = mockProjects.find((prj) => prj.id === t.projectId) || { managerId: '' };

      return {
        id: act.id,
        taskId: act.taskId,
        taskTitle: t.title,
        userName: u.name,
        action: act.action,
        oldStatus: act.oldStatus,
        newStatus: act.newStatus,
        timestamp: act.timestamp,
        textFormatted: `${u.name} moved "${t.title}" from ${formatStatus(act.oldStatus)} → ${formatStatus(act.newStatus)}`,
        projectId: t.projectId,
        managerId: p.managerId,
        developerId: t.developerId,
      };
    });

    return res.json({ success: true, data: formatted });
  } catch (error) {
    return res.status(500).json({ success: false, error: { message: 'Failed to fetch activity feed', code: 'SERVER_ERROR' } });
  }
});

// Dashboard Analytics & Notifications
app.get('/api/dashboard/stats', authenticateToken, async (req: Request, res: Response) => {
  const user = req.user!;
  try {
    if (user.role === 'ADMIN') {
      const totalProjects = mockProjects.length;
      const totalTasks = mockTasks.length;
      const tasksByStatus = { TO_DO: 0, IN_PROGRESS: 0, IN_REVIEW: 0, DONE: 0 };
      mockTasks.forEach((t) => {
        if (tasksByStatus[t.status as keyof typeof tasksByStatus] !== undefined) {
          tasksByStatus[t.status as keyof typeof tasksByStatus]++;
        }
      });
      const overdueTaskCount = mockTasks.filter((t) => t.isOverdue && t.status !== 'DONE').length;

      return res.json({
        success: true,
        data: { role: 'ADMIN', totalProjects, totalTasks, tasksByStatus, overdueTaskCount, activeUsersOnline: onlineUsers.size || 1 },
      });
    }

    if (user.role === 'PROJECT_MANAGER') {
      const pmProjects = mockProjects.filter((p) => p.managerId === user.id);
      const projectIds = pmProjects.map((p) => p.id);
      const tasksByPriority = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
      mockTasks.filter((t) => projectIds.includes(t.projectId)).forEach((t) => {
        if (tasksByPriority[t.priority as keyof typeof tasksByPriority] !== undefined) {
          tasksByPriority[t.priority as keyof typeof tasksByPriority]++;
        }
      });

      return res.json({
        success: true,
        data: { role: 'PROJECT_MANAGER', totalProjects: pmProjects.length, tasksByPriority, upcomingDueTasks: [] },
      });
    }

    if (user.role === 'DEVELOPER') {
      const assignedTasks = mockTasks.filter((t) => t.developerId === user.id).map(hydrateTask);
      return res.json({ success: true, data: { role: 'DEVELOPER', totalAssigned: assignedTasks.length, tasks: assignedTasks } });
    }

    return res.status(400).json({ success: false, error: { message: 'Invalid user role', code: 'INVALID_ROLE' } });
  } catch (error) {
    return res.status(500).json({ success: false, error: { message: 'Failed to fetch dashboard stats', code: 'SERVER_ERROR' } });
  }
});

app.get('/api/notifications', authenticateToken, async (req: Request, res: Response) => {
  const user = req.user!;
  try {
    const userNotifications = mockNotifications.filter((n) => n.userId === user.id);
    const unreadCount = userNotifications.filter((n) => !n.isRead).length;
    return res.json({ success: true, data: { notifications: userNotifications, unreadCount } });
  } catch (error) {
    return res.status(500).json({ success: false, error: { message: 'Failed to fetch notifications', code: 'SERVER_ERROR' } });
  }
});

app.patch('/api/notifications/read', authenticateToken, async (req: Request, res: Response) => {
  const user = req.user!;
  const { notificationId, markAll } = req.body;
  try {
    if (markAll) {
      mockNotifications.forEach((n) => {
        if (n.userId === user.id) n.isRead = true;
      });
    } else if (notificationId) {
      const notification = mockNotifications.find((n) => n.id === notificationId && n.userId === user.id);
      if (notification) notification.isRead = true;
    }
    const unreadCount = mockNotifications.filter((n) => n.userId === user.id && !n.isRead).length;
    return res.json({ success: true, data: { unreadCount } });
  } catch (error) {
    return res.status(500).json({ success: false, error: { message: 'Failed to update notification read status', code: 'SERVER_ERROR' } });
  }
});

// Centralized Express Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[Server Error]', err);
  return res.status(err.status || 500).json({
    success: false,
    error: { message: err.message || 'Internal server error', code: err.code || 'INTERNAL_ERROR' },
  });
});

if (!process.env.VERCEL) {
  server.listen(config.port, () => {
    console.log(`[Server] Agency Dashboard Backend running on http://localhost:${config.port}`);
  });
}

export default app;
