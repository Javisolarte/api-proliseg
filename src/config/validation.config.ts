import * as Joi from 'joi';

export const validationSchema = Joi.object({
  // Application
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),
  API_PREFIX: Joi.string().default('api/v1'),

  // Supabase
  SUPABASE_URL: Joi.string().required(),
  SUPABASE_ANON_KEY: Joi.string().required(),
  SUPABASE_SERVICE_ROLE_KEY: Joi.string().required(),

  // JWT
  JWT_SECRET: Joi.string().required(),
  JWT_EXPIRATION: Joi.string().default('7d'),
  JWT_REFRESH_SECRET: Joi.string().required(),
  JWT_REFRESH_EXPIRATION: Joi.string().default('30d'),

  // Security
  BCRYPT_ROUNDS: Joi.number().default(10),
  RATE_LIMIT_TTL: Joi.number().default(60),
  RATE_LIMIT_MAX: Joi.number().default(100),

  // CORS
  CORS_ORIGIN: Joi.string().default('*'),

  // Swagger
  SWAGGER_TITLE: Joi.string().default('Proliseg API'),
  SWAGGER_DESCRIPTION: Joi.string(),
  SWAGGER_VERSION: Joi.string().default('1.0'),
  SWAGGER_PATH: Joi.string().default('api/docs'),

  // Database
  DB_SCHEMA: Joi.string().default('public'),

  // File Upload
  MAX_FILE_SIZE: Joi.number().default(5242880),
  ALLOWED_FILE_TYPES: Joi.string(),

  // Microservices
  MICROSERVICE_PORT: Joi.number().default(3001),
  REDIS_HOST: Joi.string(),
  REDIS_PORT: Joi.number(),
});