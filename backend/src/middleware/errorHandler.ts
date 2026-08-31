import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../types';

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // PostgreSQL errors
  if (err.code === '23505') {
    statusCode = 409;
    message = 'A record with this information already exists.';
  } else if (err.code === '23503') {
    statusCode = 400;
    message = 'Referenced record does not exist.';
  } else if (err.code === '23502') {
    statusCode = 400;
    message = 'Required field is missing.';
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token. Please login again.';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired. Please login again.';
  }

  if (process.env.NODE_ENV === 'development') {
    console.error('ERROR:', err);
  }

  const response: ApiResponse = {
    success: false,
    message: statusCode === 500 ? 'An internal error occurred. Please try again.' : message,
  };

  res.status(statusCode).json(response);
};

export const notFound = (req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found.`,
  });
};

export const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
