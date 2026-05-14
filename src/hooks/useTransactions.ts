import { useCallback, useEffect, useState } from "react";
import type { Transaction } from "@/types/stock";

const STORAGE_KEY = "praxia-transactions";

function load(): Transaction[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Transaction[];
  } catch {
    /* swallow */
  }
  return [];
}

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>(load);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
  }, [transactions]);

  const record = useCallback(
    (tx: Omit<Transaction, "id" | "timestamp">): Transaction => {
      const entry: Transaction = {
        ...tx,
        id: makeId(),
        timestamp: new Date().toISOString(),
      };
      setTransactions((prev) => [entry, ...prev]);
      return entry;
    },
    []
  );

  const clear = useCallback(() => setTransactions([]), []);

  return { transactions, record, clear };
}
