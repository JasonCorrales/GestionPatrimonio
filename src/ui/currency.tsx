"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { PatrimonyRecordView } from "@/application/use-cases/PatrimonyRecordService";

export type DisplayCurrency = "CRC" | "USD";

const DEFAULT_CRC_TO_USD_RATE = 520;
const DISPLAY_CURRENCY_STORAGE_KEY = "display-currency-preference";
const EXCHANGE_RATE_STORAGE_KEY = "manual-crc-to-usd-rate";

const crcFormatter = new Intl.NumberFormat("es-CR", {
  style: "currency",
  currency: "CRC",
  maximumFractionDigits: 0,
});

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

type CurrencyPreferenceContextValue = {
  displayCurrency: DisplayCurrency;
  exchangeRate: number;
  setDisplayCurrency: (currency: DisplayCurrency) => void;
  setExchangeRate: (rate: number) => void;
  formatCurrency: (amount: number) => string;
  formatCrc: (amount: number) => string;
  formatUsd: (amount: number) => string;
  displayCrcAmount: (amountCrc: number) => number;
  formatCrcAmount: (amountCrc: number) => string;
  displayRecordAmount: (record: Pick<PatrimonyRecordView, "amountCrc" | "amountUsd">) => number;
  formatRecordAmount: (record: Pick<PatrimonyRecordView, "amountCrc" | "amountUsd">) => string;
};

const CurrencyPreferenceContext = createContext<CurrencyPreferenceContextValue | null>(null);

export function CurrencyPreferenceProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [displayCurrency, setDisplayCurrencyState] = useState<DisplayCurrency>(() => getInitialDisplayCurrency());
  const [exchangeRate, setExchangeRateState] = useState(() => getInitialExchangeRate());

  useEffect(() => {
    localStorage.setItem(DISPLAY_CURRENCY_STORAGE_KEY, displayCurrency);
  }, [displayCurrency]);

  useEffect(() => {
    localStorage.setItem(EXCHANGE_RATE_STORAGE_KEY, String(exchangeRate));
  }, [exchangeRate]);

  const value = useMemo<CurrencyPreferenceContextValue>(() => {
    const safeExchangeRate = sanitizeExchangeRate(exchangeRate);

    function formatCurrency(amount: number) {
      return displayCurrency === "USD" ? formatUsd(amount) : formatCrc(amount);
    }

    function displayCrcAmount(amountCrc: number) {
      return displayCurrency === "USD" ? amountCrc / safeExchangeRate : amountCrc;
    }

    function displayRecordAmount(record: Pick<PatrimonyRecordView, "amountCrc" | "amountUsd">) {
      if (displayCurrency === "USD") {
        return record.amountUsd ?? record.amountCrc / safeExchangeRate;
      }

      return record.amountCrc;
    }

    return {
      displayCurrency,
      exchangeRate: safeExchangeRate,
      setDisplayCurrency: setDisplayCurrencyState,
      setExchangeRate: (rate: number) => setExchangeRateState(sanitizeExchangeRate(rate)),
      formatCurrency,
      formatCrc,
      formatUsd,
      displayCrcAmount,
      formatCrcAmount: (amountCrc: number) => formatCurrency(displayCrcAmount(amountCrc)),
      displayRecordAmount,
      formatRecordAmount: (record: Pick<PatrimonyRecordView, "amountCrc" | "amountUsd">) =>
        formatCurrency(displayRecordAmount(record)),
    };
  }, [displayCurrency, exchangeRate]);

  return (
    <CurrencyPreferenceContext.Provider value={value}>
      {children}
    </CurrencyPreferenceContext.Provider>
  );
}

export function useCurrencyPreference() {
  const value = useContext(CurrencyPreferenceContext);

  if (!value) {
    throw new Error("useCurrencyPreference must be used within CurrencyPreferenceProvider");
  }

  return value;
}

export function formatCrc(amount: number) {
  return crcFormatter.format(amount);
}

export function formatUsd(amount: number) {
  return usdFormatter.format(amount);
}

function getInitialDisplayCurrency(): DisplayCurrency {
  if (typeof window === "undefined") {
    return "CRC";
  }

  const savedCurrency = localStorage.getItem(DISPLAY_CURRENCY_STORAGE_KEY);

  return savedCurrency === "USD" ? "USD" : "CRC";
}

function getInitialExchangeRate() {
  if (typeof window === "undefined") {
    return DEFAULT_CRC_TO_USD_RATE;
  }

  const savedRate = Number(localStorage.getItem(EXCHANGE_RATE_STORAGE_KEY));

  return sanitizeExchangeRate(savedRate);
}

function sanitizeExchangeRate(rate: number) {
  return Number.isFinite(rate) && rate > 0 ? rate : DEFAULT_CRC_TO_USD_RATE;
}
