import { useState, useEffect } from 'react';

export interface AppConfig {
  rateLimit: number;
}

const DEFAULT_CONFIG: AppConfig = {
  rateLimit: 30,
};

export function useAppConfig(): AppConfig {
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);

  useEffect(() => {
    fetch('/api/config')
      .then((res) => res.json())
      .then((data) => {
        setConfig({
          rateLimit: data.rateLimit ?? DEFAULT_CONFIG.rateLimit,
        });
      })
      .catch((err) => {
        console.error('Failed to load app config:', err);
      });
  }, []);

  return config;
}
