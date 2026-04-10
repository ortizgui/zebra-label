import type {
  FontMetrics,
  FontSize,
  LabelConfig,
  LabelItem,
  LabelLayout,
  LayoutCell,
  LayoutColumn,
  LayoutItem,
  LayoutTextLine,
} from "../types";
import { getCode128Encoding } from "./barcode";

const DOTS_PER_MM = 8;
const CONTENT_COLUMN_GAP_DOTS = 12;
const BARCODE_TEXT_GAP = 4;
const LEFT_PADDING_DOTS = 6;
const MIN_BARCODE_HEIGHT = 14;
const MIN_BARCODE_TEXT_HEIGHT = 8;
const MIN_FONT_SIZE = 8;
const MAX_FONT_SIZE = 40;

type PreparedItem = {
  item: LabelItem;
  metrics: FontMetrics;
  fieldLines: string[];
  valueLines: string[];
  height: number;
  fontSize: number;
  barcodeHeight: number;
  barcodeTextHeight: number;
  barcodeModuleWidth: number;
  barcodeWidth: number;
};

function printableDimensions(config: LabelConfig) {
  const marginDots = mmToDots(config.preset.marginMm);
  const printableWidth = mmToDots(config.preset.widthMm) - marginDots * 2;
  const printableHeight = mmToDots(config.preset.heightMm) - marginDots * 2;
  return { printableWidth, printableHeight };
}

function contentColumnWidth(config: LabelConfig) {
  const { printableWidth } = printableDimensions(config);
  const totalGap = CONTENT_COLUMN_GAP_DOTS * Math.max(0, config.itemColumns - 1);
  return Math.floor((printableWidth - totalGap) / config.itemColumns);
}

export function suggestAutoFontSize(config: LabelConfig, item: LabelItem): number {
  const columnWidth = Math.max(36, contentColumnWidth(config));
  const { printableHeight } = printableDimensions(config);
  const itemsPerColumn = Math.max(1, Math.ceil(config.items.length / config.itemColumns));
  const widthScore = columnWidth / (item.kind === "barcode" ? 10 : item.kind === "pair" ? 7.6 : 8.8);
  const heightScore =
    printableHeight /
    itemsPerColumn /
    (item.kind === "barcode" ? 2.15 : item.kind === "pair" ? 1.9 : 1.45);
  const bonus = item.kind === "barcode" ? 1.5 : item.kind === "pair" ? 0 : 0.5;

  return normalizeFontSize(Math.min(widthScore, heightScore) + bonus);
}

export function mmToDots(mm: number): number {
  return Math.round(mm * DOTS_PER_MM);
}

function splitEvenly<T>(items: T[], columns: number): T[][] {
  const result: T[][] = [];
  const base = Math.floor(items.length / columns);
  const remainder = items.length % columns;
  let cursor = 0;

  for (let index = 0; index < columns; index += 1) {
    const size = base + (index < remainder ? 1 : 0);
    result.push(items.slice(cursor, cursor + size));
    cursor += size;
  }

  return result;
}

function splitLongToken(token: string, maxChars: number): string[] {
  if (token.length <= maxChars) {
    return [token];
  }

  const chunks: string[] = [];
  for (let index = 0; index < token.length; index += maxChars) {
    chunks.push(token.slice(index, index + maxChars));
  }
  return chunks;
}

function wrapText(text: string, maxWidth: number, charWidth: number, maxLines: number): string[] {
  const cleanText = text.trim().replace(/\s+/g, " ");

  if (!cleanText) {
    return [];
  }

  const maxChars = Math.max(1, Math.floor(maxWidth / charWidth));
  const tokens = cleanText.split(" ").flatMap((token) => splitLongToken(token, maxChars));
  const lines: string[] = [];
  let currentLine = "";

  for (const token of tokens) {
    const candidate = currentLine ? `${currentLine} ${token}` : token;

    if (candidate.length <= maxChars) {
      currentLine = candidate;
      continue;
    }

    if (currentLine) {
      lines.push(currentLine);
    }
    currentLine = token;

    if (lines.length === maxLines) {
      break;
    }
  }

  if (currentLine && lines.length < maxLines) {
    lines.push(currentLine);
  }

  const wasTruncated = tokens.join(" ").length > lines.join(" ").length;
  if (wasTruncated && lines.length > 0) {
    const lastIndex = lines.length - 1;
    const truncatedLine = lines[lastIndex].slice(0, Math.max(1, maxChars - 1)).trimEnd();
    lines[lastIndex] = `${truncatedLine}…`;
  }

  return lines;
}

