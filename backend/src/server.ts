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

// ---------------------------------------------------------------------------
// 1. CONFIGURATION & DATABASE SETUP
// ---------------------------------------------------------------------------
const config = {
  port: process.env.PORT || 5000,
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || 'velozity_access_secret_key_2026_super_secure',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'velozity_refresh_secret_key_2026_super_secure',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
};

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// 2. TYPES & MIDDLEWARES
// ---------------------------------------------------------------------------
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

function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      error: { message: 'Authentication token is missing', code: 'UNAUTHORIZED' },
    });
  }

  try {
    const payload = jwt.verify(token, config.jwtAccessSecret) as AuthUser;
    req.user = payload;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: { message: 'Invalid or expired access token', code: 'INVALID_TOKEN' },
    });
  }
}

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
        error: { message: 'Forbidden: Insufficient permissions for this action', code: 'FORBIDDEN' },
      });
    }

    next();
  };
}

// Helper for status label formatting
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

// ---------------------------------------------------------------------------
// 3. EXPRESS APP & SOCKET.IO SETUP
// ---------------------------------------------------------------------------
const app = express();
const server = http.createServer(app);

const io = new SocketIOServer(server, {
  cors: {
    origin: config.clientUrl,
    credentials: true,
  },
});

const onlineUsers = new Map<string, number>();

interface AuthenticatedSocket extends Socket {
  user?: AuthUser;
}

io.use((socket: AuthenticatedSocket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Authentication token missing'));

  try {
    const decoded = jwt.verify(token, config.jwtAccessSecret) as AuthUser;
    socket.user = decoded;
    next();
  } catch (err) {
    next(new Error('Authentication error'));
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

function broadcastActivity(activityData: {
  id: string;
  taskId: string;
  taskTitle: string;
  userName: string;
  action: string;
  oldStatus: string | null;
  newStatus: string | null;
  timestamp: Date;
  textFormatted: string;
  projectId: string;
  managerId: string;
  developerId: string | null;
}) {
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

// ---------------------------------------------------------------------------
// 4. BACKGROUND CRON JOB
// ---------------------------------------------------------------------------
cron.schedule('* * * * *', async () => {
  try {
    const now = new Date();
    const result = await prisma.task.updateMany({
      where: { dueDate: { lt: now }, status: { not: 'DONE' }, isOverdue: false },
      data: { isOverdue: true },
    });
    if (result.count > 0) {
      console.log(`[Cron Job] Flagged ${result.count} tasks as overdue.`);
    }
  } catch (error) {
    console.error('[Cron Job Error]', error);
  }
});

// ---------------------------------------------------------------------------
// 5. MIDDLEWARES & API ENDPOINTS
// ---------------------------------------------------------------------------
app.use(cors({ origin: config.clientUrl, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// --- AUTH ENDPOINTS ---
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

app.post('/api/auth/login', async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: { message: 'Invalid format', code: 'VALIDATION_ERROR' } });
  }

  const { email, password } = parsed.data;
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ success: false, error: { message: 'Invalid credentials', code: 'INVALID_CREDENTIALS' } });
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
    return res.status(500).json({ success: false, error: { message: 'Auth server error', code: 'SERVER_ERROR' } });
  }
});

app.post('/api/auth/refresh', async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.refreshToken;
  if (!refreshToken) return res.status(401).json({ success: false, error: { message: 'No refresh token', code: 'UNAUTHORIZED' } });

  try {
    const decoded = jwt.verify(refreshToken, config.jwtRefreshSecret) as { id: string };
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
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
    const where: any = {};
    if (role && typeof role === 'string') where.role = role;
    const users = await prisma.user.findMany({ where, select: { id: true, name: true, email: true, role: true }, orderBy: { name: 'asc' } });
    return res.json({ success: true, data: users });
  } catch (error) {
    return res.status(500).json({ success: false, error: { message: 'Failed users fetch', code: 'SERVER_ERROR' } });
  }
});

// --- CLIENTS & PROJECTS ENDPOINTS ---
app.get('/api/clients', authenticateToken, async (req: Request, res: Response) => {
  try {
    const clients = await prisma.client.findMany({ orderBy: { name: 'asc' } });
    return res.json({ success: true, data: clients });
  } catch (error) {
    return res.status(500).json({ success: false, error: { message: 'Failed clients fetch', code: 'SERVER_ERROR' } });
  }
});

