import JsBarcode from "jsbarcode";

type BarcodeEncoding = {
  data: string;
  text: string;
};

const encodingCache = new Map<string, BarcodeEncoding | null>();

export function getCode128Encoding(value: string): BarcodeEncoding | null {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return null;
  }

  if (encodingCache.has(normalizedValue)) {
    return encodingCache.get(normalizedValue) ?? null;
  }

  try {
    const output: { encodings?: BarcodeEncoding[] } = {};
    JsBarcode(output, normalizedValue, {
      format: "CODE128",
      width: 1,
      margin: 0,
      displayValue: true,
      textMargin: 0,
      fontSize: 12,
    });

    const encoding = output.encodings?.[0] ?? null;
    encodingCache.set(normalizedValue, encoding);
    return encoding;
  } catch {
    encodingCache.set(normalizedValue, null);
    return null;
  }
}
