// backend/src/index.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { runMigrations } from './db/migrate.js';
import authRoutes from './routes/auth.js';
import movieRoutes from './routes/movies.js';
import watchlistRoutes from './routes/watchlist.js';
import interactionRoutes from './routes/interactions.js';
import providerRoutes from './routes/providers.js';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: ['http://localhost:5173'], credentials: true }));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/movies', movieRoutes);
app.use('/api/watchlist', watchlistRoutes);
app.use('/api/interactions', interactionRoutes);
app.use('/api/providers', providerRoutes);

app.get('/api/health', (_, res) => res.json({ status: 'ok' }));

async function boot() {
  await runMigrations();
  app.listen(PORT, () => console.log(`Velora API → http://localhost:${PORT}`));
}

boot().catch(console.error);