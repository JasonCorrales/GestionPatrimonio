"use client";

import {
  createContext,
  useCallback,
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
const EXCHANGE_RATE_METADATA_STORAGE_KEY = "crc-to-usd-rate-metadata";

type ExchangeRateStatus = "loading" | "automatic" | "manual" | "fallback";

type ExchangeRateMetadata = {
  date?: string;
  fetchedAt?: string;
  indicator?: string;
  label?: string;
  message?: string;
  source: "BCCR" | "manual" | "fallback";
};

type BCCRExchangeRateResponse = {
  rate: number;
  date: string;
  source: "BCCR";
  indicator: string;
  label: string;
};

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
  exchangeRateMetadata: ExchangeRateMetadata;
  exchangeRateStatus: ExchangeRateStatus;
  setDisplayCurrency: (currency: DisplayCurrency) => void;
  setExchangeRate: (rate: number) => void;
  refreshExchangeRate: () => Promise<void>;
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
  const [exchangeRateMetadata, setExchangeRateMetadata] = useState<ExchangeRateMetadata>(() => getInitialExchangeRateMetadata());
  const [exchangeRateStatus, setExchangeRateStatus] = useState<ExchangeRateStatus>("loading");

  useEffect(() => {
    localStorage.setItem(DISPLAY_CURRENCY_STORAGE_KEY, displayCurrency);
  }, [displayCurrency]);

  useEffect(() => {
    localStorage.setItem(EXCHANGE_RATE_STORAGE_KEY, String(exchangeRate));
  }, [exchangeRate]);

  useEffect(() => {
    localStorage.setItem(EXCHANGE_RATE_METADATA_STORAGE_KEY, JSON.stringify(exchangeRateMetadata));
  }, [exchangeRateMetadata]);

  const refreshExchangeRate = useCallback(async () => {
    setExchangeRateStatus("loading");

    try {
      const response = await fetch("/api/exchange-rate", { cache: "no-store" });

      if (!response.ok) {
        throw new Error("No se pudo obtener el tipo de cambio del BCCR.");
      }

      const data = await response.json() as BCCRExchangeRateResponse;
      const nextRate = sanitizeExchangeRate(data.rate);
      const metadata: ExchangeRateMetadata = {
        date: data.date,
        fetchedAt: new Date().toISOString(),
        indicator: data.indicator,
        label: data.label,
        source: "BCCR",
      };

      setExchangeRateState(nextRate);
      setExchangeRateMetadata(metadata);
      setExchangeRateStatus("automatic");
    } catch (error) {
      setExchangeRateMetadata((currentMetadata) => ({
        ...currentMetadata,
        message: getErrorMessage(error),
        source: currentMetadata.source === "BCCR" ? "BCCR" : "fallback",
      }));
      setExchangeRateStatus("fallback");
    }
  }, []);

  useEffect(() => {
    void refreshExchangeRate();
  }, [refreshExchangeRate]);

  const setManualExchangeRate = useCallback((rate: number) => {
    setExchangeRateState(sanitizeExchangeRate(rate));
    setExchangeRateMetadata({
      fetchedAt: new Date().toISOString(),
      source: "manual",
    });
    setExchangeRateStatus("manual");
  }, []);

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
      exchangeRateMetadata,
      exchangeRateStatus,
      setDisplayCurrency: setDisplayCurrencyState,
      setExchangeRate: setManualExchangeRate,
      refreshExchangeRate,
      formatCurrency,
      formatCrc,
      formatUsd,
      displayCrcAmount,
      formatCrcAmount: (amountCrc: number) => formatCurrency(displayCrcAmount(amountCrc)),
      displayRecordAmount,
      formatRecordAmount: (record: Pick<PatrimonyRecordView, "amountCrc" | "amountUsd">) =>
        formatCurrency(displayRecordAmount(record)),
    };
  }, [displayCurrency, exchangeRate, exchangeRateMetadata, exchangeRateStatus, refreshExchangeRate, setManualExchangeRate]);

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

function getInitialExchangeRateMetadata(): ExchangeRateMetadata {
  if (typeof window === "undefined") {
    return { source: "fallback" };
  }

  const savedMetadata = localStorage.getItem(EXCHANGE_RATE_METADATA_STORAGE_KEY);

  if (!savedMetadata) {
    return { source: "fallback" };
  }

  try {
    const parsedMetadata = JSON.parse(savedMetadata) as ExchangeRateMetadata;

    if (parsedMetadata.source === "BCCR" || parsedMetadata.source === "manual" || parsedMetadata.source === "fallback") {
      return parsedMetadata;
    }
  } catch {
    return { source: "fallback" };
  }

  return { source: "fallback" };
}

function sanitizeExchangeRate(rate: number) {
  return Number.isFinite(rate) && rate > 0 ? rate : DEFAULT_CRC_TO_USD_RATE;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "No se pudo obtener el tipo de cambio.";
}