app.get('/api/projects', authenticateToken, async (req: Request, res: Response) => {
  const user = req.user!;
  try {
    let whereClause = {};
    if (user.role === 'PROJECT_MANAGER') whereClause = { managerId: user.id };
    else if (user.role === 'DEVELOPER') whereClause = { tasks: { some: { developerId: user.id } } };

    const projects = await prisma.project.findMany({
      where: whereClause,
      include: {
        client: { select: { id: true, name: true, company: true } },
        manager: { select: { id: true, name: true, email: true } },
        _count: { select: { tasks: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ success: true, data: projects });
  } catch (error) {
    return res.status(500).json({ success: false, error: { message: 'Failed projects fetch', code: 'SERVER_ERROR' } });
  }
});

app.get('/api/projects/:id', authenticateToken, async (req: Request, res: Response) => {
  const user = req.user!;
  const { id } = req.params;
  try {
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        client: true,
        manager: { select: { id: true, name: true, email: true } },
        tasks: { include: { developer: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: 'desc' } },
      },
    });

    if (!project) return res.status(404).json({ success: false, error: { message: 'Project not found', code: 'NOT_FOUND' } });
    if (user.role === 'PROJECT_MANAGER' && project.managerId !== user.id) {
      return res.status(403).json({ success: false, error: { message: 'Forbidden', code: 'FORBIDDEN' } });
    }
    if (user.role === 'DEVELOPER') {
      project.tasks = project.tasks.filter((t) => t.developerId === user.id);
    }
    return res.json({ success: true, data: project });
  } catch (error) {
    return res.status(500).json({ success: false, error: { message: 'Failed project detail fetch', code: 'SERVER_ERROR' } });
  }
});

const projectSchema = z.object({ name: z.string().min(2), description: z.string().min(2), clientId: z.string().uuid() });
app.post('/api/projects', authenticateToken, requireRoles('ADMIN', 'PROJECT_MANAGER'), async (req: Request, res: Response) => {
  const parsed = projectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: { message: 'Invalid data', code: 'VALIDATION_ERROR' } });

  try {
    const project = await prisma.project.create({
      data: { name: parsed.data.name, description: parsed.data.description, clientId: parsed.data.clientId, managerId: req.user!.id },
      include: { client: true, manager: { select: { id: true, name: true, email: true } } },
    });
    return res.status(201).json({ success: true, data: project });
  } catch (error) {
    return res.status(500).json({ success: false, error: { message: 'Failed project creation', code: 'SERVER_ERROR' } });
  }
});

// --- TASKS & ACTIVITY ENDPOINTS ---
app.get('/api/tasks', authenticateToken, async (req: Request, res: Response) => {
  const user = req.user!;
  const { status, priority, projectId } = req.query;

  try {
    const where: any = {};
    if (user.role === 'PROJECT_MANAGER') where.project = { managerId: user.id };
    else if (user.role === 'DEVELOPER') where.developerId = user.id;

    if (status && typeof status === 'string') where.status = status as TaskStatus;
    if (priority && typeof priority === 'string') where.priority = priority as Priority;
    if (projectId && typeof projectId === 'string') where.projectId = projectId;

    const tasks = await prisma.task.findMany({
      where,
      include: {
        project: { select: { id: true, name: true, managerId: true } },
        developer: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
    });
    return res.json({ success: true, data: tasks });
  } catch (error) {
    return res.status(500).json({ success: false, error: { message: 'Failed tasks fetch', code: 'SERVER_ERROR' } });
  }
});

const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string(),
  projectId: z.string().uuid(),
  developerId: z.string().uuid().optional().nullable(),
  priority: z.nativeEnum(Priority).default(Priority.MEDIUM),
  dueDate: z.string().datetime(),
});

