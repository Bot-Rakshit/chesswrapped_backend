import { Request, Response } from 'express';
import { ChessService } from '../services/chess.service';
import { ApiResponse, UserProfile, RatingHistory } from '../types';

const chessService = new ChessService();

export class UserController {
  async verifyUser(req: Request, res: Response) {
    try {
      const { username } = req.params;
      
      if (!username) {
        return res.status(400).json({
          success: false,
          error: 'Username is required'
        });
      }

      const profile = await chessService.verifyAndGetProfile(username);
      
      const response: ApiResponse<UserProfile> = {
        success: true,
        data: profile
      };
      
      res.json(response);
    } catch (error) {
      const response: ApiResponse<never> = {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred'
      };
      
      res.status(error instanceof Error && error.message === 'User not found' ? 404 : 500).json(response);
    }
  }

  async getRatingHistory(req: Request, res: Response) {
    try {
      const { username } = req.params;
      const { type } = req.query;
      
      if (!username) {
        return res.status(400).json({
          success: false,
          error: 'Username is required'
        });
      }

      if (!type || !['rapid', 'blitz', 'bullet'].includes(type as string)) {
        return res.status(400).json({
          success: false,
          error: 'Valid game type (rapid, blitz, or bullet) is required'
        });
      }

      const history = await chessService.getRatingHistory(username, type as 'rapid' | 'blitz' | 'bullet');
      
      const response: ApiResponse<RatingHistory[]> = {
        success: true,
        data: history
      };
      
      res.json(response);
    } catch (error) {
      const response: ApiResponse<never> = {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred'
      };
      
      res.status(error instanceof Error && error.message.includes('User not found') ? 404 : 500).json(response);
    }
  }
}
