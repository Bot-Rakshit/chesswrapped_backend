import { Request, Response, NextFunction } from 'express';
import { config } from '../config';

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey || apiKey !== config.apiKey) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized - Invalid API Key'
    });
  }

  next();
}; 