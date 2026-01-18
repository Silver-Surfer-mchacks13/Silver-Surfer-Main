import swaggerJsdoc from 'swagger-jsdoc';
import path from 'path';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Silver Surfer API',
      version: '1.0.0',
      description: 'API for Silver Surfer - AI-powered browser automation assistant',
      contact: {
        name: 'API Support',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
      {
        url: 'https://api.example.com',
        description: 'Production server',
      },
    ],
    tags: [
      {
        name: 'Chat',
        description: 'Conversation and agent interaction endpoints',
      },
      {
        name: 'Auth',
        description: 'Authentication and authorization endpoints',
      },
      {
        name: 'Core',
        description: 'Core API endpoints (health, config)',
      },
    ],
  },
  apis: [
    path.join(process.cwd(), 'src/app/api/**/*.ts'),
  ],
};

export const swaggerSpec = swaggerJsdoc(options);
