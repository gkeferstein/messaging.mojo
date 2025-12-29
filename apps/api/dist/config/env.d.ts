export declare const env: {
    PORT: number;
    RATE_LIMIT_MAX: number;
    RATE_LIMIT_WINDOW_MS: number;
    isDev: boolean;
    isProd: boolean;
    corsOrigins: boolean | string[];
    NODE_ENV: "development" | "production" | "test";
    HOST: string;
    DATABASE_URL: string;
    REDIS_URL: string;
    CLERK_SECRET_KEY: string;
    ACCOUNTS_API_URL: string;
    CORS_ORIGINS: string;
    LOG_LEVEL: "fatal" | "error" | "warn" | "info" | "debug" | "trace";
    CLERK_PUBLISHABLE_KEY?: string | undefined;
    ACCOUNTS_INTERNAL_TOKEN?: string | undefined;
};
export type Env = typeof env;
//# sourceMappingURL=env.d.ts.map