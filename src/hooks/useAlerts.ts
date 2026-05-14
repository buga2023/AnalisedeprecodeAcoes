import { useCallback, useEffect, useRef, useState } from "react";
import type { PriceAlert, AlertType, Stock } from "@/types/stock";
import { calculateGrahamValue, calculateMarginOfSafety } from "@/lib/calculators";

const STORAGE_KEY = "praxia-alerts";
const TRIGGERED_RETENTION_DAYS = 30;

function loadAlerts(): PriceAlert[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PriceAlert[];
    if (!Array.isArray(parsed)) return [];
    // Cleanup: drop triggered alerts older than retention window
    const cutoff = Date.now() - TRIGGERED_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    return parsed.filter((a) => !a.triggeredAt || new Date(a.triggeredAt).getTime() > cutoff);
  } catch {
    return [];
  }
}

function saveAlerts(list: PriceAlert[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Returns true when the alert condition is satisfied for the given stock snapshot.
 */
function matches(alert: PriceAlert, stock: Stock): boolean {
  switch (alert.type) {
    case "price-above":
      return stock.price >= alert.value;
    case "price-below":
      return stock.price > 0 && stock.price <= alert.value;
    case "graham-margin": {
      const graham = calculateGrahamValue(stock.lpa, stock.vpa);
      if (graham <= 0) return false;
      const margin = calculateMarginOfSafety(stock.price, graham) * 100;
      return margin >= alert.value;
    }
    case "change-drop":
      return stock.changePercent <= -Math.abs(alert.value);
    default:
      return false;
  }
}

function describeFiring(alert: PriceAlert, stock: Stock): string {
  switch (alert.type) {
    case "price-above":
      return `${stock.ticker} atingiu R$ ${stock.price.toFixed(2)} (alvo R$ ${alert.value.toFixed(2)})`;
    case "price-below":
      return `${stock.ticker} caiu para R$ ${stock.price.toFixed(2)} (alvo R$ ${alert.value.toFixed(2)})`;
    case "graham-margin": {
      const graham = calculateGrahamValue(stock.lpa, stock.vpa);
      const margin = graham > 0 ? calculateMarginOfSafety(stock.price, graham) * 100 : 0;
      return `${stock.ticker} com margem Graham ${margin.toFixed(1)}% (alvo ${alert.value.toFixed(0)}%)`;
    }
    case "change-drop":
      return `${stock.ticker} variou ${stock.changePercent.toFixed(2)}% hoje (gatilho ${(-Math.abs(alert.value)).toFixed(0)}%)`;
    default:
      return stock.ticker;
  }
}

async function ensureNotificationPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const res = await Notification.requestPermission();
  return res === "granted";
}

function fireNativeNotification(title: string, body: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, tag: `praxia-alert-${Date.now()}` });
  } catch {
    // Notification API can fail silently in some browsers
  }
}

export interface UseAlertsResult {
  alerts: PriceAlert[];
  activeAlerts: PriceAlert[];
  triggeredAlerts: PriceAlert[];
  permission: NotificationPermission | "unavailable";
  requestPermission: () => Promise<boolean>;
  createAlert: (input: Omit<PriceAlert, "id" | "createdAt" | "triggeredAt" | "triggerPrice">) => PriceAlert;
  removeAlert: (id: string) => void;
  resetAlert: (id: string) => void;
  /** Run the rule engine against the latest stocks snapshot. Returns alerts that just fired. */
  checkAlerts: (stocks: Stock[]) => PriceAlert[];
}

export function useAlerts(): UseAlertsResult {
  const [alerts, setAlerts] = useState<PriceAlert[]>(loadAlerts);
  const [permission, setPermission] = useState<NotificationPermission | "unavailable">(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return "unavailable";
    return Notification.permission;
  });
  // Track which firings we already announced this session to avoid double notifications.
  const announcedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    saveAlerts(alerts);
  }, [alerts]);

  const requestPermission = useCallback(async () => {
    const ok = await ensureNotificationPermission();
    setPermission(
      typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unavailable"
    );
    return ok;
  }, []);

  const createAlert = useCallback<UseAlertsResult["createAlert"]>((input) => {
    const next: PriceAlert = {
      id: genId(),
      createdAt: new Date().toISOString(),
      ...input,
    };
    setAlerts((prev) => [next, ...prev]);
    return next;
  }, []);

  const removeAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const resetAlert = useCallback((id: string) => {
    setAlerts((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, triggeredAt: undefined, triggerPrice: undefined } : a
      )
    );
  }, []);

  const checkAlerts = useCallback<UseAlertsResult["checkAlerts"]>(
    (stocks) => {
      const stockMap = new Map(stocks.map((s) => [s.ticker.toUpperCase(), s]));
      const fired: PriceAlert[] = [];
      let mutated = false;

      const nextList = alerts.map((alert) => {
        if (alert.triggeredAt) return alert;
        const stock = stockMap.get(alert.ticker.toUpperCase());
        if (!stock) return alert;
        if (!matches(alert, stock)) return alert;

        mutated = true;
        const triggered: PriceAlert = {
          ...alert,
          triggeredAt: new Date().toISOString(),
          triggerPrice: stock.price,
        };
        fired.push(triggered);

        if (!announcedRef.current.has(alert.id)) {
          announcedRef.current.add(alert.id);
          fireNativeNotification("Praxia · alerta disparado", describeFiring(alert, stock));
        }
        return triggered;
      });

      if (mutated) setAlerts(nextList);
      return fired;
    },
    [alerts]
  );

  const activeAlerts = alerts.filter((a) => !a.triggeredAt);
  const triggeredAlerts = alerts.filter((a) => !!a.triggeredAt);

  return {
    alerts,
    activeAlerts,
    triggeredAlerts,
    permission,
    requestPermission,
    createAlert,
    removeAlert,
    resetAlert,
    checkAlerts,
  };
}

export function alertTypeLabel(type: AlertType): string {
  switch (type) {
    case "price-above":
      return "Preço acima de";
    case "price-below":
      return "Preço abaixo de";
    case "graham-margin":
      return "Margem Graham ≥";
    case "change-drop":
      return "Queda no dia ≥";
  }
}

export function formatAlertTrigger(alert: PriceAlert): string {
  switch (alert.type) {
    case "price-above":
    case "price-below":
      return `R$ ${alert.value.toFixed(2)}`;
    case "graham-margin":
      return `${alert.value.toFixed(0)}%`;
    case "change-drop":
      return `${alert.value.toFixed(0)}%`;
  }
}
