import { PrismaClient, Role, TaskStatus, Priority } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Clear existing data
  await prisma.notification.deleteMany();
  await prisma.taskActivity.deleteMany();
  await prisma.task.deleteMany();
  await prisma.project.deleteMany();
  await prisma.client.deleteMany();
  await prisma.user.deleteMany();

  const defaultPasswordHash = await bcrypt.hash('password123', 10);

  // 1 Admin, 2 PMs, 4 Developers
  const admin = await prisma.user.create({
    data: {
      email: 'admin@agency.com',
      name: 'Alice Admin',
      passwordHash: defaultPasswordHash,
      role: Role.ADMIN,
    },
  });

  const pm1 = await prisma.user.create({
    data: {
      email: 'pm1@agency.com',
      name: 'Peter Manager',
      passwordHash: defaultPasswordHash,
      role: Role.PROJECT_MANAGER,
    },
  });

  const pm2 = await prisma.user.create({
    data: {
      email: 'pm2@agency.com',
      name: 'Pamela Boss',
      passwordHash: defaultPasswordHash,
      role: Role.PROJECT_MANAGER,
    },
  });

  const dev1 = await prisma.user.create({
    data: {
      email: 'dev1@agency.com',
      name: 'Ravi Kumar',
      passwordHash: defaultPasswordHash,
      role: Role.DEVELOPER,
    },
  });

  const dev2 = await prisma.user.create({
    data: {
      email: 'dev2@agency.com',
      name: 'Sarah Connor',
      passwordHash: defaultPasswordHash,
      role: Role.DEVELOPER,
    },
  });

  const dev3 = await prisma.user.create({
    data: {
      email: 'dev3@agency.com',
      name: 'David Chen',
      passwordHash: defaultPasswordHash,
      role: Role.DEVELOPER,
    },
  });

  const dev4 = await prisma.user.create({
    data: {
      email: 'dev4@agency.com',
      name: 'Emma Watson',
      passwordHash: defaultPasswordHash,
      role: Role.DEVELOPER,
    },
  });

  // Create Clients
  const clientA = await prisma.client.create({
    data: {
      name: 'Acme Corp',
      company: 'Acme International',
      email: 'contact@acme.com',
    },
  });

  const clientB = await prisma.client.create({
    data: {
      name: 'TechStart Inc',
      company: 'TechStart Global',
      email: 'hello@techstart.io',
    },
  });

  // Create 3 Projects (2 owned by PM1, 1 owned by PM2)
  const project1 = await prisma.project.create({
    data: {
      name: 'E-Commerce Platform Redesign',
      description: 'Full stack redesign of online store frontend and checkout flow',
      clientId: clientA.id,
      managerId: pm1.id,
    },
  });

  const project2 = await prisma.project.create({
    data: {
      name: 'Mobile Banking SDK',
      description: 'Secure iOS and Android SDK integration for financial institution',
      clientId: clientB.id,
      managerId: pm1.id,
    },
  });

  const project3 = await prisma.project.create({
    data: {
      name: 'AI Analytics Dashboard',
      description: 'Real-time telemetry and predictive models dashboard',
      clientId: clientA.id,
      managerId: pm2.id,
    },
  });

  const now = new Date();
  const pastDate1 = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000); // 5 days overdue
  const pastDate2 = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000); // 2 days overdue
  const futureDate1 = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const futureDate2 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Project 1 Tasks (5 tasks, including 1 overdue)
  const p1Tasks = [
    { title: 'Setup Authentication & JWT', desc: 'Implement refresh tokens in HttpOnly cookie', dev: dev1, status: TaskStatus.DONE, priority: Priority.CRITICAL, due: futureDate1, overdue: false },
    { title: 'Design Product Catalog Grid', desc: 'Responsive grid layout with Tailwind', dev: dev2, status: TaskStatus.IN_PROGRESS, priority: Priority.HIGH, due: futureDate1, overdue: false },
    { title: 'Stripe Payment Gateway Sync', desc: 'Integrate Webhook handlers for invoice paid events', dev: dev1, status: TaskStatus.IN_REVIEW, priority: Priority.CRITICAL, due: pastDate1, overdue: true },
    { title: 'Shopping Cart State Management', desc: 'Zustand store persistent state', dev: dev3, status: TaskStatus.TO_DO, priority: Priority.MEDIUM, due: futureDate2, overdue: false },
    { title: 'SEO Optimization & Sitemap', desc: 'Next.js meta headers and dynamic sitemap xml', dev: dev4, status: TaskStatus.TO_DO, priority: Priority.LOW, due: futureDate2, overdue: false },
  ];

  // Project 2 Tasks (5 tasks, including 1 overdue)
  const p2Tasks = [
    { title: 'Biometric Login Module', desc: 'Face ID and Fingerprint hardware authentication', dev: dev2, status: TaskStatus.IN_REVIEW, priority: Priority.CRITICAL, due: pastDate2, overdue: true },
    { title: 'OAuth2 Refresh Token Flow', desc: 'Handle auto renewal of expired access tokens', dev: dev1, status: TaskStatus.IN_PROGRESS, priority: Priority.HIGH, due: futureDate1, overdue: false },
    { title: 'Account Balance Websockets', desc: 'Live socket stream for ledger balances', dev: dev3, status: TaskStatus.TO_DO, priority: Priority.MEDIUM, due: futureDate2, overdue: false },
    { title: 'Unit Tests for Encryption', desc: '100% coverage on AES-256 payload cipher', dev: dev4, status: TaskStatus.DONE, priority: Priority.HIGH, due: pastDate1, overdue: false },
    { title: 'Push Notification Dispatcher', desc: 'Firebase Cloud Messaging integration', dev: dev2, status: TaskStatus.TO_DO, priority: Priority.LOW, due: futureDate2, overdue: false },
  ];

  // Project 3 Tasks (5 tasks)
  const p3Tasks = [
    { title: 'Timeseries Data Ingestion', desc: 'High-throughput Kafka / Redis consumer', dev: dev3, status: TaskStatus.IN_PROGRESS, priority: Priority.CRITICAL, due: futureDate1, overdue: false },
    { title: 'Rechart Analytics Visualization', desc: 'Interactive area chart and line chart components', dev: dev4, status: TaskStatus.IN_REVIEW, priority: Priority.HIGH, due: futureDate1, overdue: false },
    { title: 'Export PDF Report Generator', desc: 'Puppeteer serverless report generator', dev: dev3, status: TaskStatus.TO_DO, priority: Priority.MEDIUM, due: futureDate2, overdue: false },
    { title: 'Custom Threshold Alert System', desc: 'Email alerts when metric spikes above 90%', dev: dev1, status: TaskStatus.TO_DO, priority: Priority.HIGH, due: futureDate2, overdue: false },
    { title: 'User Permissions RBAC Grid', desc: 'Fine-grained ACL matrix UI', dev: dev2, status: TaskStatus.DONE, priority: Priority.LOW, due: futureDate1, overdue: false },
  ];

  const allTasksData = [
    ...p1Tasks.map(t => ({ ...t, projectId: project1.id })),
    ...p2Tasks.map(t => ({ ...t, projectId: project2.id })),
    ...p3Tasks.map(t => ({ ...t, projectId: project3.id })),
  ];

  for (const t of allTasksData) {
    const task = await prisma.task.create({
      data: {
        title: t.title,
        description: t.desc,
        projectId: t.projectId,
        developerId: t.dev.id,
        status: t.status,
        priority: t.priority,
        dueDate: t.due,
        isOverdue: t.overdue,
      },
    });

    // Create seed activity entries so activity feed is populated on first load
    await prisma.taskActivity.create({
      data: {
        taskId: task.id,
        userId: t.dev.id,
        action: 'STATUS_CHANGED',
        oldStatus: TaskStatus.TO_DO,
        newStatus: t.status,
        timestamp: new Date(now.getTime() - Math.floor(Math.random() * 3600000 * 12)),
      },
    });
  }

  // Pre-seed Notifications
  await prisma.notification.create({
    data: {
      userId: dev1.id,
      title: 'New Task Assigned',
      message: 'You were assigned task "Setup Authentication & JWT" in project E-Commerce Platform Redesign',
      isRead: false,
    },
  });

  await prisma.notification.create({
    data: {
      userId: pm1.id,
      title: 'Task Ready for Review',
      message: 'Task "Stripe Payment Gateway Sync" was moved to In Review by Ravi Kumar',
      isRead: false,
    },
  });

  console.log('Seed completed successfully!');
  console.log('Demo Credentials:');
  console.log('Admin: admin@agency.com / password123');
  console.log('PM 1: pm1@agency.com / password123');
  console.log('PM 2: pm2@agency.com / password123');
  console.log('Dev 1: dev1@agency.com / password123');
  console.log('Dev 2: dev2@agency.com / password123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
