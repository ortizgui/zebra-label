import type { LabelConfig } from "../types";
import { buildLabelLayout, mmToDots } from "./layout";

function sanitizeZplText(text: string): string {
  return text.replace(/[\r\n]+/g, " ").replace(/[\^~]/g, " ").trim();
}

function fontCommand(width: number, height: number): string {
  return `^A0N,${height},${width}`;
}

export function generateZpl(config: LabelConfig): string {
  const layout = buildLabelLayout(config);
  const offsetXDots = mmToDots(config.printOffsetXMm);
  const offsetYDots = mmToDots(config.printOffsetYMm);
  const output: string[] = [
    "^XA",
    "^CI28",
    "^MMT",
    `^PW${layout.widthDots}`,
    `^LL${layout.heightDots}`,
    `^LH${offsetXDots},${offsetYDots}`,
    `^PQ${config.printQuantity}`,
  ];

  for (const cell of layout.cells) {
    for (const column of cell.columns) {
      for (const item of column.items) {
        for (const line of item.fieldLines) {
          output.push(
            `^FO${line.x},${line.y}${fontCommand(line.fontWidth, line.fontHeight)}^FD${sanitizeZplText(line.text)}^FS`,
          );
        }

        for (const line of item.valueLines) {
          if (item.kind === "barcode") {
            output.push(`^BY${item.barcodeModuleWidth ?? 1},2,${item.barcodeHeight ?? 20}`);
            output.push(`^FO${item.barcodeX ?? line.x},${item.top}^BCN,${item.barcodeHeight ?? 20},N,N,N`);
            output.push(`^FD${sanitizeZplText(line.text)}^FS`);
            output.push(
              `^FO${line.x},${line.y}${fontCommand(line.fontWidth, line.fontHeight)}^FD${sanitizeZplText(line.text)}^FS`,
            );
            continue;
          }

          output.push(`^FO${line.x},${line.y}${fontCommand(line.fontWidth, line.fontHeight)}^FD${sanitizeZplText(line.text)}^FS`);
        }
      }
    }
  }

  output.push("^XZ");
  return output.join("\n");
}
