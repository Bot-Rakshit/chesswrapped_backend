import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import { UserController } from '../controllers/user.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();
const userController = new UserController();

// Apply auth middleware to all routes
const auth: RequestHandler = (req, res, next) => {
  authMiddleware(req, res, next);
};
router.use(auth);

// Get user profile and ratings
const verifyHandler: RequestHandler = async (req, res, next) => {
  try {
    await userController.verifyUser(req, res);
  } catch (error) {
    next(error);
  }
};
router.get('/verify/:username', verifyHandler);

// Get rating history for a specific game type
const historyHandler: RequestHandler = async (req, res, next) => {
  try {
    await userController.getRatingHistory(req, res);
  } catch (error) {
    next(error);
  }
};
router.get('/ratings/:username', historyHandler);

export default router;
