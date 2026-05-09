import { useState, useEffect, useRef } from 'react';

export interface MarketQuote {
    code: string;
    name: string;
    price: number;
    pctChange: number;
    type: 'currency' | 'currency-usd' | 'crypto' | 'commodity';
}

const API_URL = '/api/market';
const TOKEN_KEY = "stocks-ai-brapi-token";
const INITIAL_POLL_INTERVAL = 300000; // 5 minutes
const MAX_POLL_INTERVAL = 900000; // 15 minutes
const BACKOFF_MULTIPLIER = 1.5;

export function useMarketQuotes() {
    const [quotes, setQuotes] = useState<MarketQuote[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    const pollIntervalRef = useRef(INITIAL_POLL_INTERVAL);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const fetchInProgressRef = useRef(false);
    const lastSuccessfulFetchRef = useRef<number>(0);

    const fetchQuotes = async (isManualRefresh = false) => {
        // Prevent concurrent requests
        if (fetchInProgressRef.current) return;
        
        try {
            fetchInProgressRef.current = true;
            setIsLoading(true);
            setError(null);
            
            const token = localStorage.getItem(TOKEN_KEY) || '';
            const url = token ? `${API_URL}?token=${token}` : API_URL;
            const response = await fetch(url);

            if (!response.ok) {
                if (response.status === 429) {
                    // Rate limited - increase backoff
                    pollIntervalRef.current = Math.min(
                        pollIntervalRef.current * BACKOFF_MULTIPLIER,
                        MAX_POLL_INTERVAL
                    );
                    throw new Error('Limite de requisições atingido. Tentando novamente mais tarde.');
                }
                throw new Error('Falha ao buscar cotações do mercado');
            }

            const data = await response.json();

            const mappedQuotes: MarketQuote[] = [
                {
                    code: 'USD',
                    name: 'Dólar',
                    price: parseFloat(data.USDBRL?.bid || '0'),
                    pctChange: parseFloat(data.USDBRL?.pctChange || '0'),
                    type: 'currency'
                },
                {
                    code: 'EUR',
                    name: 'Euro',
                    price: parseFloat(data.EURBRL?.bid || '0'),
                    pctChange: parseFloat(data.EURBRL?.pctChange || '0'),
                    type: 'currency'
                },
                {
                    code: 'BRL',
                    name: 'Real (em USD)',
                    price: parseFloat(data.BRLUSD?.bid || '0'),
                    pctChange: parseFloat(data.BRLUSD?.pctChange || '0'),
                    type: 'currency-usd'
                },
                {
                    code: 'BTC',
                    name: 'Bitcoin',
                    price: parseFloat(data.BTCBRL?.bid || '0'),
                    pctChange: parseFloat(data.BTCBRL?.pctChange || '0'),
                    type: 'crypto'
                },
                {
                    code: 'ETH',
                    name: 'Ethereum',
                    price: parseFloat(data.ETHBRL?.bid || '0'),
                    pctChange: parseFloat(data.ETHBRL?.pctChange || '0'),
                    type: 'crypto'
                },
                {
                    code: 'Ouro',
                    name: 'Ouro (Oz)',
                    price: parseFloat(data.XAUUSD?.bid || '0'),
                    pctChange: parseFloat(data.XAUUSD?.pctChange || '0'),
                    type: 'commodity'
                },
                {
                    code: 'Prata',
                    name: 'Prata (Oz)',
                    price: parseFloat(data.XAGUSD?.bid || '0'),
                    pctChange: parseFloat(data.XAGUSD?.pctChange || '0'),
                    type: 'commodity'
                }
            ];

            setQuotes(mappedQuotes);
            lastSuccessfulFetchRef.current = Date.now();
            
            // Reset interval on success
            if (isManualRefresh) {
                pollIntervalRef.current = INITIAL_POLL_INTERVAL;
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro desconhecido');
        } finally {
            setIsLoading(false);
            fetchInProgressRef.current = false;
            // Schedule next fetch regardless of success/fail (using updated interval)
            scheduleNextFetch();
        }
    };

    const scheduleNextFetch = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
            fetchQuotes(false);
        }, pollIntervalRef.current);
    };

    useEffect(() => {
        fetchQuotes();
        
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            fetchInProgressRef.current = false;
        };
    }, []);

    const handleRefresh = () => {
        fetchQuotes(true);
    };

    return { quotes, isLoading, error, refresh: handleRefresh };
}
