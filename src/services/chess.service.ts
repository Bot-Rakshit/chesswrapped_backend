import axios from 'axios';
import { config } from '../config';
import type { ChessComPlayer, ChessComStats, UserProfile, CountryInfo, ChessWrapped, ChessWrappedResponse, ChessWrappedStats, FormatStats } from '../types/chess.types';

interface Game {
  time_class: 'rapid' | 'blitz' | 'bullet';
  white: {
    username: string;
    rating: number;
    result: string;
  };
  black: {
    username: string;
    rating: number;
    result: string;
  };
  accuracies?: {
    white: number;
    black: number;
  };
  eco: string;
  opening: string;
  url: string;
  end_time: number;
  rules: string;
  pgn: string;
}

interface CachedData {
  timestamp: number;
  games: Game[];
  wrappedData: ChessWrapped | null;
}

export class ChessService {
  private baseUrl = 'https://api.chess.com/pub';
  private cache = new Map<string, CachedData>();
  private CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

  constructor() {
  }

  private async getArchives(username: string): Promise<string[]> {
    const response = await axios.get(`${this.baseUrl}/player/${username}/games/archives`);
    return response.data.archives;
  }

  private async fetchFromChessCom(url: string): Promise<{games: Game[]}> {
    const response = await axios.get(url);
    return response.data;
  }

  private async getCachedData(username: string): Promise<CachedData | null> {
    const cached = this.cache.get(username.toLowerCase());
    if (!cached) return null;
    
    // Check if cache is still valid
    if (Date.now() - cached.timestamp > this.CACHE_DURATION) {
      this.cache.delete(username.toLowerCase());
      return null;
    }

    return cached;
  }

  private async setCachedData(username: string, data: CachedData): Promise<void> {
    this.cache.set(username.toLowerCase(), data);
  }

