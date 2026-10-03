import { useEffect, useRef, useState } from "react";
import { CURRENCIES, formatAmountInput, useCurrency, type CurrencyCode } from "../context/CurrencyContext";

export function CurrencySelect({ className = "" }: { className?: string }) {
  const { currency, setCurrency } = useCurrency();
  return (
    <select
      value={currency}
      onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
      title="Moneda"
      className={`rounded-[18px] border border-transparent bg-canvas text-ink px-2 py-2 text-sm focus:outline-none focus:border-hairline focus:ring-1 focus:ring-hairline ${className}`}
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
    value != null ? formatAmountInput(String(value), config.locale, config.decimals).display : ""
  );
  const prevCurrency = useRef(currency);

  // Reset the mask when the parent clears the value (e.g. after a successful submit).
  useEffect(() => {
    if (value === null) setDisplay("");
  }, [value]);

  // Re-mask using the new currency's separators when the currency changes.
  useEffect(() => {
    if (prevCurrency.current !== currency) {
      prevCurrency.current = currency;
      setDisplay(value != null ? formatAmountInput(String(value), config.locale, config.decimals).display : "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currency]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { display: newDisplay, numeric } = formatAmountInput(e.target.value, config.locale, config.decimals);
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
      className={`w-full rounded-[18px] border border-transparent bg-canvas text-ink placeholder:text-mid-gray px-3 py-2 text-sm focus:outline-none focus:border-hairline focus:ring-1 focus:ring-hairline ${className}`}
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
