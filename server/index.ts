import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth';
import adminRoutes from './routes/admin';
import userRoutes from './routes/user';
import businessRoutes from './routes/business';
import carRoutes from './routes/cars';
import bidRoutes from './routes/bids';
import lotRoutes from './routes/lots';
import questionRoutes from './routes/questions';
import termsRoutes from './routes/terms';
import otpRoutes from './routes/otp';

const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

app.use(cors({
  origin: FRONTEND_URL,
  credentials: true
}));

app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/users', userRoutes);
app.use('/api/business', businessRoutes);
app.use('/api/cars', carRoutes);
app.use('/api/bids', bidRoutes);
app.use('/api/lots', lotRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/terms', termsRoutes);
app.use('/api/otp', otpRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
