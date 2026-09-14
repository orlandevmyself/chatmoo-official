import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Build allowed origins: hardcoded defaults + env-driven list
  const allowedOrigins = [
    'http://localhost:3001',
    'http://localhost:3002',
    /https:\/\/.*\.ngrok.*\.dev$/,
  ];

  // Add origins from env var (comma-separated)
  const envOrigins = process.env.ALLOWED_ORIGINS || '';
  if (envOrigins) {
    allowedOrigins.push(...envOrigins.split(',').map(o => o.trim()));
  }

  // Enable CORS for frontend, admin, ngrok tunnels, and cloud deployments (Vercel, etc)
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.some(o =>
        typeof o === 'string' ? o === origin : o.test(origin)
      )) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
}
bootstrap();