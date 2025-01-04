import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: process.env.PORT || 3000,
  apiKey: process.env.API_KEY || '',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  chessComBaseUrl: 'https://api.chess.com/pub',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173'
}; 