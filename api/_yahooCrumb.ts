/**
 * Yahoo Finance crumb + consent-cookie helper.
 *
 * Desde ~2023 o endpoint `quoteSummary` v10 exige um `crumb` + o cookie de
 * consentimento (senão devolve 401 "Invalid Crumb" e TODOS os fundamentos
 * vêm vazios). O fluxo: GET fc.yahoo.com (pega cookie) → GET /v1/test/getcrumb
 * (pega crumb) → usar ambos nas chamadas de quoteSummary.
 *
 * Credenciais são cacheadas em memória do processo (~30 min) — o crumb é
 * estável por sessão; refetch só quando expira ou um 401 invalida.
 */

interface YahooCreds {
  cookie: string;
  crumb: string;
}

let cached: (YahooCreds & { ts: number }) | null = null;
const TTL_MS = 30 * 60 * 1000;

/** Invalida o cache (chamar quando um quoteSummary devolve 401 mesmo com crumb). */
export function clearYahooCreds(): void {
  cached = null;
}

/**
 * Devolve `{ cookie, crumb }` válidos para chamar quoteSummary, ou `null` se o
 * fluxo falhar (a chamada deve então prosseguir sem crumb — degradação graciosa).
 */
export async function getYahooCreds(headers: Record<string, string>): Promise<YahooCreds | null> {
  if (cached && Date.now() - cached.ts < TTL_MS) {
    return { cookie: cached.cookie, crumb: cached.crumb };
  }
  try {
    // 1) cookie de consentimento (fc.yahoo.com costuma devolver 404 mas seta o cookie)
    const r1 = await fetch("https://fc.yahoo.com/", { headers });
    const setCookies =
      typeof r1.headers.getSetCookie === "function"
        ? r1.headers.getSetCookie()
        : r1.headers.get("set-cookie")
        ? [r1.headers.get("set-cookie") as string]
        : [];
    const cookie = setCookies
      .map((c) => c.split(";")[0])
      .filter(Boolean)
      .join("; ");
    if (!cookie) return null;

    // 2) crumb
    const r2 = await fetch("https://query1.finance.yahoo.com/v1/test/getcrumb", {
      headers: { ...headers, Cookie: cookie },
    });
    if (!r2.ok) return null;
    const crumb = (await r2.text()).trim();
    // crumb é curto (~11 chars). HTML/JSON = falha de login/consent → descarta.
    if (!crumb || crumb.length > 32 || /[<>{}]/.test(crumb)) return null;

    cached = { cookie, crumb, ts: Date.now() };
    return { cookie, crumb };
  } catch {
    return null;
  }
}
