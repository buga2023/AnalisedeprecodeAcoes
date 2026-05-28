import { useCallback, useEffect, useRef, useState } from "react";
import type { Transaction } from "@/types/stock";
import { useAuth } from "@/hooks/useAuth";
import {
  bulkUploadTransactions,
  clearAllTransactionsOnServer,
  fetchTransactionsFromServer,
  insertTransactionOnServer,
} from "@/lib/supabaseSync";

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

/**
 * Gera UUID v4 quando disponivel (browsers modernos via crypto.randomUUID).
 * Fallback: timestamp+random — usado em ambientes mais velhos. Importante: o
 * schema Supabase espera UUID — o fallback gera UUID v4 manualmente.
 */
function makeId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback UUID v4 simples (RFC4122-like, suficiente pra MVP).
  const hex = "0123456789abcdef";
  const out: string[] = [];
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) out.push("-");
    else if (i === 14) out.push("4");
    else if (i === 19) out.push(hex[(Math.random() * 4) | (0 + 8)]);
    else out.push(hex[(Math.random() * 16) | 0]);
  }
  return out.join("");
}

export function useTransactions() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>(load);
  const syncedUserRef = useRef<string | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
  }, [transactions]);

  // Sync on login.
  useEffect(() => {
    if (!user) {
      syncedUserRef.current = null;
      return;
    }
    if (syncedUserRef.current === user.id) return;

    let cancelled = false;
    (async () => {
      const remote = await fetchTransactionsFromServer(user.id);
      if (cancelled) return;
      syncedUserRef.current = user.id;

      if (remote && remote.length > 0) {
        setTransactions(remote);
      } else {
        // Servidor vazio — migra o local se existir.
        const local = load();
        if (local.length > 0) {
          await bulkUploadTransactions(user.id, local);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const record = useCallback(
    (tx: Omit<Transaction, "id" | "timestamp">): Transaction => {
      const entry: Transaction = {
        ...tx,
        id: makeId(),
        timestamp: new Date().toISOString(),
      };
      setTransactions((prev) => [entry, ...prev]);
      if (user) void insertTransactionOnServer(user.id, entry);
      return entry;
    },
    [user]
  );

  const clear = useCallback(() => {
    setTransactions([]);
    if (user) void clearAllTransactionsOnServer(user.id);
  }, [user]);

  return { transactions, record, clear };
}
