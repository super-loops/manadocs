export type EnvCategory =
  | 'general'
  | 'database'
  | 'storage'
  | 'mail'
  | 'collab'
  | 'search'
  | 'ai'
  | 'events'
  | 'billing'
  | 'telemetry';

export interface EnvRegistryEntry {
  key: string;
  category: EnvCategory;
  description: string;
  defaultValue?: string;
  secret?: boolean;
  /** Allowed values (for enum-like envs). */
  enum?: string[];
}

export const ENV_REGISTRY: EnvRegistryEntry[] = [
  // general
  {
    key: 'NODE_ENV',
    category: 'general',
    description: 'Runtime environment.',
    defaultValue: 'development',
    enum: ['development', 'production'],
  },
  {
    key: 'PORT',
    category: 'general',
    description: 'HTTP port the server listens on.',
    defaultValue: '3000',
  },
  {
    key: 'APP_URL',
    category: 'general',
    description: 'Public base URL of the application.',
  },
  {
    key: 'APP_SECRET',
    category: 'general',
    description: 'Secret key used to sign tokens. Must be at least 32 chars.',
    secret: true,
  },
  {
    key: 'MANADOCS_DEFAULT_LANG',
    category: 'general',
    description:
      'Default language for new users and pre-login screens (BCP-47).',
    defaultValue: 'en-US',
    enum: [
      'en-US',
      'ko-KR',
      'ja-JP',
      'zh-CN',
      'es-ES',
      'fr-FR',
      'pt-BR',
      'ru-RU',
      'uk-UA',
      'de-DE',
      'it-IT',
      'nl-NL',
    ],
  },
  {
    key: 'JWT_TOKEN_EXPIRES_IN',
    category: 'general',
    description: 'JWT expiration duration (e.g. 90d, 24h).',
    defaultValue: '90d',
  },
  {
    key: 'SUBDOMAIN_HOST',
    category: 'general',
    description: 'Root domain for subdomain-per-workspace mode (cloud only).',
  },
  {
    key: 'CLOUD',
    category: 'general',
    description: 'Enable cloud/multi-tenant mode.',
    defaultValue: 'false',
    enum: ['true', 'false'],
  },

  // database
  {
    key: 'DATABASE_URL',
    category: 'database',
    description: 'Postgres connection string.',
    secret: true,
  },
  {
    key: 'DATABASE_MAX_POOL',
    category: 'database',
    description: 'Max database connection pool size.',
    defaultValue: '10',
  },

  // storage
  {
    key: 'STORAGE_DRIVER',
    category: 'storage',
    description: 'File storage backend.',
    defaultValue: 'local',
    enum: ['local', 's3'],
  },
  {
    key: 'FILE_UPLOAD_SIZE_LIMIT',
    category: 'storage',
    description: 'Max upload size for a single file.',
    defaultValue: '50mb',
  },
  {
    key: 'FILE_IMPORT_SIZE_LIMIT',
    category: 'storage',
    description: 'Max file size for imports.',
    defaultValue: '200mb',
  },
  {
    key: 'AWS_S3_ACCESS_KEY_ID',
    category: 'storage',
    description: 'S3 access key ID.',
    secret: true,
  },
  {
    key: 'AWS_S3_SECRET_ACCESS_KEY',
    category: 'storage',
    description: 'S3 secret access key.',
    secret: true,
  },
  {
    key: 'AWS_S3_REGION',
    category: 'storage',
    description: 'S3 bucket region.',
  },
  {
    key: 'AWS_S3_BUCKET',
    category: 'storage',
    description: 'S3 bucket name.',
  },
  {
    key: 'AWS_S3_ENDPOINT',
    category: 'storage',
    description: 'Custom S3 endpoint (for S3-compatible services).',
  },
  {
    key: 'AWS_S3_FORCE_PATH_STYLE',
    category: 'storage',
    description: 'Force path-style S3 URLs.',
    enum: ['true', 'false'],
  },

  // mail
  {
    key: 'MAIL_DRIVER',
    category: 'mail',
    description: 'Email transport driver.',
    defaultValue: 'log',
    enum: ['log', 'smtp', 'postmark'],
  },
  {
    key: 'MAIL_FROM_ADDRESS',
    category: 'mail',
    description: 'Default "From" email address.',
  },
  {
    key: 'MAIL_FROM_NAME',
    category: 'mail',
    description: 'Default "From" name.',
    defaultValue: 'Manadocs',
  },
  {
    key: 'SMTP_HOST',
    category: 'mail',
    description: 'SMTP host.',
  },
  {
    key: 'SMTP_PORT',
    category: 'mail',
    description: 'SMTP port.',
  },
  {
    key: 'SMTP_SECURE',
    category: 'mail',
    description: 'Use TLS for SMTP.',
    defaultValue: 'false',
    enum: ['true', 'false'],
  },
  {
    key: 'SMTP_USERNAME',
    category: 'mail',
    description: 'SMTP username.',
  },
  {
    key: 'SMTP_PASSWORD',
    category: 'mail',
    description: 'SMTP password.',
    secret: true,
  },
  {
    key: 'POSTMARK_TOKEN',
    category: 'mail',
    description: 'Postmark server token.',
    secret: true,
  },

  // collab
  {
    key: 'COLLAB_URL',
    category: 'collab',
    description: 'Public URL of the collaboration WebSocket server.',
  },

  // search
  {
    key: 'SEARCH_DRIVER',
    category: 'search',
    description: 'Full-text search backend.',
    defaultValue: 'database',
    enum: ['database', 'typesense'],
  },
  {
    key: 'TYPESENSE_URL',
    category: 'search',
    description: 'Typesense server URL.',
    defaultValue: 'http://localhost:8108',
  },
  {
    key: 'TYPESENSE_API_KEY',
    category: 'search',
    description: 'Typesense API key.',
    secret: true,
  },
  {
    key: 'TYPESENSE_LOCALE',
    category: 'search',
    description: 'Typesense tokenizer locale.',
    defaultValue: 'en',
  },

  // ai
  {
    key: 'AI_DRIVER',
    category: 'ai',
    description: 'AI provider driver.',
    enum: ['openai', 'openai-compatible', 'gemini', 'ollama'],
  },
  {
    key: 'AI_COMPLETION_MODEL',
    category: 'ai',
    description: 'Completion model name.',
  },
  {
    key: 'AI_EMBEDDING_MODEL',
    category: 'ai',
    description: 'Embedding model name.',
  },
  {
    key: 'AI_EMBEDDING_DIMENSION',
    category: 'ai',
    description: 'Embedding vector dimension.',
    enum: ['768', '1024', '1536', '2000', '3072'],
  },
  {
    key: 'OPENAI_API_KEY',
    category: 'ai',
    description: 'OpenAI API key.',
    secret: true,
  },
  {
    key: 'OPENAI_API_URL',
    category: 'ai',
    description: 'OpenAI-compatible base URL.',
  },
  {
    key: 'GEMINI_API_KEY',
    category: 'ai',
    description: 'Google Gemini API key.',
    secret: true,
  },
  {
    key: 'OLLAMA_API_URL',
    category: 'ai',
    description: 'Ollama base URL.',
    defaultValue: 'http://localhost:11434',
  },

  // events
  {
    key: 'EVENT_STORE_DRIVER',
    category: 'events',
    description: 'Event store backend.',
    defaultValue: 'postgres',
    enum: ['postgres', 'clickhouse'],
  },
  {
    key: 'CLICKHOUSE_URL',
    category: 'events',
    description: 'ClickHouse connection URL.',
    secret: true,
  },

  // telemetry
  {
    key: 'DISABLE_TELEMETRY',
    category: 'telemetry',
    description: 'Disable anonymous usage telemetry.',
    defaultValue: 'false',
    enum: ['true', 'false'],
  },
];
