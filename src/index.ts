import express from 'express';
import cors from 'cors';
import userRoutes from './routes/user.routes';
import { config } from './config';

const app = express();

// Middleware
app.use(cors({
  origin: config.corsOrigin,
  methods: ['GET']
}));
app.use(express.json());

// Routes
app.use('/api/user', userRoutes);

// Health check endpoint
app.get('/health', (_, res) => {
  res.json({ status: 'ok' });
});

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: 'Internal Server Error'
  });
});

// Start server
const port = config.port;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