app.post('/api/tasks', authenticateToken, requireRoles('ADMIN', 'PROJECT_MANAGER'), async (req: Request, res: Response) => {
  const parsed = createTaskSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: { message: 'Invalid data', code: 'VALIDATION_ERROR' } });

  const { title, description, projectId, developerId, priority, dueDate } = parsed.data;
  const user = req.user!;

  try {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return res.status(404).json({ success: false, error: { message: 'Project not found', code: 'NOT_FOUND' } });

    const dueDateObj = new Date(dueDate);
    const task = await prisma.task.create({
      data: { title, description, projectId, developerId: developerId || null, priority, dueDate: dueDateObj, isOverdue: dueDateObj < new Date() },
      include: { project: { select: { id: true, name: true, managerId: true } }, developer: { select: { id: true, name: true, email: true } } },
    });

    await prisma.taskActivity.create({ data: { taskId: task.id, userId: user.id, action: 'CREATED', newStatus: task.status } });

    if (developerId) {
      const notification = await prisma.notification.create({
        data: { userId: developerId, title: 'New Task Assigned', message: `Assigned "${task.title}" in ${project.name}` },
      });
      const unreadCount = await prisma.notification.count({ where: { userId: developerId, isRead: false } });
      sendLiveNotification(developerId, notification, unreadCount);
    }

    return res.status(201).json({ success: true, data: task });
  } catch (error) {
    return res.status(500).json({ success: false, error: { message: 'Failed task creation', code: 'SERVER_ERROR' } });
  }
});

app.patch('/api/tasks/:id/status', authenticateToken, async (req: Request, res: Response) => {
  const { status: newStatus } = req.body;
  const user = req.user!;
  const { id } = req.params;

  try {
    const existingTask = await prisma.task.findUnique({
      where: { id },
      include: { project: { select: { id: true, name: true, managerId: true } } },
    });
    if (!existingTask) return res.status(404).json({ success: false, error: { message: 'Task not found', code: 'NOT_FOUND' } });

    const oldStatus = existingTask.status;
    const updatedTask = await prisma.task.update({
      where: { id },
      data: { status: newStatus },
      include: { project: { select: { id: true, name: true, managerId: true } }, developer: { select: { id: true, name: true, email: true } } },
    });

    const activity = await prisma.taskActivity.create({
      data: { taskId: id, userId: user.id, action: 'STATUS_CHANGED', oldStatus, newStatus },
      include: { user: { select: { id: true, name: true } } },
    });

    const textFormatted = `${user.name} moved "${updatedTask.title}" from ${formatStatus(oldStatus)} → ${formatStatus(newStatus)}`;

    broadcastActivity({
      id: activity.id,
      taskId: updatedTask.id,
      taskTitle: updatedTask.title,
      userName: user.name,
      action: 'STATUS_CHANGED',
      oldStatus,
      newStatus,
      timestamp: activity.timestamp,
      textFormatted,
      projectId: updatedTask.projectId,
      managerId: updatedTask.project.managerId,
      developerId: updatedTask.developerId,
    });

    if (newStatus === 'IN_REVIEW') {
      const pmUserId = updatedTask.project.managerId;
      const notification = await prisma.notification.create({
        data: { userId: pmUserId, title: 'Task Ready for Review', message: `Task "${updatedTask.title}" is in review` },
      });
      const unreadCount = await prisma.notification.count({ where: { userId: pmUserId, isRead: false } });
      sendLiveNotification(pmUserId, notification, unreadCount);
    }

    return res.json({ success: true, data: updatedTask });
  } catch (error) {
    return res.status(500).json({ success: false, error: { message: 'Failed status update', code: 'SERVER_ERROR' } });
  }
});

app.get('/api/activity', authenticateToken, async (req: Request, res: Response) => {
  const user = req.user!;
  try {
    let whereClause: any = {};
    if (user.role === 'PROJECT_MANAGER') whereClause = { task: { project: { managerId: user.id } } };
    else if (user.role === 'DEVELOPER') whereClause = { task: { developerId: user.id } };

    const activities = await prisma.taskActivity.findMany({
      where: whereClause,
      take: 20,
      orderBy: { timestamp: 'desc' },
      include: {
        user: { select: { id: true, name: true } },
        task: { select: { id: true, title: true, projectId: true, developerId: true, project: { select: { id: true, name: true, managerId: true } } } },
      },
    });

    const formatted = activities.map((act) => ({
      id: act.id,
      taskId: act.taskId,
      taskTitle: act.task.title,
      userName: act.user.name,
      action: act.action,
      oldStatus: act.oldStatus,
      newStatus: act.newStatus,
      timestamp: act.timestamp,
      textFormatted: `${act.user.name} moved "${act.task.title}" from ${formatStatus(act.oldStatus)} → ${formatStatus(act.newStatus)}`,
      projectId: act.task.projectId,
      managerId: act.task.project.managerId,
      developerId: act.task.developerId,
    }));

    return res.json({ success: true, data: formatted });
  } catch (error) {
    return res.status(500).json({ success: false, error: { message: 'Failed activity fetch', code: 'SERVER_ERROR' } });
  }
});

