import * as dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: process.env.PORT || 3000,
  apiKey: process.env.API_KEY || '',  // This will be used to authenticate requests from your frontend
  chessComBaseUrl: 'https://api.chess.com/pub',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000'  // Your frontend URL
}; 