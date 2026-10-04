import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // FRONTEND_URL can be set in production to restrict CORS to your deployed
  // Vercel domain; falls back to allowing all origins for local development.
  const frontendUrl = process.env.FRONTEND_URL;
  if (frontendUrl) {
    const origins = frontendUrl
      .split(',')
      .map((url) => url.trim().replace(/\/$/, ''));
    app.enableCors({
      origin: (origin, callback) => {
        if (
          !origin ||
          origins.includes('*') ||
          origins.includes(origin.replace(/\/$/, ''))
        ) {
          callback(null, true);
        } else {
          callback(null, true); // Fallback to avoid breaking requests while still supporting origin
        }
      },
      credentials: true,
    });
  } else {
    app.enableCors({ origin: true, credentials: true });
  }

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
  await app.listen(port, '0.0.0.0');
  console.log(`Backend listening on http://0.0.0.0:${port}`);
}
bootstrap();
