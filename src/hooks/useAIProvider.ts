import { useState } from 'react';
import type { AIProviderConfig } from '@/types/stock';

const STORAGE_KEY = 'stocks-ai-provider-config';

export function useAIProvider() {
  const [providerConfig, setProviderConfigState] = useState<AIProviderConfig | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Erro ao carregar configuracao de IA:', e);
        return null;
      }
    }
    return null;
  });

  const setProviderConfig = (config: AIProviderConfig | null) => {
    if (config) {
      if (!config.apiKey.trim()) {
        throw new Error('API Key nao pode ser vazia');
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    setProviderConfigState(config);
  };

  const clearProviderConfig = () => {
    localStorage.removeItem(STORAGE_KEY);
    setProviderConfigState(null);
  };

  return {
    providerConfig,
    setProviderConfig,
    clearProviderConfig,
    hasConfig: !!providerConfig?.apiKey
  };
}