function itemHeight(prepared: PreparedItem): number {
  if (prepared.item.kind === "barcode") {
    return prepared.barcodeHeight + BARCODE_TEXT_GAP + prepared.barcodeTextHeight + prepared.metrics.itemGap;
  }

  const fieldHeight = prepared.fieldLines.length * prepared.metrics.fieldHeight;
  const valueHeight = prepared.valueLines.length * prepared.metrics.valueHeight;
  const separatorGap = prepared.fieldLines.length > 0 && prepared.valueLines.length > 0 ? prepared.metrics.fieldGap : 0;

  return fieldHeight + separatorGap + valueHeight + prepared.metrics.itemGap;
}

function normalizeFontSize(size?: FontSize): number {
  const numericSize = Number(size ?? 12);
  const safeSize = Number.isFinite(numericSize) ? numericSize : 12;
  return Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, Math.round(safeSize)));
}

function buildFontMetrics(size: number, kind: LabelItem["kind"]): FontMetrics {
  const normalizedSize = normalizeFontSize(size);
  const fieldHeight = Math.max(9, normalizedSize);
  const fieldWidth = Math.max(6, Math.round(normalizedSize * 0.62));
  const valueHeight = kind === "barcode" ? Math.max(8, Math.round(normalizedSize * 0.9)) : Math.max(10, Math.round(normalizedSize * 1.18));
  const valueWidth = Math.max(6, Math.round(valueHeight * 0.55));
  const compact = normalizedSize <= 10;

  return {
    fieldHeight,
    fieldWidth,
    valueHeight,
    valueWidth,
    fieldGap: compact ? 2 : normalizedSize <= 14 ? 3 : 4,
    itemGap: compact ? 5 : normalizedSize <= 14 ? 7 : 10,
    fieldMaxLines: normalizedSize <= 10 ? 1 : 2,
    valueMaxLines: normalizedSize <= 11 ? 2 : 3,
  };
}

function estimateBarcodeModuleCount(value: string): number {
  const encoding = getCode128Encoding(value);
  return encoding?.data.length ?? 60;
}

function pickBarcodeModuleWidth(barcodeValue: string, availableWidth: number): number {
  const moduleCount = estimateBarcodeModuleCount(barcodeValue);

  for (const moduleWidth of [3, 2, 1]) {
    if (moduleCount * moduleWidth <= availableWidth) {
      return moduleWidth;
    }
  }

  return 1;
}

function defaultBarcodeHeight(size: number): number {
  return Math.max(18, Math.round(size * 2.1));
}

function defaultBarcodeTextHeight(size: number): number {
  return Math.max(9, Math.round(size * 0.9));
}

function prepareItem(item: LabelItem, columnWidth: number): PreparedItem {
  const size = normalizeFontSize(item.size);
  const metrics = buildFontMetrics(size, item.kind);
  const contentWidth = Math.max(36, columnWidth - 12);
  const fieldLines =
    item.kind === "pair" ? wrapText(item.field, contentWidth, metrics.fieldWidth, metrics.fieldMaxLines) : [];
  const valueLines =
    item.kind === "barcode"
      ? wrapText(item.value, contentWidth, metrics.valueWidth, 1)
      : wrapText(item.value, contentWidth, metrics.valueWidth, metrics.valueMaxLines);
  const barcodeModuleWidth = pickBarcodeModuleWidth(item.value, contentWidth);
  const barcodeWidth = estimateBarcodeModuleCount(item.value) * barcodeModuleWidth;
  const prepared: PreparedItem = {
    item,
    metrics,
    fieldLines,
    valueLines,
    height: 0,
    fontSize: size,
    barcodeHeight: item.kind === "barcode" ? defaultBarcodeHeight(size) : 0,
    barcodeTextHeight: item.kind === "barcode" ? defaultBarcodeTextHeight(size) : 0,
    barcodeModuleWidth,
    barcodeWidth,
  };
  prepared.height = itemHeight(prepared);
  return prepared;
}

