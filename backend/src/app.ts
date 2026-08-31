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

import { errorHandler, notFound } from './middleware/errorHandler';

dotenv.config();

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.ALLOWED_ORIGINS?.split(',') 
    : '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Health check
app.get('/health', (req, res) => {
  res.json({ success: true, message: 'KSP Transport API is running', timestamp: new Date() });
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

// Error handling
app.use(notFound);
app.use(errorHandler);

export default app;
