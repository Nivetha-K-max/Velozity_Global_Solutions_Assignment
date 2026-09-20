# Velozity Global Solutions - Real-Time Client Project Dashboard

A full-stack agency project management web application built with **React**, **TypeScript**, **Node.js (Express)**, **Prisma ORM**, **PostgreSQL**, **Socket.io**, and **node-cron**. 

Built for high performance with role-based access control (RBAC), WebSocket live activity broadcasting, online user presence tracking, background overdue task automation, and instant 1-click evaluation sign-in.

---

## 🚀 Setup Instructions

### Prerequisites
- Node.js (v18+) & npm
- PostgreSQL database

### 1. Clone & Install Dependencies
```bash
# Install Backend Dependencies
cd backend
npm install

# Install Frontend Dependencies
cd ../frontend
npm install
```

### 2. Configure Environment
In `backend/.env`:
```env
PORT=5001
DATABASE_URL="postgresql://postgres:Nivi-1627@localhost:5432/velozity_db?schema=public"
JWT_ACCESS_SECRET="velozity_access_secret_key_2026_super_secure"
JWT_REFRESH_SECRET="velozity_refresh_secret_key_2026_super_secure"
CLIENT_URL="http://localhost:5174"
```

### 3. Database Push & Seed
```bash
cd backend
npx prisma db push
npm run seed
```

### 4. Run Dev Servers
- **Backend Dev Server**: `cd backend && npm run dev` (Runs on `http://localhost:5001`)
- **Frontend Dev Server**: `cd frontend && npm run dev` (Runs on `http://localhost:5174`)

---

## 🔑 Pre-Seeded Evaluation Credentials

All accounts use password: `password123`

| Role | Email | Access Rights |
| :--- | :--- | :--- |
| **Admin** | `admin@agency.com` | Full Access — View all projects, tasks, global live activity stream & online user count |
| **Project Manager 1** | `pm1@agency.com` | Manages 2 Projects — View and manage owned projects & team activity only |
| **Project Manager 2** | `pm2@agency.com` | Manages 1 Project — View and manage owned projects & team activity only |
| **Developer** | `dev1@agency.com` | Developer View — View assigned tasks only, update task status |

*Note: The login page includes a side-by-side card with 1-click quick evaluation buttons for instant testing.*

---

## 📁 Project Architecture & Clean Structure

The project follows a minimal, non-fragmented architecture split into 2 primary directories:

```
Velozity_Global_Solutions/
├── backend/
│   ├── src/
│   │   └── server.ts         <-- Express server, JWT auth, Prisma queries, Socket.io & Cron
│   ├── package.json
│   └── prisma/
│       └── schema.prisma     <-- Database Schema & Indexing definitions
└── frontend/
    ├── src/
    │   ├── App.tsx           <-- Complete React UI (Side-by-side Login, Dashboard, Task Kanban, Live Feed)
    │   ├── main.tsx          <-- React entry point
    │   └── index.css         <-- Modern styling
    ├── index.html
    └── package.json
```

---

## 🗄️ Database Schema & Indexing Rationale

### Schema Models
- **`User`**: `id`, `email`, `passwordHash`, `name`, `role` (`ADMIN`, `PROJECT_MANAGER`, `DEVELOPER`).
- **`Client`**: `id`, `name`, `company`, `email`.
- **`Project`**: `id`, `name`, `description`, `clientId` (FK -> Client), `managerId` (FK -> User).
- **`Task`**: `id`, `title`, `description`, `projectId` (FK -> Project), `developerId` (FK -> User), `status`, `priority`, `dueDate`, `isOverdue` (Boolean).
- **`TaskActivity`**: `id`, `taskId` (FK -> Task), `userId` (FK -> User), `action`, `oldStatus`, `newStatus`, `timestamp`.
- **`Notification`**: `id`, `userId` (FK -> User), `title`, `message`, `isRead`, `createdAt`.

### Indexing Decisions
- `Task(projectId)` & `Task(developerId)`: High-frequency lookups when filtering tasks per project or developer.
- `Task(status)` & `Task(priority)` & `Task(dueDate)`: Optimizes query parameter filtering.
- `TaskActivity(taskId)` & `TaskActivity(timestamp)`: Fast historical activity queries.
- `Notification(userId, isRead)`: Composite index for unread badge count lookups.

---

## 🏗️ Technical Decisions & Implementation Notes

1. **WebSocket Library (Socket.io)**:
   - Provides out-of-the-box room management (`socket.join("role:PM:id")`), automatic reconnection handling, and JWT socket connection middleware.

2. **Background Jobs (node-cron)**:
   - Lightweight, self-contained background job running every minute to flag overdue tasks automatically without requiring external queue infrastructure.

3. **Token Security**:
   - Short-lived **Access Token (15m)** in memory + **Refresh Token (7d)** stored in secure `HttpOnly`, `SameSite=Lax` cookies to prevent XSS token theft.

---

## 📝 Technical Assessment Summary

> **Hardest Problem Solved**:
> Designing a real-time role-filtered activity stream that guarantees zero event leaking across role boundaries while supporting offline catchup. Connected clients receive live status transitions targeted specifically to their rooms (`role:ADMIN`, `role:PM:<id>`, `role:DEV:<id>`), while reconnected clients fetch their top 20 role-scoped events from PostgreSQL.
>
> **What I Would Do Differently**:
> For multi-region enterprise scaling, I would replace `node-cron` with **BullMQ** backed by **Redis** and add Socket.io's **Redis Adapter** to support horizontal scaling across load-balanced server clusters.