function recomputePreparedItem(item: PreparedItem, columnWidth: number) {
  const recomputed = prepareItem({ ...item.item, size: item.fontSize }, columnWidth);
  item.metrics = recomputed.metrics;
  item.fieldLines = recomputed.fieldLines;
  item.valueLines = recomputed.valueLines;
  item.height = recomputed.height;
  item.barcodeHeight = recomputed.barcodeHeight;
  item.barcodeTextHeight = recomputed.barcodeTextHeight;
  item.barcodeModuleWidth = recomputed.barcodeModuleWidth;
  item.barcodeWidth = recomputed.barcodeWidth;
}

function fitItemsToColumn(items: PreparedItem[], printableHeight: number, columnWidth: number) {
  let totalHeight = items.reduce((sum, item) => sum + item.height, 0);

  if (totalHeight <= printableHeight) {
    return;
  }

  for (const item of items) {
    while (totalHeight > printableHeight && item.item.kind !== "barcode" && item.fontSize > MIN_FONT_SIZE) {
      item.fontSize -= 1;
      recomputePreparedItem(item, columnWidth);
      totalHeight = items.reduce((sum, current) => sum + current.height, 0);
    }
  }

  for (const item of items) {
    while (totalHeight > printableHeight && item.item.kind === "barcode" && item.barcodeHeight > MIN_BARCODE_HEIGHT) {
      item.barcodeHeight -= 2;
      item.height = itemHeight(item);
      totalHeight = items.reduce((sum, current) => sum + current.height, 0);
    }

    while (
      totalHeight > printableHeight &&
      item.item.kind === "barcode" &&
      item.barcodeTextHeight > MIN_BARCODE_TEXT_HEIGHT
    ) {
      item.barcodeTextHeight -= 1;
      item.height = itemHeight(item);
      totalHeight = items.reduce((sum, current) => sum + current.height, 0);
    }

    while (totalHeight > printableHeight && item.valueLines.length > 1) {
      item.valueLines = item.valueLines.slice(0, -1);
      item.valueLines[item.valueLines.length - 1] = `${item.valueLines[item.valueLines.length - 1].replace(/…$/, "")}…`;
      item.height = itemHeight(item);
      totalHeight = items.reduce((sum, current) => sum + current.height, 0);
    }

    while (totalHeight > printableHeight && item.fieldLines.length > 1) {
      item.fieldLines = item.fieldLines.slice(0, -1);
      item.fieldLines[item.fieldLines.length - 1] = `${item.fieldLines[item.fieldLines.length - 1].replace(/…$/, "")}…`;
      item.height = itemHeight(item);
      totalHeight = items.reduce((sum, current) => sum + current.height, 0);
    }
  }
}

function centerLineText(columnX: number, columnWidth: number, fontWidth: number, text: string): number {
  const width = Math.max(fontWidth, text.length * fontWidth);
  return Math.round(columnX + (columnWidth - width) / 2);
}

function lineTextX(
  config: LabelConfig,
  columnX: number,
  columnWidth: number,
  fontWidth: number,
  text: string,
  forceCenter = false,
): number {
  if (!forceCenter && config.align === "left") {
    return columnX + LEFT_PADDING_DOTS;
  }

  return centerLineText(columnX, columnWidth, fontWidth, text);
}

function buildTextLines(
  config: LabelConfig,
  lines: string[],
  startY: number,
  columnX: number,
  columnWidth: number,
  fontHeight: number,
  fontWidth: number,
  forceCenter = false,
): LayoutTextLine[] {
  return lines.map((line, index) => ({
    text: line,
    x: lineTextX(config, columnX, columnWidth, fontWidth, line, forceCenter),
    y: startY + index * fontHeight,
    fontHeight,
    fontWidth,
  }));
}

