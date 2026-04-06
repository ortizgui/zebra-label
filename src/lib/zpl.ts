import type { LabelConfig } from "../types";
import { buildLabelLayout } from "./layout";

function sanitizeZplText(text: string): string {
  return text.replace(/[\r\n]+/g, " ").replace(/[\^~]/g, " ").trim();
}

function fontCommand(width: number, height: number): string {
  return `^A0N,${height},${width}`;
}

export function generateZpl(config: LabelConfig): string {
  const layout = buildLabelLayout(config);
  const output: string[] = ["^XA", "^CI28", `^PW${layout.widthDots}`, `^LL${layout.heightDots}`];

  for (const column of layout.columns) {
    for (const item of column.items) {
      for (const line of item.fieldLines) {
        output.push(
          `^FO${line.x},${line.y}${fontCommand(line.fontWidth, line.fontHeight)}^FD${sanitizeZplText(line.text)}^FS`,
        );
      }

      for (const line of item.valueLines) {
        output.push(
          `^FO${line.x},${line.y}${fontCommand(line.fontWidth, line.fontHeight)}^FD${sanitizeZplText(line.text)}^FS`,
        );
      }
    }
  }

  output.push("^XZ");
  return output.join("\n");
}
