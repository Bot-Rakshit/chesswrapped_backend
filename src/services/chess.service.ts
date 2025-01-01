import axios from 'axios';
import { config } from '../config';
import { ChessComPlayer, ChessComStats, UserProfile, RatingHistory, CountryInfo } from '../types';

export class ChessService {
  private baseUrl = config.chessComBaseUrl;

  async verifyAndGetProfile(username: string): Promise<UserProfile> {
    try {
      const [playerResponse, statsResponse] = await Promise.all([
        axios.get<ChessComPlayer>(`${this.baseUrl}/player/${username}`),
        axios.get<ChessComStats>(`${this.baseUrl}/player/${username}/stats`)
      ]);

      let countryName = null;
      let countryCode = null;

      if (playerResponse.data.country) {
        try {
          // Extract country code from the URL (e.g., "https://api.chess.com/pub/country/US" -> "US")
          countryCode = playerResponse.data.country.split('/').pop() || null;
          if (countryCode) {
            const countryResponse = await axios.get<CountryInfo>(`${this.baseUrl}/country/${countryCode}`);
            countryName = countryResponse.data.name;
          }
        } catch (error) {
          console.error('Error fetching country info:', error);
          // Don't throw here, just continue with null values
        }
      }

      return {
        username: playerResponse.data.username,
        name: playerResponse.data.name || null,
        avatar: playerResponse.data.avatar || null,
        country: {
          name: countryName,
          code: countryCode
        },
        ratings: {
          rapid: statsResponse.data.chess_rapid?.last.rating || null,
          blitz: statsResponse.data.chess_blitz?.last.rating || null,
          bullet: statsResponse.data.chess_bullet?.last.rating || null
        }
      };
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        throw new Error('User not found');
      }
      throw error;
    }
  }

  async getRatingHistory(username: string, gameType: 'rapid' | 'blitz' | 'bullet'): Promise<RatingHistory[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/player/${username}/games/archives`);
      const archives: string[] = response.data.archives;
      
      // Get the last 6 months of games
      const recentArchives = archives.slice(-6);
      
      const gamePromises = recentArchives.map(url => axios.get(url));
      const gameResponses = await Promise.all(gamePromises);
      
      const ratingHistory: Map<string, number> = new Map();
      
      gameResponses.forEach(response => {
        response.data.games.forEach((game: any) => {
          if (game.time_class === gameType) {
            const date = new Date(game.end_time * 1000).toISOString().split('T')[0];
            const player = game.white.username.toLowerCase() === username.toLowerCase() 
              ? game.white 
              : game.black;
            
            if (player.rating) {
              ratingHistory.set(date, player.rating);
            }
          }
        });
      });

      return Array.from(ratingHistory.entries()).map(([date, rating]) => ({
        date,
        rating
      })).sort((a, b) => a.date.localeCompare(b.date));
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        throw new Error('User not found or no games available');
      }
      throw error;
    }
  }
} 