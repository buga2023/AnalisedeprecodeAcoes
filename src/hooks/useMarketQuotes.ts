import { useState, useEffect } from 'react';

export interface MarketQuote {
    code: string;
    name: string;
    price: number;
    pctChange: number;
    type: 'currency' | 'currency-usd' | 'crypto' | 'commodity';
}

const AWESOME_API_URL = 'https://economia.awesomeapi.com.br/last/';
const TICKERS = 'USD-BRL,EUR-BRL,BTC-BRL,ETH-BRL,XAU-USD,XAG-USD,BRL-USD';
const API_KEY = 'b0e88889286e421e69e01b7fe29aad87caa4d3e9556fb214f17b65f84faa5e49';

export function useMarketQuotes() {
    const [quotes, setQuotes] = useState<MarketQuote[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchQuotes = async () => {
        try {
            setIsLoading(true);
            setError(null);
            const response = await fetch(`${AWESOME_API_URL}${TICKERS}/?apikey=${API_KEY}`);

            if (!response.ok) {
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
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro desconhecido');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchQuotes();
        // Refresh a cada 60 segundos
        const interval = setInterval(fetchQuotes, 60000);
        return () => clearInterval(interval);
    }, []);

    return { quotes, isLoading, error, refresh: fetchQuotes };
}
