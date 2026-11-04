import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import driverRoutes from './routes/driver.routes';
import vehicleRoutes from './routes/vehicle.routes';
import partyRoutes from './routes/party.routes';
import unitRoutes from './routes/unit.routes';
import routeRoutes from './routes/route.routes';
import freightRateRoutes from './routes/freightRate.routes';
import expenseRateRoutes from './routes/expenseRate.routes';
import tripRoutes from './routes/trip.routes';
import paymentRoutes from './routes/payment.routes';
import expenseRoutes from './routes/expense.routes';
import settlementRoutes from './routes/settlement.routes';
import reportRoutes from './routes/report.routes';
import auditLogRoutes from './routes/auditLog.routes';
import dashboardRoutes from './routes/dashboard.routes';
import ownerRoutes from './routes/owner.routes';
import cleaningExpenseRoutes from './routes/cleaningExpense.routes';
import ownerAdvanceRoutes from './routes/ownerAdvance.routes';
import truckAdvanceRoutes from './routes/truckAdvance.routes';
import unloadingRateRoutes from './routes/unloadingRate.routes';
import driverBataRateRoutes from './routes/driverBataRate.routes';
import otherExpenseLimitRoutes from './routes/otherExpenseLimit.routes';
import driverAdvanceRoutes from './routes/driverAdvance.routes';

import { errorHandler, notFound } from './middleware/errorHandler';
import { auditRequestContext, normalizeAuditPlatform } from './utils/auditLog';
import os from 'os';

export function getLanIpv4Addresses(): string[] {
  const ips: string[] = [];
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const addr of addrs || []) {
      const family = String(addr.family);
      if ((family === 'IPv4' || family === '4') && !addr.internal) {
        ips.push(addr.address);
      }
    }
  }
  return ips;
}

dotenv.config();

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.ALLOWED_ORIGINS?.split(',') 
    : '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-client-platform', 'X-Client-Platform'],
}));

// Parsing middleware
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

app.use((req, res, next) => {
  const platform = normalizeAuditPlatform(String(req.headers['x-client-platform'] || ''));
  auditRequestContext.run({ platform: platform || undefined }, () => next());
});

// Health check
app.get('/health', (req, res) => {
  const port = parseInt(process.env.PORT || '5000', 10);
  const lanIps = getLanIpv4Addresses();
  res.json({
    success: true,
    message: 'KSP Transport API is running',
    timestamp: new Date(),
    port,
    lanIps,
    urls: ['http://localhost:' + port, ...lanIps.map((ip) => `http://${ip}:${port}`)],
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/parties', partyRoutes);
app.use('/api/units', unitRoutes);
app.use('/api/routes', routeRoutes);
app.use('/api/freight-rates', freightRateRoutes);
app.use('/api/expense-rates', expenseRateRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/settlements', settlementRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/owners', ownerRoutes);
app.use('/api/cleaning-expense-rates', cleaningExpenseRoutes);
app.use('/api/owner-advances', ownerAdvanceRoutes);
app.use('/api/truck-advances', truckAdvanceRoutes);
app.use('/api/unloading-rates', unloadingRateRoutes);
app.use('/api/driver-bata-rates', driverBataRateRoutes);
app.use('/api/other-expense-limits', otherExpenseLimitRoutes);
app.use('/api/driver-advances', driverAdvanceRoutes);

// Error handling
app.use(notFound);
app.use(errorHandler);

export default app;
