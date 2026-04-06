import type { LabelPreset } from "../types";

export const LABEL_PRESETS: LabelPreset[] = [
  { id: "shipping-100x150", name: '100 x 150 mm (4" x 6")', widthMm: 100, heightMm: 150, dpi: 203, marginMm: 3 },
  { id: "shipping-102x99", name: "102 x 99 mm", widthMm: 102, heightMm: 99, dpi: 203, marginMm: 3 },
  { id: "shipping-102x152", name: '102 x 152 mm (4" x 6")', widthMm: 102, heightMm: 152, dpi: 203, marginMm: 3 },
  { id: "product-76x51", name: '76 x 51 mm (3" x 2")', widthMm: 76, heightMm: 51, dpi: 203, marginMm: 2 },
  { id: "product-50x25", name: '50 x 25 mm (2" x 1")', widthMm: 50, heightMm: 25, dpi: 203, marginMm: 2 },
  { id: "product-38x25", name: '38 x 25 mm (1.5" x 1")', widthMm: 38, heightMm: 25, dpi: 203, marginMm: 2 },
  { id: "product-69x49", name: "69 x 49 mm", widthMm: 69, heightMm: 49, dpi: 203, marginMm: 2 },
  { id: "address-57x32", name: '57 x 32 mm (2.25" x 1.25")', widthMm: 57, heightMm: 32, dpi: 203, marginMm: 2 },
  { id: "address-57x89", name: '57 x 89 mm (2.25" x 3.5")', widthMm: 57, heightMm: 89, dpi: 203, marginMm: 2 },
  { id: "square-50x50", name: '50 x 50 mm (2" x 2")', widthMm: 50, heightMm: 50, dpi: 203, marginMm: 2 },
  { id: "square-32x32", name: '32 x 32 mm (1.25" x 1.25")', widthMm: 32, heightMm: 32, dpi: 203, marginMm: 2 },
];

export const DEFAULT_ITEMS = [
  { id: crypto.randomUUID(), field: "Produto", value: "Mouse Gamer", size: "lg" as const },
  { id: crypto.randomUUID(), field: "Código", value: "12345", size: "md" as const },
  { id: crypto.randomUUID(), field: "Preço", value: "R$ 199,90", size: "lg" as const },
];
