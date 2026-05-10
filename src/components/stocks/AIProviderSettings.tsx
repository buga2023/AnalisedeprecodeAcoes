import React, { useState } from 'react';
import { Save, Trash2, ExternalLink, ShieldCheck, Cpu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAIProvider } from '@/hooks/useAIProvider';
import type { AIProvider } from '@/types/stock';

const PROVIDERS = [
  { id: 'openai' as AIProvider, name: 'OpenAI (GPT-4o)', url: 'https://platform.openai.com/api-keys' },
  { id: 'anthropic' as AIProvider, name: 'Anthropic (Claude 3.5)', url: 'https://console.anthropic.com/settings/keys' },
  { id: 'gemini' as AIProvider, name: 'Google Gemini', url: 'https://aistudio.google.com/app/apikey' },
  { id: 'groq' as AIProvider, name: 'Groq (Llama 3.3)', url: 'https://console.groq.com/keys' },
];

export const AIProviderSettings: React.FC = () => {
  const { providerConfig, setProviderConfig, clearProviderConfig } = useAIProvider();
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>(providerConfig?.provider || 'openai');
  const [apiKey, setApiKey] = useState('');
  const [isSaved, setIsSaved] = useState(!!providerConfig?.apiKey);

  const handleSave = () => {
    if (!apiKey.trim()) return;
    try {
      setProviderConfig({ provider: selectedProvider, apiKey: apiKey.trim() });
      setIsSaved(true);
      setApiKey('');
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleClear = () => {
    if (confirm('Tem certeza que deseja remover a chave de API salva localmente?')) {
      clearProviderConfig();
      setIsSaved(false);
      setApiKey('');
    }
  };

  return (
    <div className="space-y-6 p-6 rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 rounded-xl bg-primary/10">
          <Cpu className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-bold">Configuracao de IA</h3>
          <p className="text-sm text-muted-foreground">Escolha seu provedor e use sua propria chave.</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Provedor de IA</Label>
          <div className="grid grid-cols-2 gap-2">
            {PROVIDERS.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedProvider(p.id)}
                className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
                  selectedProvider === p.id
                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                    : 'border-border/50 bg-slate-900/50 hover:border-primary/30'
                }`}
              >
                <span className="text-sm font-bold">{p.name}</span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">
                  {p.id}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="api-key">API Key</Label>
            <a
              href={PROVIDERS.find((p) => p.id === selectedProvider)?.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] font-bold text-primary flex items-center gap-1 hover:underline"
            >
              Obter Chave <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <div className="relative">
            <Input
              id="api-key"
              type="password"
              placeholder={isSaved ? '••••••••••••••••' : `Insira sua chave ${selectedProvider}...`}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="pr-10 bg-slate-950/50 border-border/50"
            />
            {isSaved && !apiKey && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
              </div>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            Sua chave e salva apenas no seu navegador (localStorage) e enviada de forma segura para nossa API serverless para processar as requisicoes.
          </p>
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            onClick={handleSave}
            disabled={!apiKey.trim()}
            className="flex-1 bg-primary hover:bg-blue-600 font-bold"
          >
            <Save className="h-4 w-4 mr-2" />
            Salvar Configuração
          </Button>
          {isSaved && (
            <Button
              variant="outline"
              onClick={handleClear}
              className="border-rose-500/30 text-rose-400 hover:bg-rose-500/10"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Limpar
            </Button>
          )}
        </div>

        {isSaved && (
          <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 flex items-center gap-3">
            <div className="size-2 rounded-full bg-emerald-400 animate-pulse" />
            <p className="text-xs text-emerald-400 font-medium">
              IA configurada com <strong>{providerConfig?.provider.toUpperCase()}</strong>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
