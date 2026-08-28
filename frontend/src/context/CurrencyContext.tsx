import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type CurrencyCode = "CLP" | "USD" | "EUR";

export interface CurrencyConfig {
  code: CurrencyCode;
  locale: string;
  label: string;
  decimals: number;
}

export const CURRENCIES: Record<CurrencyCode, CurrencyConfig> = {
  CLP: { code: "CLP", locale: "es-CL", label: "$ CLP", decimals: 0 },
  USD: { code: "USD", locale: "en-US", label: "US$ USD", decimals: 2 },
  EUR: { code: "EUR", locale: "es-ES", label: "€ EUR", decimals: 2 },
};

interface CurrencyContextValue {
  currency: CurrencyCode;
  setCurrency: (c: CurrencyCode) => void;
  config: CurrencyConfig;
  formatMoney: (amount: number) => string;
}

const CurrencyContext = createContext<CurrencyContextValue | undefined>(undefined);

const STORAGE_KEY = "taskflow_currency";

function isCurrencyCode(v: string | null): v is CurrencyCode {
  return v === "CLP" || v === "USD" || v === "EUR";
}

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<CurrencyCode>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isCurrencyCode(stored) ? stored : "CLP";
  });

  const setCurrency = (c: CurrencyCode) => {
    localStorage.setItem(STORAGE_KEY, c);
    setCurrencyState(c);
  };

  const value = useMemo<CurrencyContextValue>(() => {
    const config = CURRENCIES[currency];
    const formatMoney = (amount: number) =>
      amount.toLocaleString(config.locale, { style: "currency", currency: config.code });
    return { currency, setCurrency, config, formatMoney };
  }, [currency]);

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used within CurrencyProvider");
  return ctx;
}

// Reads the group/decimal separator characters a locale actually uses,
// so the live input mask matches (e.g. "." for CLP thousands, "," for USD).
function getSeparators(locale: string) {
  const parts = new Intl.NumberFormat(locale).formatToParts(1234.5);
  return {
    group: parts.find((p) => p.type === "group")?.value ?? ",",
    decimal: parts.find((p) => p.type === "decimal")?.value ?? ".",
  };
}

export function formatAmountInput(rawValue: string, locale: string, decimals: number): { display: string; numeric: number | null } {
  const { group, decimal } = getSeparators(locale);
  let cleaned = "";
  let seenDecimal = false;
  for (const ch of rawValue) {
    if (ch >= "0" && ch <= "9") cleaned += ch;
    else if (ch === decimal && decimals > 0 && !seenDecimal) {
      cleaned += ".";
      seenDecimal = true;
    }
  }
  if (cleaned === "" || cleaned === ".") return { display: "", numeric: null };

  const [intPartRaw, decPartRaw = ""] = cleaned.split(".");
  const intPart = (intPartRaw.replace(/^0+(?=\d)/, "")) || "0";
  const decPart = decPartRaw.slice(0, decimals);

  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, group);
  const display = seenDecimal ? `${grouped}${decimal}${decPart}` : grouped;
  const numeric = parseFloat(`${intPart}.${decPart || "0"}`);
  return { display, numeric };
}
