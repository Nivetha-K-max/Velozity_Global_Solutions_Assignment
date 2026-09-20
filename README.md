# Velozity Global Solutions - Real-Time Client Project Dashboard

A full-stack agency project management web application built with **React**, **TypeScript**, **Node.js (Express)**, **Prisma ORM**, **PostgreSQL**, **Socket.io**, and **node-cron**. Features role-based access control (RBAC), WebSocket live activity stream, presence tracking, automated background overdue task management, and shareable URL query filtering.

---

## 🚀 Quick Setup Instructions

### Prerequisites
- Node.js (v18+) & npm
- PostgreSQL database (or Docker Desktop)

### Option 1: Direct Local PostgreSQL Setup (Recommended)
1. **Clone repository & install dependencies**:
   ```bash
   # Install Backend Dependencies
   cd backend
   npm install

   # Install Frontend Dependencies
   cd ../frontend
   npm install
   ```

2. **Configure Database Environment**:
   In `backend/.env`:
   ```env
   PORT=5000
   DATABASE_URL="postgresql://postgres:Nivi-1627@localhost:5432/velozity_db?schema=public"
   JWT_ACCESS_SECRET="velozity_access_secret_key_2026_super_secure"
   JWT_REFRESH_SECRET="velozity_refresh_secret_key_2026_super_secure"
   CLIENT_URL="http://localhost:5173"
   ```

3. **Push Prisma Schema & Seed Database**:
   ```bash
   cd backend
   npx prisma db push
   npm run seed
   ```

4. **Run Application**:
   - Backend Dev Server: `npm run dev` (Runs on `http://localhost:5000`)
   - Frontend Dev Server: `cd ../frontend && npm run dev` (Runs on `http://localhost:5173`)

### Option 2: Docker Setup
```bash
docker-compose up -d
```

---

## 🔑 Pre-Seeded Evaluation Credentials

All accounts use password: `password123`

| Role | Email | Access Rights |
| :--- | :--- | :--- |
| **Admin** | `admin@agency.com` | Full Access — View all projects, tasks, global live activity stream & live online user presence count |
| **Project Manager 1** | `pm1@agency.com` | Manages 2 Projects — View and manage owned projects & team activity only |
| **Project Manager 2** | `pm2@agency.com` | Manages 1 Project — View and manage owned projects & team activity only |
| **Developer 1** | `dev1@agency.com` | Developer View — View assigned tasks only, update task status |
| **Developer 2** | `dev2@agency.com` | Developer View — View assigned tasks only, update task status |

*Note: The login page includes quick 1-click evaluation sign-in buttons for instant testing.*

---

## 🗄️ Database Schema & Indexing Rationale

### Schema Models & Relationships
- **`User`**: `id`, `email`, `passwordHash`, `name`, `role` (`ADMIN`, `PROJECT_MANAGER`, `DEVELOPER`).
- **`Client`**: `id`, `name`, `company`, `email`.
- **`Project`**: `id`, `name`, `description`, `clientId` (FK -> Client), `managerId` (FK -> User).
- **`Task`**: `id`, `title`, `description`, `projectId` (FK -> Project), `developerId` (FK -> User, nullable), `status`, `priority`, `dueDate`, `isOverdue` (Boolean).
- **`TaskActivity`**: `id`, `taskId` (FK -> Task), `userId` (FK -> User), `action`, `oldStatus`, `newStatus`, `timestamp`.
- **`Notification`**: `id`, `userId` (FK -> User), `title`, `message`, `isRead`, `createdAt`.

### Indexing Decisions
- `Task(projectId)` & `Task(developerId)`: High-frequency foreign key lookups when filtering tasks per project or per developer.
- `Task(status)` & `Task(priority)` & `Task(dueDate)`: Optimizes query parameter URL filtering (`?status=IN_PROGRESS&priority=HIGH`).
- `TaskActivity(taskId)` & `TaskActivity(timestamp)`: Speeds up recent 20 activity catchup queries for offline users.
- `Notification(userId, isRead)`: Composite index for instant unread badge count lookups.

---

## 🏗️ Architectural Decisions

1. **WebSocket Library (Socket.io vs Native WebSocket)**:
   - *Choice*: **Socket.io**.
   - *Justification*: Socket.io provides out-of-the-box room management (`socket.join("role:PM:id")`), automatic reconnection handling, heartbeat keep-alive, and connection authentication middleware.

