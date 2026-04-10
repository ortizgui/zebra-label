export type FontSize = number;

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
  kind: "pair" | "text" | "barcode";
  field: string;
  value: string;
  size?: FontSize;
  sizeMode?: "auto" | "manual";
};

export type LabelConfig = {
  preset: LabelPreset;
  itemColumns: number;
  labelsPerRow: number;
  rows: number;
  printQuantity: number;
  items: LabelItem[];
  align: "left" | "center";
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
  kind: LabelItem["kind"];
  fieldLines: LayoutTextLine[];
  valueLines: LayoutTextLine[];
  top: number;
  bottom: number;
  columnIndex: number;
  barcodeX?: number;
  barcodeWidth?: number;
  barcodeHeight?: number;
  barcodeModuleWidth?: number;
};

export type LayoutColumn = {
  index: number;
  x: number;
  y: number;
  width: number;
  items: LayoutItem[];
};

export type LayoutCell = {
  id: string;
  rowIndex: number;
  columnIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  columns: LayoutColumn[];
};

export type LabelLayout = {
  widthDots: number;
  heightDots: number;
  labelWidthDots: number;
  labelHeightDots: number;
  marginDots: number;
  printableWidth: number;
  printableHeight: number;
  cells: LayoutCell[];
};