  private async getGames(username: string): Promise<Game[]> {
    const cachedData = await this.getCachedData(username);
    if (cachedData) {
      return cachedData.games;
    }

    try {
      const archives = await this.getArchives(username);
      const year2024Archives = archives.filter(url => url.includes('/2024/'));
      
      if (year2024Archives.length === 0) {
        console.log('No games found for 2024');
        return [];
      }

      let allGames: Game[] = [];
      for (const archive of year2024Archives) {
        try {
          const archiveGames = await this.fetchFromChessCom(archive);
          if (archiveGames?.games) {
            // Filter and map games to ensure correct structure
            const validGames = archiveGames.games
              .filter(game => 
                game.time_class && 
                ['rapid', 'blitz', 'bullet'].includes(game.time_class) &&
                game.white?.username &&
                game.black?.username &&
                game.white?.result &&
                game.black?.result
              )
              .map(game => ({
                time_class: game.time_class as 'rapid' | 'blitz' | 'bullet',
                white: {
                  username: game.white.username,
                  rating: game.white.rating || 0,
                  result: game.white.result
                },
                black: {
                  username: game.black.username,
                  rating: game.black.rating || 0,
                  result: game.black.result
                },
                accuracies: game.accuracies,
                eco: game.eco || 'Unknown',
                opening: game.opening || 'Unknown Opening',
                url: game.url,
                end_time: game.end_time,
                rules: game.rules || '',
                pgn: game.pgn || ''
              }));
            allGames = allGames.concat(validGames);
          }
        } catch (error) {
          console.error(`Error fetching archive ${archive}:`, error);
        }
      }

      if (allGames.length === 0) {
        console.log('No valid games found');
        return [];
      }

      allGames.sort((a, b) => a.end_time - b.end_time);
      
      await this.setCachedData(username, {
        timestamp: Date.now(),
        games: allGames,
        wrappedData: null
      });

      return allGames;
    } catch (error) {
      console.error('Error fetching games:', error);
      return [];
    }
  }

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
          countryCode = playerResponse.data.country.split('/').pop() || null;
          if (countryCode) {
            const countryResponse = await axios.get<CountryInfo>(`${this.baseUrl}/country/${countryCode}`);
            countryName = countryResponse.data.name;
          }
        } catch (error) {
          console.error('Error fetching country info:', error);
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

  private generateMonthlyGames(games: Game[]): ChessWrapped['monthlyGames'] {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    // Initialize monthly distribution
    const distribution = months.map(month => ({
      month,
      rapid: 0,
      blitz: 0,
      bullet: 0,
      total: 0
    }));

    // Process each game
    games.forEach(game => {
      const date = new Date(game.end_time * 1000);
      const monthIndex = date.getMonth();
      
      distribution[monthIndex][game.time_class]++;
      distribution[monthIndex].total++;
    });

    // Find most and least active months
    const activeMonths = [...distribution]
      .filter(month => month.total > 0)
      .sort((a, b) => b.total - a.total);

    const mostActive = activeMonths.length > 0 
      ? { month: activeMonths[0].month, games: activeMonths[0].total }
      : { month: 'None', games: 0 };

    const leastActive = activeMonths.length > 0 
      ? { month: activeMonths[activeMonths.length - 1].month, games: activeMonths[activeMonths.length - 1].total }
      : { month: 'None', games: 0 };

    return {
      mostActive,
      leastActive,
      distribution
    };
  }

  async getChessWrapped(username: string): Promise<ChessWrapped> {
    try {
      const cachedData = await this.getCachedData(username);
      if (cachedData?.wrappedData) {
        return cachedData.wrappedData;
      }

      console.log('Fetching games for user:', username);
      const games = cachedData?.games || await this.getGames(username);
      console.log('Games fetched:', games.length);

      console.log('Generating intro stats...');
      const intro = this.generateIntroStats(games, username);
      console.log('Intro stats generated');

      console.log('Generating monthly games...');
      const monthlyGames = this.generateMonthlyGames(games);
      console.log('Monthly games generated');

      console.log('Generating rating stats...');
      const ratings = this.generateRatingStats(games, username);
      console.log('Rating stats generated');

      console.log('Generating format specific stats...');
      const formatSpecific = this.generateFormatSpecificStats(games, username);
      console.log('Format specific stats generated');

      console.log('Generating playing patterns...');
      const playingPatterns = this.generatePlayingPatternStats(games, username);
      console.log('Playing patterns generated');

      console.log('Generating opening stats...');
      const openings = this.generateOpeningStats(games, username);
      console.log('Opening stats generated');

      console.log('Generating opponent stats...');
      const opponents = this.generateOpponentStats(games, username);
      console.log('Opponent stats generated');

      console.log('Generating performance stats...');
      const performance = this.generatePerformanceStats(games, username);
      console.log('Performance stats generated');

      const wrappedData: ChessWrapped = {
        intro,
        monthlyGames,
        ratings,
        formatSpecific,
        playingPatterns,
        openings,
        opponents,
        performance
      };

      // Update cache with wrapped data
      await this.setCachedData(username, {
        timestamp: Date.now(),
        games,
        wrappedData: wrappedData
      });

      return wrappedData;
    } catch (error) {
      console.error('Error in getChessWrapped:', error);
      throw error;
    }
  }

  async getChessWrappedRatings(username: string): Promise<ChessWrapped['ratings']> {
    const cachedData = await this.getCachedData(username);
    if (cachedData?.wrappedData) {
      return cachedData.wrappedData.ratings;
    }

    // If not cached, get full data which will cache it
    const fullData = await this.getChessWrapped(username);
    return fullData.ratings;
  }

  async getChessWrappedStats(username: string): Promise<ChessWrappedStats> {
    const cachedData = await this.getCachedData(username);
    if (cachedData?.wrappedData) {
      // Remove all rating-related data
      const { ratings, ...otherData } = cachedData.wrappedData;
      const { formatSpecific, ...rest } = otherData;
      
      // Clean format specific data
      const cleanedFormatSpecific: ChessWrapped['formatSpecific'] = {};
      
      if (formatSpecific) {
        for (const format of ['rapid', 'blitz', 'bullet'] as const) {
          if (formatSpecific[format]) {
            const { ratingProgress, bestWin, worstLoss, ...formatData } = formatSpecific[format];
            cleanedFormatSpecific[format] = {
              ...formatData,
              openings: {
                asWhite: formatData.openings.asWhite.slice(0, 3),
                asBlack: formatData.openings.asBlack.slice(0, 3)
              }
            };
          }
        }
      }

      return {
        ...rest,
        formatSpecific: cleanedFormatSpecific
      };
    }

    // If not cached, get full data which will cache it
    const fullData = await this.getChessWrapped(username);
    const { ratings, ...otherData } = fullData;
    const { formatSpecific, ...rest } = otherData;
    
    // Clean format specific data
    const cleanedFormatSpecific: ChessWrapped['formatSpecific'] = {};
    
    if (formatSpecific) {
      for (const format of ['rapid', 'blitz', 'bullet'] as const) {
        if (formatSpecific[format]) {
          const { ratingProgress, bestWin, worstLoss, ...formatData } = formatSpecific[format];
          cleanedFormatSpecific[format] = {
            ...formatData,
            openings: {
              asWhite: formatData.openings.asWhite.slice(0, 3),
              asBlack: formatData.openings.asBlack.slice(0, 3)
            }
          };
        }
      }
    }

    return {
      ...rest,
      formatSpecific: cleanedFormatSpecific
    };
  }

  private generateIntroStats(games: Game[], username: string): ChessWrapped['intro'] {
    const formatBreakdown = {
      rapid: { count: 0, percentage: 0 },
      blitz: { count: 0, percentage: 0 },
      bullet: { count: 0, percentage: 0 }
    };

    // Group games by date to find most games in a day
    const gamesByDate = new Map<string, number>();
    // Group games by month for most active month
    const gamesByMonth = new Map<string, number>();
    
    let currentStreak = 0;
    let longestStreak = {
      startDate: '',
      endDate: '',
      days: 0,
      gamesPlayed: 0
    };
    
    let currentBreak = 0;
    let longestBreak = {
      startDate: '',
      endDate: '',
      days: 0
    };

    if (games.length === 0) {
      return {
        totalGames: 0,
        formatBreakdown,
        mostGamesInDay: { date: '', count: 0 },
        activeMonths: {
          most: [{ month: '', gamesPlayed: 0 }],
          least: [{ month: '', gamesPlayed: 0 }]
        },
        favoriteFormat: {
          format: 'blitz',
          gamesPlayed: 0,
          winRate: 0
        },
        longestStreak,
        longestBreak
      };
    }

    // Process each game
    games.forEach(game => {
      // Count games by format
      formatBreakdown[game.time_class].count++;
      
      // Track games by date
      const date = new Date(game.end_time * 1000).toISOString().split('T')[0];
      gamesByDate.set(date, (gamesByDate.get(date) || 0) + 1);
      
      // Track games by month
      const month = date.substring(0, 7); // YYYY-MM format
      gamesByMonth.set(month, (gamesByMonth.get(month) || 0) + 1);
    });

    // Calculate percentages
    const totalGames = games.length;
    Object.values(formatBreakdown).forEach(format => {
      format.percentage = Math.round((format.count / totalGames) * 100);
    });

    // Find most games in a day
    let mostGamesInDay = {
      date: '',
      count: 0
    };
    gamesByDate.forEach((count, date) => {
      if (count > mostGamesInDay.count) {
        mostGamesInDay = { date, count };
      }
    });

    // Find most and least active months
    const sortedMonths = Array.from(gamesByMonth.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([month, gamesPlayed]) => ({ month, gamesPlayed }));

    const mostActiveMonths = sortedMonths.slice(0, 3);
    const leastActiveMonths = sortedMonths.slice(-3);

    // Calculate streaks and breaks
    const dates = Array.from(gamesByDate.keys()).sort();
    if (dates.length > 0) {
      let streakStart = dates[0];
      let breakStart = '';
      let currentStreakGames = gamesByDate.get(dates[0]) || 0;

      for (let i = 1; i < dates.length; i++) {
        const prevDate = new Date(dates[i - 1]);
        const currDate = new Date(dates[i]);
        const daysDiff = Math.floor((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));

        if (daysDiff === 1) {
          // Continuing streak
          currentStreak++;
          currentStreakGames += gamesByDate.get(dates[i]) || 0;
          if (currentStreak > longestStreak.days) {
            longestStreak = {
              startDate: streakStart,
              endDate: dates[i],
              days: currentStreak + 1,
              gamesPlayed: currentStreakGames
            };
          }
        } else {
          // Break in streak
          currentStreak = 0;
          currentStreakGames = gamesByDate.get(dates[i]) || 0;
          streakStart = dates[i];

          // Track break
          if (daysDiff - 1 > longestBreak.days) {
            longestBreak = {
              startDate: dates[i - 1],
              endDate: dates[i],
              days: daysDiff - 1
            };
          }
        }
      }
    }

    // Determine favorite format
    const favoriteFormat = Object.entries(formatBreakdown)
      .reduce<ChessWrapped['intro']['favoriteFormat']>((max, [format, stats]) => 
        stats.count > (max?.gamesPlayed || 0)
          ? { 
              format: format as 'rapid' | 'blitz' | 'bullet',
              gamesPlayed: stats.count,
              winRate: this.calculateWinRate(games.filter(g => g.time_class === format), username)
            } 
          : max, 
        { format: 'blitz', gamesPlayed: 0, winRate: 0 }
      );

    return {
      totalGames,
      formatBreakdown,
      mostGamesInDay,
      activeMonths: {
        most: mostActiveMonths,
        least: leastActiveMonths
      },
      favoriteFormat,
      longestStreak,
      longestBreak
    };
  }

  private calculateWinRate(games: Game[], username: string): number {
    if (games.length === 0) return 0;
    
    const wins = games.filter(game => {
      const isWhite = game.white.username.toLowerCase() === username.toLowerCase();
      return isWhite ? game.white.result === 'win' : game.black.result === 'win';
    }).length;

    return Math.round((wins / games.length) * 100);
  }

  private generateRatingStats(games: Game[], username: string): ChessWrapped['ratings'] {
    const ratingProgress = {
      rapid: [] as Array<{ date: string; rating: number }>,
      blitz: [] as Array<{ date: string; rating: number }>,
      bullet: [] as Array<{ date: string; rating: number }>
    };

    const currentRatings = {
      rapid: null as number | null,
      blitz: null as number | null,
      bullet: null as number | null
    };

    const peakRatings = {
      rapid: null as { rating: number; date: string } | null,
      blitz: null as { rating: number; date: string } | null,
      bullet: null as { rating: number; date: string } | null
    };

    const bestRatingGains = {
      rapid: null as { date: string; gain: number } | null,
      blitz: null as { date: string; gain: number } | null,
      bullet: null as { date: string; gain: number } | null
    };

    const worstRatingLosses = {
      rapid: null as { date: string; loss: number } | null,
      blitz: null as { date: string; loss: number } | null,
      bullet: null as { date: string; loss: number } | null
    };

    let bestRatingDay = {
      date: '',
      format: 'blitz' as 'rapid' | 'blitz' | 'bullet',
      gain: 0
    };

    // Process games chronologically for each time control
    const timeControls = ['rapid', 'blitz', 'bullet'] as const;

    for (const timeControl of timeControls) {
      const timeControlGames = games.filter(g => g.time_class === timeControl);
      if (timeControlGames.length === 0) continue;

      let maxGainInDay = 0;
      let maxLossInDay = 0;
      let bestGainDate = '';
      let worstLossDate = '';
      let dailyRatingChanges = new Map<string, number>();
      let prevRating = 0; // Keep track of the previous rating

      timeControlGames.forEach((game, index) => {
        const isWhite = game.white.username.toLowerCase() === username.toLowerCase();
        const currentRating = isWhite ? game.white.rating : game.black.rating;
        const date = new Date(game.end_time * 1000).toISOString().split('T')[0];

        // Initialize previous rating with the first game's rating
        if (index === 0) {
          prevRating = currentRating;
        }

        // Track rating progress
        ratingProgress[timeControl].push({ date, rating: currentRating });

        // Update current rating
        currentRatings[timeControl] = currentRating;

        // Update peak rating
        if (!peakRatings[timeControl] || currentRating > peakRatings[timeControl]!.rating) {
          peakRatings[timeControl] = { rating: currentRating, date };
        }

        // Calculate rating change since the last game of the same time control
        const ratingChange = currentRating - prevRating;

        // Update daily rating changes
        const dailyChange = dailyRatingChanges.get(date) || 0;
        dailyRatingChanges.set(date, dailyChange + ratingChange);

        // Update max gain and loss for the day
        if (dailyRatingChanges.get(date)! > maxGainInDay) {
          maxGainInDay = dailyRatingChanges.get(date)!;
          bestGainDate = date;
        }

        if (dailyRatingChanges.get(date)! < maxLossInDay) {
          maxLossInDay = dailyRatingChanges.get(date)!;
          worstLossDate = date;
        }

        // Update best rating day across all formats
        if (maxGainInDay > bestRatingDay.gain) {
          bestRatingDay = {
            date: bestGainDate,
            format: timeControl,
            gain: maxGainInDay
          };
        }

        // Update previous rating for the next iteration
        prevRating = currentRating;
      });

      // Sort rating progress by date
      ratingProgress[timeControl].sort((a, b) => a.date.localeCompare(b.date));

      // Set best rating gains for this time control
      if (bestGainDate) {
        bestRatingGains[timeControl] = {
          date: bestGainDate,
          gain: maxGainInDay
        };
      }

      // Set worst rating losses for this time control
      if (worstLossDate) {
        worstRatingLosses[timeControl] = {
          date: worstLossDate,
          loss: Math.abs(maxLossInDay)
        };
      }
    }

    const metadata = {
      firstGameDate: games.length > 0 ? new Date(games[0].end_time * 1000).toISOString().split('T')[0] : null,
      lastGameDate: games.length > 0 ? new Date(games[games.length - 1].end_time * 1000).toISOString().split('T')[0] : null,
      totalGamesAnalyzed: games.length
    };

    return {
      currentRatings,
      ratingProgress,
      bestRatingGains,
      worstRatingLosses,
      bestRatingDay,
      peakRatings,
      metadata
    };
  }

  private isFormatEligible(games: Game[], format: string): boolean {
    const formatGames = games.filter(g => g.time_class === format);
    const totalGames = games.length;
    return formatGames.length >= 15 || (formatGames.length / totalGames) > 0.1;
  }

  private generateFormatSpecificStats(games: Game[], username: string): ChessWrapped['formatSpecific'] {
    const formats = ['rapid', 'blitz', 'bullet'] as const;
    const stats: ChessWrapped['formatSpecific'] = {};

    formats.forEach(format => {
      if (this.isFormatEligible(games, format)) {
        const formatGames = games.filter(g => g.time_class === format);
        const openingsByColor = {
          white: new Map<string, { name: string; count: number; wins: number }>(),
          black: new Map<string, { name: string; count: number; wins: number }>()
        };

        let wins = 0;
        let totalDuration = 0;
        const ratingProgressArray: Array<{ date: string; rating: number }> = [];
        let bestWin: FormatStats['bestWin'] = null;
        let worstLoss: FormatStats['worstLoss'] = null;

        // Initialize results object
        const formatStats: FormatStats = {
          gamesPlayed: formatGames.length,
          winRate: 0,
          ratingProgress: ratingProgressArray,
          openings: {
            asWhite: [],
            asBlack: []
          },
          results: {
            wins: { total: 0, byResignation: 0, onTime: 0, byCheckmate: 0 },
            draws: { total: 0, byAgreement: 0, byRepetition: 0, byStalemate: 0, byInsufficientMaterial: 0 },
            losses: { total: 0, byResignation: 0, onTime: 0, byCheckmate: 0 }
          },
          averageGameDuration: 0,
          bestWin: null,
          worstLoss: null
        };

        // Process each game in the format
        formatGames.forEach(game => {
          const isWhite = game.white.username.toLowerCase() === username.toLowerCase();
          const playerResult = isWhite ? game.white.result : game.black.result;
          const resultCode = game.rules;

          if (playerResult === 'win') {
            wins++;
            formatStats.results.wins.total++;
            if (resultCode.includes('resignation')) {
              formatStats.results.wins.byResignation++;
            } else if (resultCode.includes('time')) {
              formatStats.results.wins.onTime++;
            } else if (resultCode.includes('checkmate')) {
              formatStats.results.wins.byCheckmate++;
            }
          } else if (playerResult === 'repetition' || playerResult === 'stalemate' || 
                     playerResult === 'insufficient' || resultCode.includes('drawn')) {
            formatStats.results.draws.total++;
            if (resultCode.includes('agreement')) {
              formatStats.results.draws.byAgreement++;
            } else if (resultCode.includes('repetition')) {
              formatStats.results.draws.byRepetition++;
            } else if (resultCode.includes('stalemate')) {
              formatStats.results.draws.byStalemate++;
            } else if (resultCode.includes('insufficient')) {
              formatStats.results.draws.byInsufficientMaterial++;
            }
          } else {
            formatStats.results.losses.total++;
            if (resultCode.includes('resignation')) {
              formatStats.results.losses.byResignation++;
            } else if (resultCode.includes('time')) {
              formatStats.results.losses.onTime++;
            } else if (resultCode.includes('checkmate')) {
              formatStats.results.losses.byCheckmate++;
            }
          }

          // Track rating progress
          const rating = isWhite ? game.white.rating : game.black.rating;
          const date = new Date(game.end_time * 1000).toISOString().split('T')[0];
          ratingProgressArray.push({ date, rating });

          // Track best win and worst loss
          const opponentRating = isWhite ? game.black.rating : game.white.rating;
          const opponent = isWhite ? game.black.username : game.white.username;

          if (playerResult === 'win' && (!bestWin || opponentRating > bestWin.opponentRating)) {
            bestWin = {
              opponent,
              opponentRating,
              date,
              url: game.url
            };
          } else if (playerResult === 'loss' && (!worstLoss || opponentRating < worstLoss.opponentRating)) {
            worstLoss = {
              opponent,
              opponentRating,
              date,
              url: game.url
            };
          }

          // Estimate game duration from PGN (counting moves)
          const moves = game.pgn.match(/\d+\./g)?.length || 0;
          totalDuration += moves * 2; // Rough estimate: 2 minutes per move
        });

        // Update final stats
        formatStats.winRate = Math.round((wins / formatGames.length) * 100);
        formatStats.averageGameDuration = Math.round(totalDuration / formatGames.length);
        formatStats.bestWin = bestWin;
        formatStats.worstLoss = worstLoss;

        // Process openings
        const processOpenings = (openings: Map<string, { name: string; count: number; wins: number }>) => {
          return Array.from(openings.values())
            .map(opening => ({
              name: opening.name,
              count: opening.count,
              winRate: Math.round((opening.wins / opening.count) * 100)
            }))
            .sort((a, b) => b.count - a.count);
        };

        formatStats.openings = {
          asWhite: processOpenings(openingsByColor.white),
          asBlack: processOpenings(openingsByColor.black)
        };

        // Sort rating progress by date
        formatStats.ratingProgress = ratingProgressArray.sort((a, b) => a.date.localeCompare(b.date));

        stats[format] = formatStats;
      }
    });

    return stats;
  }

  private generatePlayingPatternStats(games: Game[], username: string): ChessWrapped['playingPatterns'] {
    const timeOfDay = {
      morning: { games: 0, wins: 0, winRate: 0 },
      afternoon: { games: 0, wins: 0, winRate: 0 },
      evening: { games: 0, wins: 0, winRate: 0 },
      night: { games: 0, wins: 0, winRate: 0 }
    };

    const dayOfWeek = {
      monday: { games: 0, wins: 0, winRate: 0 },
      tuesday: { games: 0, wins: 0, winRate: 0 },
      wednesday: { games: 0, wins: 0, winRate: 0 },
      thursday: { games: 0, wins: 0, winRate: 0 },
      friday: { games: 0, wins: 0, winRate: 0 },
      saturday: { games: 0, wins: 0, winRate: 0 },
      sunday: { games: 0, wins: 0, winRate: 0 }
    };

    let totalPlayingTime = 0;
    let longestGame = {
        opponent: '',
        date: '',
        format: '',
        result: '',
        duration: 0,
        url: ''
    };

    // Track unique days played
    const uniqueDays = new Set<string>();

    games.forEach(game => {
      const gameDate = new Date(game.end_time * 1000);
      const hour = gameDate.getHours();
      const dayIndex = gameDate.getDay();
      const dateStr = gameDate.toISOString().split('T')[0];
      const isWhite = game.white.username.toLowerCase() === username.toLowerCase();
      const playerResult = isWhite ? game.white.result : game.black.result;
      const opponent = isWhite ? game.black.username : game.white.username;

      // Add to unique days
      uniqueDays.add(dateStr);

      // Determine time of day
      let timeSlot: keyof typeof timeOfDay;
      if (hour >= 5 && hour < 12) timeSlot = 'morning';
      else if (hour >= 12 && hour < 17) timeSlot = 'afternoon';
      else if (hour >= 17 && hour < 22) timeSlot = 'evening';
      else timeSlot = 'night';

      // Update time of day stats
      timeOfDay[timeSlot].games++;
      if (playerResult === 'win') timeOfDay[timeSlot].wins++;

      // Update day of week stats
      const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
      const day = days[dayIndex];
      dayOfWeek[day].games++;
      if (playerResult === 'win') dayOfWeek[day].wins++;

      // Estimate game duration from PGN (counting moves)
      const moves = game.pgn.match(/\d+\./g)?.length || 0;
      const estimatedDuration = moves * 2; // Rough estimate: 2 minutes per move
      totalPlayingTime += estimatedDuration;

      // Track longest game
      if (estimatedDuration > longestGame.duration) {
        longestGame = {
          opponent,
          date: dateStr,
          format: game.time_class,
          result: playerResult,
          duration: estimatedDuration,
          url: game.url
        };
      }
    });

    // Calculate win rates and find best times
    let bestTimeToPlay: keyof typeof timeOfDay = 'morning';
    let bestTimeWinRate = 0;

    Object.entries(timeOfDay).forEach(([time, stats]) => {
      if (stats.games > 0) {
        stats.winRate = Math.round((stats.wins / stats.games) * 100);
        if (stats.winRate > bestTimeWinRate && stats.games >= 5) { // Minimum 5 games for significance
          bestTimeWinRate = stats.winRate;
          bestTimeToPlay = time as keyof typeof timeOfDay;
        }
      }
    });

    // Calculate day of week win rates and find best day
    let bestDayToPlay = 'monday';
    let bestDayWinRate = 0;

    Object.entries(dayOfWeek).forEach(([day, stats]) => {
      if (stats.games > 0) {
        stats.winRate = Math.round((stats.wins / stats.games) * 100);
        if (stats.winRate > bestDayWinRate && stats.games >= 5) { // Minimum 5 games for significance
          bestDayWinRate = stats.winRate;
          bestDayToPlay = day;
        }
      }
    });

    return {
      timeOfDay: {
        morning: { games: timeOfDay.morning.games, winRate: timeOfDay.morning.winRate },
        afternoon: { games: timeOfDay.afternoon.games, winRate: timeOfDay.afternoon.winRate },
        evening: { games: timeOfDay.evening.games, winRate: timeOfDay.evening.winRate },
        night: { games: timeOfDay.night.games, winRate: timeOfDay.night.winRate },
        bestTimeToPlay
      },
      dayOfWeek: {
        monday: { games: dayOfWeek.monday.games, winRate: dayOfWeek.monday.winRate },
        tuesday: { games: dayOfWeek.tuesday.games, winRate: dayOfWeek.tuesday.winRate },
        wednesday: { games: dayOfWeek.wednesday.games, winRate: dayOfWeek.wednesday.winRate },
        thursday: { games: dayOfWeek.thursday.games, winRate: dayOfWeek.thursday.winRate },
        friday: { games: dayOfWeek.friday.games, winRate: dayOfWeek.friday.winRate },
        saturday: { games: dayOfWeek.saturday.games, winRate: dayOfWeek.saturday.winRate },
        sunday: { games: dayOfWeek.sunday.games, winRate: dayOfWeek.sunday.winRate },
        bestDayToPlay
      },
      averageGamesPerDay: Math.round(games.length / uniqueDays.size),
      totalPlayingTime,
      averageGameDuration: Math.round(totalPlayingTime / games.length),
      longestGame
    };
  }

  private generateOpeningStats(games: Game[], username: string): ChessWrapped['openings'] {
    const openingsByColor = {
      white: new Map<string, { name: string; count: number; wins: number }>(),
      black: new Map<string, { name: string; count: number; wins: number }>()
    };

    const totalGames = games.length;

    games.forEach(game => {
      // Extract opening name from PGN
      let openingName = 'Unknown';
      let eco = 'Unknown';
      if (game.pgn) {
        const ecoMatch = game.pgn.match(/\[ECO "(.*?)"\]/);
        const ecoUrlMatch = game.pgn.match(/\[ECOUrl "(.*?)"\]/);
        
        if (ecoMatch) {
          eco = ecoMatch[1];
        }
        
        if (ecoUrlMatch) {
          const urlParts = ecoUrlMatch[1].split('/');
          openingName = urlParts[urlParts.length - 1].replace(/-/g, ' ');
        }
      }

      const isWhite = game.white.username.toLowerCase() === username.toLowerCase();
      const color = isWhite ? 'white' : 'black';
      const playerResult = isWhite ? game.white.result : game.black.result;
      
      const fullOpeningName = `${eco} - ${openingName}`;

      const openingData = openingsByColor[color].get(fullOpeningName) || {
        name: fullOpeningName,
        count: 0,
        wins: 0
      };
      openingData.count++;
      if (playerResult === 'win') {
        openingData.wins++;
      }
      openingsByColor[color].set(fullOpeningName, openingData);
    });

    const processOpenings = (openings: Map<string, { name: string; count: number; wins: number }>) => {
      return Array.from(openings.values())
        .filter(opening => opening.count >= 2) // Only include openings played at least twice
        .map(opening => ({
          name: opening.name,
          count: opening.count,
          winRate: Math.round((opening.wins / opening.count) * 100),
          percentage: Math.round((opening.count / totalGames) * 100)
        }))
        .sort((a, b) => b.count - a.count);
    };

    const processTopOpenings = (openings: ReturnType<typeof processOpenings>) => {
      return openings.length > 0 
        ? openings.sort((a, b) => b.winRate - a.winRate).slice(0, 3)
        : [{
            name: "No openings recorded",
            count: 0,
            winRate: 0,
            percentage: 0
          }];
    };

    const processWorstOpenings = (openings: ReturnType<typeof processOpenings>) => {
      return openings.length > 0
        ? openings.filter(o => o.count >= 2) // Only include openings played at least twice
            .sort((a, b) => a.winRate - b.winRate)
            .slice(0, 3)
        : [{
            name: "No openings recorded",
            count: 0,
            winRate: 0,
            percentage: 0
          }];
    };

    const whiteOpenings = processOpenings(openingsByColor.white);
    const blackOpenings = processOpenings(openingsByColor.black);

    return {
      byColor: {
        asWhite: {
          topOpenings: processTopOpenings(whiteOpenings),
          worstOpenings: processWorstOpenings(whiteOpenings)
        },
        asBlack: {
          topOpenings: processTopOpenings(blackOpenings),
          worstOpenings: processWorstOpenings(blackOpenings)
        }
      }
    };
  }

  private generateOpponentStats(games: Game[], username: string): ChessWrapped['opponents'] {
    interface OpponentStat {
      username: string;
      games: number;
      wins: number;
      losses: number;
      opponentRating: number;
      format: 'rapid' | 'blitz' | 'bullet';
    }

    const opponentStats = new Map<string, {
      games: number;
      wins: number;
      losses: number;
      opponentRating: number;
      format: 'rapid' | 'blitz' | 'bullet';
    }>();

    games.forEach(game => {
      const isWhite = game.white.username.toLowerCase() === username.toLowerCase();
      const opponent = isWhite ? game.black.username : game.white.username;
      const opponentRating = isWhite ? game.black.rating : game.white.rating;
      const playerResult = isWhite ? game.white.result : game.black.result;
      
      const stats = opponentStats.get(opponent) || {
        games: 0,
        wins: 0,
        losses: 0,
        opponentRating,
        format: game.time_class
      };
      
      stats.games++;
      if (playerResult === 'win') stats.wins++;
      if (playerResult !== 'win' && playerResult !== 'draw') stats.losses++;
      stats.opponentRating = opponentRating; // Update with latest rating
      
      opponentStats.set(opponent, stats);
    });

    const totalGames = games.length;
    const processOpponents = (opponents: OpponentStat[]) => {
      return opponents.map(opponent => ({
        username: opponent.username,
        games: opponent.games,
        winRate: Math.round((opponent.wins / opponent.games) * 100),
        lossRate: Math.round((opponent.losses / opponent.games) * 100),
        opponentRating: opponent.opponentRating,
        percentage: Math.round((opponent.games / totalGames) * 100)
      }));
    };

    const processPerformance = (opponents: OpponentStat[]) => {
      return opponents.map(opponent => ({
        username: opponent.username,
        games: opponent.games,
        winRate: Math.round((opponent.wins / opponent.games) * 100),
        lossRate: Math.round((opponent.losses / opponent.games) * 100),
        opponentRating: opponent.opponentRating,
        minGames: 1
      }));
    };

    const defaultOpponent = {
      username: "No opponents found",
      games: 0,
      winRate: 0,
      lossRate: 0,
      opponentRating: 0,
      percentage: 0
    };

    const defaultPerformance = {
      username: "No opponents found",
      games: 0,
      winRate: 0,
      lossRate: 0,
      opponentRating: 0,
      minGames: 1
    };

    const sortedOpponents = Array.from(opponentStats.entries())
      .map(([username, stats]) => ({
        username,
        games: stats.games,
        wins: stats.wins,
        losses: stats.losses,
        opponentRating: stats.opponentRating,
        format: stats.format
      }))
      .filter(opponent => opponent.games >= 1);

    const mostPlayed = processOpponents(
      sortedOpponents
        .sort((a, b) => b.games - a.games)
        .slice(0, 3)
    );

    const bestPerformance = processPerformance(
      sortedOpponents
        .sort((a, b) => (b.wins / b.games) - (a.wins / a.games))
        .slice(0, 3)
    );

    const worstPerformance = processPerformance(
      sortedOpponents
        .sort((a, b) => (b.losses / b.games) - (a.losses / a.games))
        .slice(0, 3)
    );

    // Process format-specific stats
    const formatStats = {
      rapid: { 
        mostPlayed: [], 
        bestPerformance: [], 
        worstPerformance: [] 
      },
      blitz: { 
        mostPlayed: [], 
        bestPerformance: [], 
        worstPerformance: [] 
      },
      bullet: { 
        mostPlayed: [], 
        bestPerformance: [], 
        worstPerformance: [] 
      }
    } as ChessWrapped['opponents']['byFormat'];

    // Populate format-specific stats
    ['rapid', 'blitz', 'bullet'].forEach((format) => {
      const formatOpponents = sortedOpponents.filter(
        opponent => opponent.format === format
      );

      if (formatOpponents.length > 0) {
        formatStats[format as keyof typeof formatStats] = {
          mostPlayed: processOpponents(
            formatOpponents
              .sort((a, b) => b.games - a.games)
              .slice(0, 3)
          ),
          bestPerformance: processPerformance(
            formatOpponents
              .sort((a, b) => (b.wins / b.games) - (a.wins / a.games))
              .slice(0, 3)
          ),
          worstPerformance: processPerformance(
            formatOpponents
              .sort((a, b) => (b.losses / b.games) - (a.losses / b.games))
              .slice(0, 3)
          )
        };
      } else {
        formatStats[format as keyof typeof formatStats] = {
          mostPlayed: [defaultOpponent],
          bestPerformance: [defaultPerformance],
          worstPerformance: [defaultPerformance]
        };
      }
    });

    return {
      overall: {
        mostPlayed: mostPlayed.length > 0 ? mostPlayed : [defaultOpponent],
        bestPerformance: bestPerformance.length > 0 ? bestPerformance : [defaultPerformance],
        worstPerformance: worstPerformance.length > 0 ? worstPerformance : [defaultPerformance]
      },
      byFormat: formatStats
    };
  }

  private generatePerformanceStats(games: Game[], username: string): ChessWrapped['performance'] {
    let totalAccuracy = 0;
    let gamesWithAccuracy = 0;
    const formatAccuracy = {
      rapid: { total: 0, count: 0 },
      blitz: { total: 0, count: 0 },
      bullet: { total: 0, count: 0 }
    };

    games.forEach(game => {
      const isWhite = game.white.username.toLowerCase() === username.toLowerCase();
      if (game.accuracies) {
        const accuracy = isWhite ? game.accuracies.white : game.accuracies.black;
        if (accuracy) {
          totalAccuracy += accuracy;
          gamesWithAccuracy++;
          formatAccuracy[game.time_class].total += accuracy;
          formatAccuracy[game.time_class].count++;
        }
      }
    });

    const calculateFormatAccuracy = (format: keyof typeof formatAccuracy) => {
      return formatAccuracy[format].count >= 3
        ? Math.round((formatAccuracy[format].total / formatAccuracy[format].count) * 100) / 100
        : null;
    };

    return {
      accuracy: {
        overall: gamesWithAccuracy >= 3 ? Math.round((totalAccuracy / gamesWithAccuracy) * 100) / 100 : null,
        byFormat: {
          rapid: calculateFormatAccuracy('rapid'),
          blitz: calculateFormatAccuracy('blitz'),
          bullet: calculateFormatAccuracy('bullet')
        }
      }
    };
  }
} 