import type {
  FontMetrics,
  FontSize,
  LabelConfig,
  LabelItem,
  LabelLayout,
  LayoutColumn,
  LayoutItem,
  LayoutTextLine,
} from "../types";

const DOTS_PER_MM = 8;
const COLUMN_GAP_DOTS = 12;
const FONT_METRICS: Record<FontSize, FontMetrics> = {
  sm: {
    fieldHeight: 18,
    fieldWidth: 10,
    valueHeight: 24,
    valueWidth: 14,
    fieldGap: 4,
    itemGap: 16,
    fieldMaxLines: 1,
    valueMaxLines: 2,
  },
  md: {
    fieldHeight: 20,
    fieldWidth: 11,
    valueHeight: 30,
    valueWidth: 16,
    fieldGap: 6,
    itemGap: 18,
    fieldMaxLines: 2,
    valueMaxLines: 2,
  },
  lg: {
    fieldHeight: 22,
    fieldWidth: 12,
    valueHeight: 38,
    valueWidth: 20,
    fieldGap: 6,
    itemGap: 20,
    fieldMaxLines: 2,
    valueMaxLines: 3,
  },
};

type PreparedItem = {
  item: LabelItem;
  metrics: FontMetrics;
  fieldLines: string[];
  valueLines: string[];
  height: number;
};

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
    return ["-"];
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

  if (lines.length === 0) {
    lines.push(cleanText.slice(0, maxChars));
  }

  const wasTruncated = tokens.join(" ").length > lines.join(" ").length;
  if (wasTruncated) {
    const lastIndex = lines.length - 1;
    const truncatedLine = lines[lastIndex].slice(0, Math.max(1, maxChars - 1)).trimEnd();
    lines[lastIndex] = `${truncatedLine}…`;
  }

  return lines;
}

function itemHeight(prepared: PreparedItem): number {
  return (
    prepared.fieldLines.length * prepared.metrics.fieldHeight +
    prepared.metrics.fieldGap +
    prepared.valueLines.length * prepared.metrics.valueHeight +
    prepared.metrics.itemGap
  );
}

function prepareItem(item: LabelItem, columnWidth: number): PreparedItem {
  const metrics = FONT_METRICS[item.size ?? "md"];
  const contentWidth = Math.max(36, columnWidth - 12);
  const prepared: PreparedItem = {
    item,
    metrics,
    fieldLines: wrapText(item.field, contentWidth, metrics.fieldWidth, metrics.fieldMaxLines),
    valueLines: wrapText(item.value, contentWidth, metrics.valueWidth, metrics.valueMaxLines),
    height: 0,
  };
  prepared.height = itemHeight(prepared);
  return prepared;
}

function fitItemsToColumn(items: PreparedItem[], printableHeight: number) {
  let totalHeight = items.reduce((sum, item) => sum + item.height, 0);

  if (totalHeight <= printableHeight) {
    return;
  }

  for (const item of items) {
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

function buildTextLines(
  lines: string[],
  startY: number,
  columnX: number,
  columnWidth: number,
  fontHeight: number,
  fontWidth: number,
): LayoutTextLine[] {
  return lines.map((line, index) => ({
    text: line,
    x: centerLineText(columnX, columnWidth, fontWidth, line),
    y: startY + index * fontHeight,
    fontHeight,
    fontWidth,
  }));
}

function buildItemLayout(prepared: PreparedItem, columnX: number, columnWidth: number, top: number, columnIndex: number): LayoutItem {
  const fieldLines = buildTextLines(
    prepared.fieldLines,
    top,
    columnX,
    columnWidth,
    prepared.metrics.fieldHeight,
    prepared.metrics.fieldWidth,
  );

  const valueStartY = top + prepared.fieldLines.length * prepared.metrics.fieldHeight + prepared.metrics.fieldGap;
  const valueLines = buildTextLines(
    prepared.valueLines,
    valueStartY,
    columnX,
    columnWidth,
    prepared.metrics.valueHeight,
    prepared.metrics.valueWidth,
  );

  const bottom = valueStartY + prepared.valueLines.length * prepared.metrics.valueHeight;

  return {
    id: prepared.item.id,
    fieldLines,
    valueLines,
    top,
    bottom,
    columnIndex,
  };
}

export function buildLabelLayout(config: LabelConfig): LabelLayout {
  const widthDots = mmToDots(config.preset.widthMm);
  const heightDots = mmToDots(config.preset.heightMm);
  const marginDots = mmToDots(config.preset.marginMm);
  const printableWidth = widthDots - marginDots * 2;
  const printableHeight = heightDots - marginDots * 2;
  const totalGap = COLUMN_GAP_DOTS * Math.max(0, config.columns - 1);
  const columnWidth = Math.floor((printableWidth - totalGap) / config.columns);
  const groups = splitEvenly(config.items, config.columns);

  const columns: LayoutColumn[] = groups.map((group, columnIndex) => {
    const preparedItems = group.map((item) => prepareItem(item, columnWidth));
    fitItemsToColumn(preparedItems, printableHeight);
    const contentHeight = preparedItems.reduce(
      (sum, item, index) => sum + item.height - (index === preparedItems.length - 1 ? item.metrics.itemGap : 0),
      0,
    );
    const x = marginDots + columnIndex * (columnWidth + COLUMN_GAP_DOTS);
    let currentY = marginDots + Math.max(0, Math.floor((printableHeight - contentHeight) / 2));

    const items = preparedItems.map((prepared) => {
      const layoutItem = buildItemLayout(prepared, x, columnWidth, currentY, columnIndex);
      currentY = layoutItem.bottom + prepared.metrics.itemGap;
      return layoutItem;
    });

    return {
      index: columnIndex,
      x,
      y: marginDots,
      width: columnWidth,
      items,
    };
  });

  return {
    widthDots,
    heightDots,
    marginDots,
    printableWidth,
    printableHeight,
    columns,
  };
}
