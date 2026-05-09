import { useState, useEffect, useRef } from 'react';

export interface MarketQuote {
    code: string;
    name: string;
    price: number;
    pctChange: number;
    type: 'currency' | 'currency-usd' | 'crypto' | 'commodity';
}

const API_URL = '/api/market';
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
            
            const response = await fetch(API_URL);

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
                    price: parseFloat(data.USDBRL.bid),
                    pctChange: parseFloat(data.USDBRL.pctChange),
                    type: 'currency'
                },
                {
                    code: 'EUR',
                    name: 'Euro',
                    price: parseFloat(data.EURBRL.bid),
                    pctChange: parseFloat(data.EURBRL.pctChange),
                    type: 'currency'
                },
                {
                    code: 'BRL',
                    name: 'Real (em USD)',
                    price: parseFloat(data.BRLUSD.bid),
                    pctChange: parseFloat(data.BRLUSD.pctChange),
                    type: 'currency-usd'
                },
                {
                    code: 'BTC',
                    name: 'Bitcoin',
                    price: parseFloat(data.BTCBRL.bid),
                    pctChange: parseFloat(data.BTCBRL.pctChange),
                    type: 'crypto'
                },
                {
                    code: 'ETH',
                    name: 'Ethereum',
                    price: parseFloat(data.ETHBRL.bid),
                    pctChange: parseFloat(data.ETHBRL.pctChange),
                    type: 'crypto'
                },
                {
                    code: 'Ouro',
                    name: 'Ouro (Oz)',
                    price: parseFloat(data.XAUUSD.bid),
                    pctChange: parseFloat(data.XAUUSD.pctChange),
                    type: 'commodity'
                },
                {
                    code: 'Prata',
                    name: 'Prata (Oz)',
                    price: parseFloat(data.XAGUSD.bid),
                    pctChange: parseFloat(data.XAGUSD.pctChange),
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