function buildItemLayout(
  config: LabelConfig,
  prepared: PreparedItem,
  columnX: number,
  columnWidth: number,
  top: number,
  columnIndex: number,
): LayoutItem {
  const barcodeX =
    prepared.item.kind === "barcode"
      ? Math.round(columnX + (columnWidth - prepared.barcodeWidth) / 2)
      : undefined;
  const fieldLines = buildTextLines(
    config,
    prepared.fieldLines,
    top,
    columnX,
    columnWidth,
    prepared.metrics.fieldHeight,
    prepared.metrics.fieldWidth,
  );

  const separatorGap = prepared.fieldLines.length > 0 && prepared.valueLines.length > 0 ? prepared.metrics.fieldGap : 0;
  const valueStartY =
    prepared.item.kind === "barcode"
      ? top + prepared.barcodeHeight + BARCODE_TEXT_GAP
      : top + prepared.fieldLines.length * prepared.metrics.fieldHeight + separatorGap;
  const valueLines = buildTextLines(
    config,
    prepared.valueLines,
    valueStartY,
    columnX,
    columnWidth,
    prepared.item.kind === "barcode" ? prepared.barcodeTextHeight : prepared.metrics.valueHeight,
    prepared.metrics.valueWidth,
    prepared.item.kind === "barcode",
  );

  const bottom =
    prepared.item.kind === "barcode"
      ? valueStartY + prepared.barcodeTextHeight
      : valueStartY + prepared.valueLines.length * prepared.metrics.valueHeight;

  return {
    id: prepared.item.id,
    kind: prepared.item.kind,
    fieldLines,
    valueLines,
    top,
    bottom,
    columnIndex,
    barcodeX,
    barcodeWidth: prepared.item.kind === "barcode" ? prepared.barcodeWidth : undefined,
    barcodeHeight: prepared.item.kind === "barcode" ? prepared.barcodeHeight : undefined,
    barcodeModuleWidth: prepared.item.kind === "barcode" ? prepared.barcodeModuleWidth : undefined,
  };
}

function buildContentColumns(
  config: LabelConfig,
  labelOffsetX: number,
  labelOffsetY: number,
  printableWidth: number,
  printableHeight: number,
  marginDots: number,
): LayoutColumn[] {
  const totalGap = CONTENT_COLUMN_GAP_DOTS * Math.max(0, config.itemColumns - 1);
  const columnWidth = Math.floor((printableWidth - totalGap) / config.itemColumns);
  const groups = splitEvenly(config.items, config.itemColumns);

  return groups.map((group, columnIndex) => {
    const preparedItems = group.map((item) => prepareItem(item, columnWidth));
    fitItemsToColumn(preparedItems, printableHeight, columnWidth);
    const contentHeight = preparedItems.reduce(
      (sum, item, index) => sum + item.height - (index === preparedItems.length - 1 ? item.metrics.itemGap : 0),
      0,
    );
    const x = labelOffsetX + marginDots + columnIndex * (columnWidth + CONTENT_COLUMN_GAP_DOTS);
    let currentY = labelOffsetY + marginDots + Math.max(0, Math.floor((printableHeight - contentHeight) / 2));

    const items = preparedItems.map((prepared) => {
      const layoutItem = buildItemLayout(config, prepared, x, columnWidth, currentY, columnIndex);
      currentY = layoutItem.bottom + prepared.metrics.itemGap;
      return layoutItem;
    });

    return {
      index: columnIndex,
      x,
      y: labelOffsetY + marginDots,
      width: columnWidth,
      items,
    };
  });
}

export function buildLabelLayout(config: LabelConfig): LabelLayout {
  const labelWidthDots = mmToDots(config.preset.widthMm);
  const labelHeightDots = mmToDots(config.preset.heightMm);
  const labelGapXDots = mmToDots(config.labelGapXMm);
  const labelGapYDots = mmToDots(config.labelGapYMm);
  const marginDots = mmToDots(config.preset.marginMm);
  const printableWidth = labelWidthDots - marginDots * 2;
  const printableHeight = labelHeightDots - marginDots * 2;

  const cells: LayoutCell[] = [];

  for (let rowIndex = 0; rowIndex < config.rows; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < config.labelsPerRow; columnIndex += 1) {
      const x = columnIndex * (labelWidthDots + labelGapXDots);
      const y = rowIndex * (labelHeightDots + labelGapYDots);

      cells.push({
        id: `cell-${rowIndex}-${columnIndex}`,
        rowIndex,
        columnIndex,
        x,
        y,
        width: labelWidthDots,
        height: labelHeightDots,
        columns: buildContentColumns(config, x, y, printableWidth, printableHeight, marginDots),
      });
    }
  }

  return {
    widthDots: labelWidthDots * config.labelsPerRow + labelGapXDots * Math.max(0, config.labelsPerRow - 1),
    heightDots: labelHeightDots * config.rows + labelGapYDots * Math.max(0, config.rows - 1),
    labelWidthDots,
    labelHeightDots,
    labelGapXDots,
    labelGapYDots,
    marginDots,
    printableWidth,
    printableHeight,
    cells,
  };
}