// --- DASHBOARD & NOTIFICATIONS ENDPOINTS ---
app.get('/api/dashboard/stats', authenticateToken, async (req: Request, res: Response) => {
  const user = req.user!;
  try {
    if (user.role === 'ADMIN') {
      const totalProjects = await prisma.project.count();
      const totalTasks = await prisma.task.count();
      const tasksByStatusGroup = await prisma.task.groupBy({ by: ['status'], _count: { _all: true } });
      const tasksByStatus = { TO_DO: 0, IN_PROGRESS: 0, IN_REVIEW: 0, DONE: 0 };
      tasksByStatusGroup.forEach((g) => { tasksByStatus[g.status] = g._count._all; });
      const overdueTaskCount = await prisma.task.count({ where: { isOverdue: true, status: { not: 'DONE' } } });

      return res.json({
        success: true,
        data: { role: 'ADMIN', totalProjects, totalTasks, tasksByStatus, overdueTaskCount, activeUsersOnline: onlineUsers.size },
      });
    }

    if (user.role === 'PROJECT_MANAGER') {
      const pmProjects = await prisma.project.findMany({ where: { managerId: user.id }, select: { id: true, name: true } });
      const projectIds = pmProjects.map((p) => p.id);
      const tasksByPriorityGroup = await prisma.task.groupBy({ by: ['priority'], where: { projectId: { in: projectIds } }, _count: { _all: true } });
      const tasksByPriority = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
      tasksByPriorityGroup.forEach((g) => { tasksByPriority[g.priority] = g._count._all; });

      return res.json({
        success: true,
        data: { role: 'PROJECT_MANAGER', totalProjects: pmProjects.length, tasksByPriority, upcomingDueTasks: [] },
      });
    }

    if (user.role === 'DEVELOPER') {
      const assignedTasks = await prisma.task.findMany({
        where: { developerId: user.id },
        include: { project: { select: { id: true, name: true } } },
        orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
      });
      return res.json({ success: true, data: { role: 'DEVELOPER', totalAssigned: assignedTasks.length, tasks: assignedTasks } });
    }

    return res.status(400).json({ success: false, error: { message: 'Invalid role', code: 'INVALID_ROLE' } });
  } catch (error) {
    return res.status(500).json({ success: false, error: { message: 'Failed stats fetch', code: 'SERVER_ERROR' } });
  }
});

app.get('/api/notifications', authenticateToken, async (req: Request, res: Response) => {
  const user = req.user!;
  try {
    const notifications = await prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 50 });
    const unreadCount = await prisma.notification.count({ where: { userId: user.id, isRead: false } });
    return res.json({ success: true, data: { notifications, unreadCount } });
  } catch (error) {
    return res.status(500).json({ success: false, error: { message: 'Failed notifications fetch', code: 'SERVER_ERROR' } });
  }
});

app.patch('/api/notifications/read', authenticateToken, async (req: Request, res: Response) => {
  const user = req.user!;
  const { notificationId, markAll } = req.body;
  try {
    if (markAll) {
      await prisma.notification.updateMany({ where: { userId: user.id, isRead: false }, data: { isRead: true } });
    } else if (notificationId) {
      await prisma.notification.update({ where: { id: notificationId, userId: user.id }, data: { isRead: true } });
    }
    const unreadCount = await prisma.notification.count({ where: { userId: user.id, isRead: false } });
    return res.json({ success: true, data: { unreadCount } });
  } catch (error) {
    return res.status(500).json({ success: false, error: { message: 'Failed read notification update', code: 'SERVER_ERROR' } });
  }
});

// ---------------------------------------------------------------------------
// 6. GLOBAL ERROR HANDLER & SERVER LISTEN
// ---------------------------------------------------------------------------
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[Unhandled Error]', err);
  return res.status(err.status || 500).json({
    success: false,
    error: { message: err.message || 'Server error', code: err.code || 'INTERNAL_ERROR' },
  });
});

server.listen(config.port, () => {
  console.log(`[Server] Agency Dashboard Backend running on http://localhost:${config.port}`);
});
