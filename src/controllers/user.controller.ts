import { Request, Response } from 'express';
import { ChessService } from '../services/chess.service';
import { ApiResponse, UserProfile, RatingHistory } from '../types';

const chessService = new ChessService();

export class UserController {
  private handleError(error: unknown, res: Response) {
    const response: ApiResponse<never> = {
      success: false,
      error: error instanceof Error ? error.message : 'An error occurred'
    };
    
    res.status(error instanceof Error && error.message.includes('User not found') ? 404 : 500).json(response);
  }

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
      this.handleError(error, res);
    }
  }

  async getRatingStats(req: Request, res: Response) {
    try {
      const { username } = req.params;
      
      if (!username) {
        return res.status(400).json({
          success: false,
          error: 'Username is required'
        });
      }

      const ratings = await chessService.getChessWrappedRatings(username);
      
      const response: ApiResponse<typeof ratings> = {
        success: true,
        data: ratings
      };
      
      res.json(response);
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async getWrappedStats(req: Request, res: Response) {
    try {
      const { username } = req.params;
      
      if (!username) {
        return res.status(400).json({
          success: false,
          error: 'Username is required'
        });
      }

      const wrapped = await chessService.getChessWrapped(username);
      
      const response: ApiResponse<typeof wrapped> = {
        success: true,
        data: wrapped
      };
      
      res.json(response);
    } catch (error) {
      this.handleError(error, res);
    }
  }
}
