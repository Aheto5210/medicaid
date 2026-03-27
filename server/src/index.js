import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';

import config from './config.js';
import authRoutes from './routes/auth.js';
import peopleRoutes from './routes/people.js';
import nhisRoutes from './routes/nhis.js';
import analyticsRoutes from './routes/analytics.js';
import usersRoutes from './routes/users.js';

const app = express();
const corsOrigins = config.corsOrigins;

app.disable('x-powered-by');
app.set('trust proxy', config.trustProxy);
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (!corsOrigins.length || corsOrigins.includes('*')) {
      return callback(null, true);
    }
    if (corsOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    environment: config.nodeEnv,
    timestamp: new Date().toISOString()
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/people', peopleRoutes);
app.use('/api/nhis', nhisRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/users', usersRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'Server error' });
});

app.listen(config.port, () => {
  console.log(`API listening on ${config.port}`);
});