2. **Background Jobs (node-cron vs Bull queue)**:
   - *Choice*: **node-cron**.
   - *Justification*: `node-cron` is lightweight, self-contained, and perfectly suited for periodic recurring database updates (checking overdue tasks every minute) without requiring extra Redis server infrastructure.

3. **Token Storage & Security**:
   - *Choice*: Short-lived **Access Token (15m)** in memory/Authorization header + **Refresh Token (7d)** in `HttpOnly`, `SameSite=Lax` cookie.
   - *Justification*: Storing refresh tokens in `HttpOnly` cookies completely mitigates XSS token theft risks compared to `localStorage`.

4. **Shareable URL Query Param Filters**:
   - Filters on the task page (`status`, `priority`, `projectId`) sync directly with React Router's `useSearchParams`, allowing filtered views to be copied and shared directly as URLs.

---

## 📝 Technical Assessment Explanation (150–250 Words)

> **Hardest Problem Solved**:
> Designing a robust real-time activity feed that guarantees zero state duplication across role boundaries while preserving offline catchup. Ensuring that connected clients receive live status transitions while disconnected clients receive the exact top 20 missed events directly from PostgreSQL upon reconnection required careful synchronization between database transaction logs and Socket.io event channels.
>
> **Handling the Real-Time Role-Filtered Feed**:
> Role filtering is enforced both at the database query level and the WebSocket transport layer. When a user logs in or connects to the Socket.io server, their JWT token is decoded to attach them to specific channels (`role:ADMIN`, `role:PM:<id>`, `role:DEV:<id>`, and `project:<id>`). When a status update occurs, `broadcastActivity()` evaluates recipient eligibility and dispatches the payload strictly to relevant room channels. Non-admin users are physically incapable of receiving event streams for projects outside their permission scope.
>
> **What I Would Do Differently**:
> If building for high-scale multi-node production deployment, I would replace `node-cron` with a distributed task queue like **BullMQ** backed by **Redis**, and use Socket.io's **Redis Adapter** to ensure WebSocket presence and room events broadcast seamlessly across multiple load-balanced server instances.

---

## 📚 Code Walkthrough & Learning Guide

### 1. How It Works & Approach Rationale
- **Authentication**: When a user logs in, the server sets an `HttpOnly` cookie containing a refresh token and returns a short-lived access token. The React frontend stores this access token in memory (`AuthContext`) and automatically calls `/api/auth/refresh` on page reload.
- **Role Enforcement**: Every API endpoint uses middleware (`requireRoles('ADMIN', 'PROJECT_MANAGER')`). In addition, SQL queries dynamically inject ownership checks (`where: { managerId: user.id }` for PMs; `where: { developerId: user.id }` for Developers).
- **Real-Time Sync**: When a task status changes, the server writes an immutable `TaskActivity` record to PostgreSQL, triggers an in-app `Notification` if needed, and broadcasts a formatted WebSocket message to target room channels.

### 2. Key Concepts to Master
1. **JWT Auth Pair & HttpOnly Cookie**: Understanding why refresh tokens belong in `HttpOnly` cookies while access tokens stay in memory.
2. **Socket.io Room Subscriptions**: How `socket.join('role:PM:123')` segregates real-time event broadcasting.
3. **Database-Backed Activity Logging**: Recording explicit timestamped audit logs (`TaskActivity`) instead of deriving state history on the fly.
4. **Declarative URL Filter Sync**: Using `useSearchParams` in React to make UI state shareable via URLs.

### 3. Common Beginner Mistakes
- **Frontend-only role hiding**: Only hiding buttons in React while leaving API endpoints unprotected. *Solution*: Always enforce role security inside Express route middleware.
- **Missing WebSocket room isolation**: Emitting events via `io.emit()` globally to all users. *Solution*: Always target rooms using `io.to(room).emit()`.

### 4. Recommended Self-Implementation Exercise
> **Exercise**: Try deleting `backend/src/routes/tasks.ts` (specifically the `PATCH /:id/status` route handler) and re-implementing it from scratch!
> - Verify user permissions (Developer vs PM vs Admin).
> - Update `status` in `prisma.task`.
> - Create a `prisma.taskActivity` entry with `oldStatus` and `newStatus`.
> - Call `broadcastActivity()` to trigger real-time updates.
