export type FontSize = "sm" | "md" | "lg";

export type LabelPreset = {
  id: string;
  name: string;
  widthMm: number;
  heightMm: number;
  dpi: number;
  marginMm: number;
};

export type LabelItem = {
  id: string;
  field: string;
  value: string;
  size?: FontSize;
};

export type LabelConfig = {
  preset: LabelPreset;
  columns: number;
  items: LabelItem[];
  align: "center";
};

export type FontMetrics = {
  fieldHeight: number;
  fieldWidth: number;
  valueHeight: number;
  valueWidth: number;
  fieldGap: number;
  itemGap: number;
  fieldMaxLines: number;
  valueMaxLines: number;
};

export type LayoutTextLine = {
  text: string;
  x: number;
  y: number;
  fontHeight: number;
  fontWidth: number;
};

export type LayoutItem = {
  id: string;
  fieldLines: LayoutTextLine[];
  valueLines: LayoutTextLine[];
  top: number;
  bottom: number;
  columnIndex: number;
};

export type LayoutColumn = {
  index: number;
  x: number;
  y: number;
  width: number;
  items: LayoutItem[];
};

export type LabelLayout = {
  widthDots: number;
  heightDots: number;
  marginDots: number;
  printableWidth: number;
  printableHeight: number;
  columns: LayoutColumn[];
};
