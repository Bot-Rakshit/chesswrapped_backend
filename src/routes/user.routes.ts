import { Router } from 'express';
import { UserController } from '../controllers/user.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();
const userController = new UserController();


router.get('/verify/:username', userController.verifyUser.bind(userController));
router.get('/ratings/:username', authMiddleware, userController.getRatingStats.bind(userController));
router.get('/wrapped/:username', authMiddleware, userController.getWrappedStats.bind(userController));

/*// Test endpoint for Gemini
router.get('/test-gemini', authMiddleware, async (req, res) => {
  try {
    const result = await geminiService.generateQuirkyComments({
      intro: {
        totalGames: 100,
        formatBreakdown: {
          rapid: { count: 30, percentage: 30 },
          blitz: { count: 50, percentage: 50 },
          bullet: { count: 20, percentage: 20 }
        },
        favoriteFormat: {
          format: 'blitz',
          gamesPlayed: 50,
          winRate: 55
        },
        mostGamesInDay: { date: '2024-01-01', count: 10 },
        activeMonths: {
          most: [{ month: 'January', gamesPlayed: 50 }],
          least: [{ month: 'February', gamesPlayed: 10 }]
        },
        longestStreak: {
          startDate: '2024-01-01',
          endDate: '2024-01-10',
          days: 10,
          gamesPlayed: 30
        },
        longestBreak: {
          startDate: '2024-01-20',
          endDate: '2024-02-01',
          days: 12
        }
      },
      monthlyGames: {
        mostActive: { month: 'January', games: 50 },
        leastActive: { month: 'February', games: 10 },
        distribution: []
      },
      ratings: {
        currentRatings: {
          rapid: 1500,
          blitz: 1600,
          bullet: 1400
        },
        ratingProgress: {
          rapid: [],
          blitz: [],
          bullet: []
        },
        bestRatingGains: {
          rapid: { date: '2024-01-01', gain: 50 },
          blitz: { date: '2024-01-02', gain: 40 },
          bullet: { date: '2024-01-03', gain: 30 }
        },
        worstRatingLosses: {
          rapid: { date: '2024-01-04', loss: 20 },
          blitz: { date: '2024-01-05', loss: 25 },
          bullet: { date: '2024-01-06', loss: 30 }
        },
        bestRatingDay: {
          date: '2024-01-01',
          format: 'blitz',
          gain: 50
        },
        peakRatings: {
          rapid: { rating: 1550, date: '2024-01-01' },
          blitz: { rating: 1650, date: '2024-01-02' },
          bullet: { rating: 1450, date: '2024-01-03' }
        },
        metadata: {
          firstGameDate: '2024-01-01',
          lastGameDate: '2024-02-01',
          totalGamesAnalyzed: 100
        }
      },
      formatSpecific: {},
      playingPatterns: {
        timeOfDay: {
          morning: { games: 20, winRate: 55 },
          afternoon: { games: 30, winRate: 60 },
          evening: { games: 40, winRate: 50 },
          night: { games: 10, winRate: 45 },
          bestTimeToPlay: 'afternoon'
        },
        dayOfWeek: {
          monday: { games: 15, winRate: 50 },
          tuesday: { games: 15, winRate: 55 },
          wednesday: { games: 15, winRate: 60 },
          thursday: { games: 15, winRate: 50 },
          friday: { games: 15, winRate: 45 },
          saturday: { games: 15, winRate: 50 },
          sunday: { games: 10, winRate: 55 },
          bestDayToPlay: 'wednesday'
        },
        averageGamesPerDay: 5,
        totalPlayingTime: 3000,
        averageGameDuration: 30,
        longestGame: {
          opponent: 'opponent1',
          date: '2024-01-01',
          format: 'blitz',
          result: 'win',
          duration: 60,
          url: 'https://chess.com/game/1'
        }
      },
      openings: {
        byColor: {
          asWhite: {
            topOpenings: [
              { name: 'E4 - Kings Pawn', count: 20, winRate: 60, percentage: 40 }
            ],
            worstOpenings: [
              { name: 'D4 - Queens Pawn', count: 10, winRate: 40, percentage: 20 }
            ]
          },
          asBlack: {
            topOpenings: [
              { name: 'E5 - Kings Pawn Defense', count: 15, winRate: 55, percentage: 30 }
            ],
            worstOpenings: [
              { name: 'D5 - Queens Pawn Defense', count: 8, winRate: 35, percentage: 16 }
            ]
          }
        }
      },
      opponents: {
        overall: {
          mostPlayed: [
            { username: 'opponent1', games: 20, winRate: 55, percentage: 20 }
          ],
          bestPerformance: [
            { username: 'opponent2', games: 10, winRate: 70, minGames: 1 }
          ],
          worstPerformance: [
            { username: 'opponent3', games: 10, winRate: 30, minGames: 1 }
          ]
        },
        byFormat: {}
      },
      performance: {
        accuracy: {
          overall: 85.5,
          byFormat: {
            rapid: 86.0,
            blitz: 85.0,
            bullet: 84.0
          }
        }
      }
    });
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Gemini test error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error testing Gemini service'
    });
  }
});

export default router;
*/
