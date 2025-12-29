import express from 'express';

const app = express();
const PORT = process.env.PORT || 3020;

app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    message: 'Willkommen bei messaging.mojo',
    port: PORT,
    status: 'online'
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 messaging.mojo läuft auf Port ${PORT}`);
  console.log(`📡 URL: http://localhost:${PORT}`);
  console.log(`🌐 Öffentlich: http://116.203.109.90/messaging.mojo/`);
});
