import { useEffect, useRef, useState } from "react";
import { fieldClass } from "./ui";
import { CURRENCIES, formatAmountInput, formatAmountValue, useCurrency, type CurrencyCode } from "../context/CurrencyContext";

export function CurrencySelect({ className = "" }: { className?: string }) {
  const { currency, setCurrency } = useCurrency();
  return (
    <select
      value={currency}
      onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
      title="Moneda"
      className={`${fieldClass} !px-2 ${className}`}
    >
      {Object.values(CURRENCIES).map((c) => (
        <option key={c.code} value={c.code}>
          {c.label}
        </option>
      ))}
    </select>
  );
}

export function MoneyInput({
  value,
  onChange,
  placeholder,
  required,
  className = "",
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
}) {
  const { config, currency } = useCurrency();
  const [display, setDisplay] = useState(() =>
    value != null ? formatAmountValue(value, config.locale, config.decimals) : ""
  );
  const prevCurrency = useRef(currency);
  const lastReportedValue = useRef(value);

  // Resync the mask whenever the parent sets a value we didn't just report
  // ourselves - clearing the field after submit, or a "fill this amount"
  // shortcut button - without fighting the user's own typing in between.
  useEffect(() => {
    if (value === lastReportedValue.current) return;
    lastReportedValue.current = value;
    setDisplay(value != null ? formatAmountValue(value, config.locale, config.decimals) : "");
  }, [value, config.locale, config.decimals]);

  // Re-mask using the new currency's separators when the currency changes.
  useEffect(() => {
    if (prevCurrency.current !== currency) {
      prevCurrency.current = currency;
      setDisplay(value != null ? formatAmountValue(value, config.locale, config.decimals) : "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currency]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { display: newDisplay, numeric } = formatAmountInput(e.target.value, config.locale, config.decimals);
    lastReportedValue.current = numeric;
    setDisplay(newDisplay);
    onChange(numeric);
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      value={display}
      onChange={handleChange}
      placeholder={placeholder}
      required={required}
      className={`w-full ${fieldClass} ${className}`}
    />
  );
}

// Compact pairing of a MoneyInput with the currency selector right beside it.
export function MoneyField({
  value,
  onChange,
  placeholder,
  required,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div className="flex gap-2">
      <MoneyInput value={value} onChange={onChange} placeholder={placeholder} required={required} />
      <CurrencySelect className="shrink-0 w-[6.5rem]" />
    </div>
  );
}
