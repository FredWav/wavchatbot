// Environment configuration and validation
import { z } from 'zod'

// Define environment schema
const envSchema = z.object({
  // OpenAI Configuration
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required'),
  
  // Supabase Configuration
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
  SUPABASE_SERVICE_ROLE: z.string().min(1, 'SUPABASE_SERVICE_ROLE is required'),
  SUPABASE_ANON_KEY: z.string().optional(),
  
  // Discord Configuration (optional for web-only deployment)
  DISCORD_TOKEN: z.string().optional(),
  DISCORD_CLIENT_ID: z.string().optional(),
  DISCORD_GUILD_ID: z.string().optional(),
  DISCORD_CHANNEL_ID: z.string().optional(),
  
  // API Configuration
  API_BASE_URL: z.string().url().optional().default('http://localhost:3000'),
  
  // RAG Configuration
  RAG_NAMESPACE_FRED: z.string().default('fred_corpus'),
  
  // Next.js Environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // Optional: Custom persona for production
  FRED_WAV_PERSONA: z.string().optional(),
})

// Parse and validate environment variables
function validateEnv() {
  try {
    const parsed = envSchema.parse(process.env)
    return parsed
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join('\n')
      throw new Error(`Environment validation failed:\n${missingVars}`)
    }
    throw error
  }
}

// Export validated environment
export const env = validateEnv()

// Helper functions for environment checks
export const isProduction = env.NODE_ENV === 'production'
export const isDevelopment = env.NODE_ENV === 'development'

export const hasDiscordConfig = !!(
  env.DISCORD_TOKEN && 
  env.DISCORD_CLIENT_ID && 
  env.DISCORD_GUILD_ID && 
  env.DISCORD_CHANNEL_ID
)

export const hasFullConfig = !!(
  env.OPENAI_API_KEY &&
  env.SUPABASE_URL &&
  env.SUPABASE_SERVICE_ROLE
)

// Configuration object for different deployment scenarios
export const deploymentConfig = {
  webOnly: {
    required: ['OPENAI_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE'],
    optional: ['SUPABASE_ANON_KEY', 'FRED_WAV_PERSONA']
  },
  
  withDiscord: {
    required: [
      'OPENAI_API_KEY', 
      'SUPABASE_URL', 
      'SUPABASE_SERVICE_ROLE',
      'DISCORD_TOKEN',
      'DISCORD_CLIENT_ID',
      'DISCORD_GUILD_ID',
      'DISCORD_CHANNEL_ID'
    ],
    optional: ['API_BASE_URL', 'FRED_WAV_PERSONA']
  },
  
  development: {
    required: ['OPENAI_API_KEY'],
    optional: ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE']
  }
}

// Validate specific deployment type
export function validateDeployment(type: keyof typeof deploymentConfig) {
  const config = deploymentConfig[type]
  const missing = config.required.filter(key => !process.env[key])
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables for ${type} deployment: ${missing.join(', ')}`)
  }
  
  return true
}

// Environment info for debugging
export function getEnvironmentInfo() {
  return {
    nodeEnv: env.NODE_ENV,
    hasOpenAI: !!env.OPENAI_API_KEY,
    hasSupabase: !!(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE),
    hasDiscord: hasDiscordConfig,
    apiBaseUrl: env.API_BASE_URL,
    ragNamespace: env.RAG_NAMESPACE_FRED,
    customPersona: !!env.FRED_WAV_PERSONA
  }
}