import { useEffect, useMemo, useState } from "react";
import { DEFAULT_ITEMS, LABEL_PRESETS } from "./data/presets";
import { getCode128Encoding } from "./lib/barcode";
import { buildLabelLayout, mmToDots, suggestAutoFontSize } from "./lib/layout";
import { generateZpl } from "./lib/zpl";
import type { FontSize, LabelConfig, LabelItem } from "./types";

const STORAGE_KEY = "zebra-label-generator-config";
const LEGACY_CNPJ_EXAMPLE = "CNPJ: 21.413.038/0001-86";
const SAFE_CNPJ_PLACEHOLDER = "CNPJ: 00.000.000/0000-00";
const LEGACY_BARCODE_EXAMPLE = "11313366633";
const SAFE_BARCODE_PLACEHOLDER = "12345678910";

type PersistedConfig = {
  presetId: string;
  itemColumns: number;
  labelsPerRow: number;
  rows: number;
  printQuantity: number;
  items: LabelItem[];
  align?: LabelConfig["align"];
};

function createItem(): LabelItem {
  return {
    id: crypto.randomUUID(),
    kind: "pair",
    field: "",
    value: "",
    size: 12,
    sizeMode: "auto",
  };
}

function normalizeSize(size?: FontSize | string): number {
  if (typeof size === "string") {
    if (size === "xs") {
      return 8;
    }
    if (size === "sm") {
      return 10;
    }
    if (size === "md") {
      return 12;
    }
    if (size === "lg") {
      return 16;
    }
    if (size === "xl") {
      return 20;
    }
  }

  const numericSize = Number(size ?? 12);
  const safeSize = Number.isFinite(numericSize) ? numericSize : 12;
  return Math.min(40, Math.max(8, Math.round(safeSize)));
}

function normalizeItem(item: LabelItem): LabelItem {
  const normalizedValue =
    item.value === LEGACY_CNPJ_EXAMPLE
      ? SAFE_CNPJ_PLACEHOLDER
      : item.value === LEGACY_BARCODE_EXAMPLE
        ? SAFE_BARCODE_PLACEHOLDER
        : item.value ?? "";

  return {
    id: item.id || crypto.randomUUID(),
    kind: item.kind ?? "text",
    field: item.field ?? "",
    value: normalizedValue,
    size: normalizeSize(item.size),
    sizeMode: item.sizeMode === "manual" ? "manual" : "auto",
  };
}

function createDefaultConfig(): LabelConfig {
  return {
    preset: LABEL_PRESETS.find((preset) => preset.id === "product-40x25") ?? LABEL_PRESETS[0],
    itemColumns: 1,
    labelsPerRow: 2,
    rows: 1,
    printQuantity: 20,
    items: DEFAULT_ITEMS,
    align: "left",
  };
}

function getInitialConfig(): LabelConfig {
  if (typeof window === "undefined") {
    return createDefaultConfig();
  }

  const storedValue = window.localStorage.getItem(STORAGE_KEY);
  if (!storedValue) {
    return createDefaultConfig();
  }

  try {
    const savedConfig = JSON.parse(storedValue) as Partial<PersistedConfig> & { columns?: number };
    return {
      preset: LABEL_PRESETS.find((preset) => preset.id === savedConfig.presetId) ?? createDefaultConfig().preset,
      itemColumns: Math.min(4, Math.max(1, savedConfig.itemColumns ?? savedConfig.columns ?? 1)),
      labelsPerRow: Math.min(6, Math.max(1, savedConfig.labelsPerRow ?? 2)),
      rows: Math.min(60, Math.max(1, savedConfig.rows ?? 1)),
      printQuantity: Math.min(500, Math.max(1, savedConfig.printQuantity ?? savedConfig.rows ?? 20)),
      items: savedConfig.items?.length ? savedConfig.items.map(normalizeItem) : DEFAULT_ITEMS,
      align: savedConfig.align === "center" ? "center" : "left",
    };
  } catch {
    return createDefaultConfig();
  }
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function FieldHint({ text }: { text: string }) {
  return (
    <span className="field-hint" title={text} aria-label={text}>
      i
    </span>
  );
}

function FieldLabel({ label, hint }: { label: string; hint: string }) {
  return (
    <span className="field-label-row">
      <span>{label}</span>
      <FieldHint text={hint} />
    </span>
  );
}

function PreviewSvg({ config, zoom }: { config: LabelConfig; zoom: number }) {
  const layout = useMemo(() => buildLabelLayout(config), [config]);
  const basePreviewWidth = Math.max(240, Math.round(layout.widthDots * 0.52));
  const basePreviewHeight = Math.max(180, Math.round(layout.heightDots * 0.52));
  const previewWidth = Math.round(basePreviewWidth * zoom);
  const previewHeight = Math.round(basePreviewHeight * zoom);

  return (
    <svg
      className="preview-svg"
      viewBox={`0 0 ${layout.widthDots} ${layout.heightDots}`}
      width={previewWidth}
      height={previewHeight}
      role="img"
      aria-label="Pré-visualização da grade de etiquetas"
    >
      <rect width={layout.widthDots} height={layout.heightDots} rx="8" fill="#f5f0ea" />

      {layout.cells.map((cell) => (
        <g key={cell.id}>
          <rect x={cell.x} y={cell.y} width={cell.width} height={cell.height} rx="8" fill="#fffdf7" stroke="#d9c8b4" />
          <rect
            x={cell.x + layout.marginDots}
            y={cell.y + layout.marginDots}
            width={layout.printableWidth}
            height={layout.printableHeight}
            fill="none"
            stroke="#d0b79b"
            strokeDasharray="8 6"
          />

          {cell.columns.map((column) => (
            <g key={`${cell.id}-column-${column.index}`}>
              <rect
                x={column.x}
                y={column.y}
                width={column.width}
                height={layout.printableHeight}
                fill="rgba(184, 128, 70, 0.08)"
                stroke="rgba(111, 56, 16, 0.12)"
              />

              {column.items.map((item) => (
                <g key={`${cell.id}-${item.id}`}>
                  {item.kind === "barcode"
                    ? (() => {
                        const barcodeText = item.valueLines[0]?.text ?? "";
                        const encoding = getCode128Encoding(barcodeText);

                        if (!encoding) {
                          return null;
                        }

                        const bars = [];
                        const moduleWidth = item.barcodeModuleWidth ?? 1;
                        const barcodeHeight = Math.max(8, (item.barcodeHeight ?? 24) - 4);
                        let cursorX = item.barcodeX ?? column.x + 8;
                        let currentBit = encoding.data[0];
                        let runLength = 0;

                        for (const bit of encoding.data) {
                          if (bit === currentBit) {
                            runLength += 1;
                            continue;
                          }

                          if (currentBit === "1") {
                            bars.push(
                              <rect
                                key={`bar-${cursorX}`}
                                x={cursorX}
                                y={item.top + 2}
                                width={runLength * moduleWidth}
                                height={barcodeHeight}
                                fill="#1d1a17"
                              />,
                            );
                          }

                          cursorX += runLength * moduleWidth;
                          currentBit = bit;
                          runLength = 1;
                        }

                        if (currentBit === "1") {
                          bars.push(
                            <rect
                              key={`bar-${cursorX}`}
                              x={cursorX}
                              y={item.top + 2}
                              width={runLength * moduleWidth}
                              height={barcodeHeight}
                              fill="#1d1a17"
                            />,
                          );
                        }

                        return <g>{bars}</g>;
                      })()
                    : null}

                  {item.fieldLines.map((line, index) => (
                    <text
                      key={`field-${index}`}
                      x={line.x}
                      y={line.y + line.fontHeight}
                      fontSize={line.fontHeight}
                      fontFamily="IBM Plex Sans, sans-serif"
                      fontWeight="600"
                      fill="#6a5946"
                    >
                      {line.text}
                    </text>
                  ))}

                  {item.valueLines.map((line, index) => (
                    <text
                      key={`value-${index}`}
                      x={line.x}
                      y={line.y + line.fontHeight}
                      fontSize={line.fontHeight}
                      fontFamily="Space Grotesk, sans-serif"
                      fontWeight="700"
                      fill="#1d1a17"
                    >
                      {line.text}
                    </text>
                  ))}
                </g>
              ))}
            </g>
          ))}
        </g>
      ))}
    </svg>
  );
}

export default function App() {
  const [config, setConfig] = useState<LabelConfig>(getInitialConfig);
  const [copyFeedback, setCopyFeedback] = useState("");
  const [previewZoom, setPreviewZoom] = useState(1);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  const effectiveConfig = useMemo<LabelConfig>(
    () => ({
      ...config,
      items: config.items.map((item) => ({
        ...item,
        size: item.sizeMode === "manual" ? normalizeSize(item.size) : suggestAutoFontSize(config, item),
      })),
    }),
    [config],
  );

  useEffect(() => {
    const data: PersistedConfig = {
      presetId: config.preset.id,
      itemColumns: config.itemColumns,
      labelsPerRow: config.labelsPerRow,
      rows: config.rows,
      printQuantity: config.printQuantity,
      items: config.items,
      align: config.align,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [config]);

  useEffect(() => {
    if (!copyFeedback) {
      return undefined;
    }

    const timeout = window.setTimeout(() => setCopyFeedback(""), 2000);
    return () => window.clearTimeout(timeout);
  }, [copyFeedback]);

  const zplContent = useMemo(() => generateZpl(effectiveConfig), [effectiveConfig]);
  const sizeSummary = `${config.preset.widthMm} x ${config.preset.heightMm} mm por etiqueta • ${mmToDots(config.preset.widthMm)} x ${mmToDots(config.preset.heightMm)} dots`;
  const printAreaSummary = `${config.labelsPerRow} por linha • ${config.rows} linhas • área final ${config.preset.widthMm * config.labelsPerRow} x ${config.preset.heightMm * config.rows} mm`;

  function updatePreset(presetId: string) {
    const preset = LABEL_PRESETS.find((entry) => entry.id === presetId);
    if (!preset) {
      return;
    }
    setConfig((current) => ({ ...current, preset }));
  }

  function updateItem(id: string, key: keyof Omit<LabelItem, "id">, value: string) {
    setConfig((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === id
          ? {
              ...item,
              [key]: key === "size" ? normalizeSize(Number(value) || 12) : value,
            }
          : item,
      ),
    }));
  }

  function addItem() {
    setConfig((current) => ({ ...current, items: [...current.items, createItem()] }));
  }

  function removeItem(id: string) {
    setConfig((current) => ({
      ...current,
      items: current.items.length > 1 ? current.items.filter((item) => item.id !== id) : current.items,
    }));
  }

  function moveItemToIndex(id: string, targetIndex: number) {
    setConfig((current) => {
      const index = current.items.findIndex((item) => item.id === id);
      if (index === -1) {
        return current;
      }

      if (targetIndex < 0 || targetIndex >= current.items.length) {
        return current;
      }

      if (targetIndex === index) {
        return current;
      }

      const items = [...current.items];
      const [moved] = items.splice(index, 1);
      items.splice(targetIndex, 0, moved);

      return {
        ...current,
        items,
      };
    });
  }

  function handleItemDrop(targetId: string) {
    if (!draggedItemId || draggedItemId === targetId) {
      setDraggedItemId(null);
      setDropTargetId(null);
      return;
    }

    const targetIndex = config.items.findIndex((item) => item.id === targetId);
    if (targetIndex !== -1) {
      moveItemToIndex(draggedItemId, targetIndex);
    }

    setDraggedItemId(null);
    setDropTargetId(null);
  }

  async function copyZpl() {
    try {
      await navigator.clipboard.writeText(zplContent);
      setCopyFeedback("ZPL copiado");
    } catch {
      setCopyFeedback("Não foi possível copiar");
    }
  }

  function adjustPreviewZoom(direction: "in" | "out") {
    setPreviewZoom((current) => {
      const nextValue = direction === "in" ? current + 0.2 : current - 0.2;
      return Math.min(2.4, Math.max(0.6, Number(nextValue.toFixed(2))));
    });
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <p className="eyebrow">Gerador Zebra</p>
        <h1>Etiquetas Zebra em ZPL, prontas para baixar</h1>
        <p className="hero-copy">
          Agora o gerador separa a medida de cada etiqueta da grade de impressão. Assim fica mais fácil trabalhar
          com folhas em várias colunas, repetir a mesma etiqueta por linha e ajustar blocos com ou sem estrutura de
          campo e valor.
        </p>
      </section>

      <section className="workspace">
        <aside className="panel controls-panel">
          <div className="panel-header">
            <h2>Configuração</h2>
            <p>{sizeSummary}</p>
            <p>{printAreaSummary}</p>
          </div>

          <div className="field-grid">
            <label className="field-group">
              <FieldLabel label="Tamanho de cada etiqueta" hint="Escolha o tamanho físico de uma única etiqueta. Quando você trocar esse valor, a prévia e o ZPL serão recalculados automaticamente." />
              <select value={config.preset.id} onChange={(event) => updatePreset(event.target.value)}>
                {LABEL_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="field-group">
              <FieldLabel label="Etiquetas por linha" hint="Define quantas etiquetas iguais aparecem lado a lado em cada linha da folha ou bobina." />
              <select
                value={config.labelsPerRow}
                onChange={(event) =>
                  setConfig((current) => ({
                    ...current,
                    labelsPerRow: Number(event.target.value),
                  }))
                }
              >
                {[1, 2, 3, 4, 5, 6].map((column) => (
                  <option key={column} value={column}>
                    {column}
                  </option>
                ))}
              </select>
            </label>

            <label className="field-group">
              <FieldLabel label="Quantidade de linhas" hint="Quantidade de linhas de etiquetas repetidas na área final de impressão." />
              <input
                type="number"
                min={1}
                max={60}
                value={config.rows}
                onChange={(event) =>
                  setConfig((current) => ({
                    ...current,
                    rows: Math.min(60, Math.max(1, Number(event.target.value) || 1)),
                  }))
                }
              />
            </label>

            <label className="field-group">
              <FieldLabel label="Quantidade na impressão (^PQ)" hint="Número de repetições enviado para a impressora no comando ^PQ. Use quando quiser várias cópias do mesmo layout." />
              <input
                type="number"
                min={1}
                max={500}
                value={config.printQuantity}
                onChange={(event) =>
                  setConfig((current) => ({
                    ...current,
                    printQuantity: Math.min(500, Math.max(1, Number(event.target.value) || 1)),
                  }))
                }
              />
            </label>

            <label className="field-group">
              <FieldLabel label="Colunas internas de conteúdo" hint="Divide o conteúdo de cada etiqueta em colunas internas. Na maioria dos casos, deixe em 1." />
              <select
                value={config.itemColumns}
                onChange={(event) =>
                  setConfig((current) => ({
                    ...current,
                    itemColumns: Number(event.target.value),
                  }))
                }
              >
                {[1, 2, 3, 4].map((column) => (
                  <option key={column} value={column}>
                    {column}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="field-group">
            <FieldLabel label="Alinhamento do texto" hint="Escolha se o texto deve começar pela esquerda ou ficar centralizado dentro da etiqueta." />
            <select
              value={config.align}
              onChange={(event) =>
                setConfig((current) => ({
                  ...current,
                  align: event.target.value as LabelConfig["align"],
                }))
              }
            >
              <option value="left">Esquerda</option>
              <option value="center">Centralizado</option>
            </select>
          </label>

          <div className="items-header">
            <div>
              <div className="items-title-row">
                <h3>Blocos de conteúdo</h3>
                <FieldHint text="Você pode clicar e arrastar os blocos pela alça pontilhada para mudar a ordem das linhas na etiqueta." />
              </div>
              <p>Cada bloco pode ser campo + valor ou apenas um texto livre.</p>
            </div>
            <button type="button" className="secondary-button" onClick={addItem}>
              Adicionar bloco
            </button>
          </div>

          <div className="items-list">
            {config.items.map((item, index) => (
              <article
                key={item.id}
                className={`item-card ${draggedItemId === item.id ? "item-card-dragging" : ""} ${dropTargetId === item.id && draggedItemId !== item.id ? "item-card-drop-target" : ""}`}
                draggable
                onDragStart={() => setDraggedItemId(item.id)}
                onDragEnd={() => {
                  setDraggedItemId(null);
                  setDropTargetId(null);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  if (draggedItemId && draggedItemId !== item.id) {
                    setDropTargetId(item.id);
                  }
                }}
                onDragLeave={() => {
                  if (dropTargetId === item.id) {
                    setDropTargetId(null);
                  }
                }}
                onDrop={() => handleItemDrop(item.id)}
              >
                {(() => {
                  const suggestedSize = suggestAutoFontSize(config, item);
                  const isAuto = item.sizeMode !== "manual";

                  return (
                    <>
                <div className="item-card-header">
                  <div className="item-card-title">
                    <button type="button" className="drag-handle" aria-label={`Arrastar bloco ${index + 1}`}>
                      ⋮⋮
                    </button>
                    <strong>Bloco {index + 1}</strong>
                  </div>
                  <div className="item-card-actions">
                    <button type="button" className="danger-button" onClick={() => removeItem(item.id)}>
                      Remover bloco
                    </button>
                  </div>
                </div>

                <label className="field-group">
                  <FieldLabel label="Tipo de conteúdo" hint="Campo + valor cria duas linhas relacionadas. Somente descrição usa um texto livre. Código de barras gera o barcode com o número abaixo." />
                  <select value={item.kind} onChange={(event) => updateItem(item.id, "kind", event.target.value)}>
                    <option value="pair">Campo + valor</option>
                    <option value="text">Somente descrição</option>
                    <option value="barcode">Código de barras</option>
                  </select>
                </label>

                {item.kind === "pair" ? (
                  <label className="field-group">
                    <FieldLabel label="Campo" hint="Nome curto do dado, como Produto, Cor ou Lote." />
                    <input
                      value={item.field}
                      onChange={(event) => updateItem(item.id, "field", event.target.value)}
                      placeholder="Ex.: Produto"
                    />
                  </label>
                ) : null}

                <label className="field-group">
                  <FieldLabel
                    label={item.kind === "pair" ? "Valor" : item.kind === "barcode" ? "Conteúdo do código" : "Descrição"}
                    hint={
                      item.kind === "pair"
                        ? "Texto principal do campo. Pode ser um nome, número ou observação."
                        : item.kind === "barcode"
                          ? "Valor usado para gerar o código de barras no padrão Code 128."
                          : "Texto livre que será impresso sem o formato campo + valor."
                    }
                  />
                  <textarea
                    rows={item.kind === "barcode" ? 2 : item.kind === "pair" ? 3 : 4}
                    value={item.value}
                    onChange={(event) => updateItem(item.id, "value", event.target.value)}
                    placeholder={
                      item.kind === "pair"
                        ? "Ex.: Mouse Gamer"
                        : item.kind === "barcode"
                          ? "Ex.: 12345678910"
                          : "Ex.: Toalha touca de cetim cachos"
                    }
                  />
                </label>

                <label className="field-group">
                  <FieldLabel label="Tamanho da fonte" hint="No modo automático o sistema sugere um tamanho com base no espaço disponível. No manual você escolhe o valor exato." />
                  <select value={isAuto ? "auto" : "manual"} onChange={(event) => updateItem(item.id, "sizeMode", event.target.value)}>
                    <option value="auto">Automático</option>
                    <option value="manual">Manual</option>
                  </select>
                </label>

                <label className="field-group">
                  <FieldLabel
                    label={isAuto ? "Sugestão atual" : "Tamanho manual"}
                    hint={isAuto ? "Valor calculado automaticamente para aproveitar melhor a área da etiqueta." : "Informe um número entre 8 e 40 para controlar a fonte deste bloco."}
                  />
                  <input
                    type="number"
                    min={8}
                    max={40}
                    value={isAuto ? suggestedSize : normalizeSize(item.size)}
                    disabled={isAuto}
                    onChange={(event) => updateItem(item.id, "size", event.target.value)}
                  />
                </label>
                    </>
                  );
                })()}
              </article>
            ))}
          </div>
        </aside>

        <section className="panel preview-panel">
          <div className="panel-header">
            <h2>Pré-visualização</h2>
            <p>A prévia replica a grade final com a mesma repetição usada no ZPL.</p>
          </div>

          <div className="preview-toolbar">
            <div className="preview-zoom-group">
              <button type="button" className="zoom-button" onClick={() => adjustPreviewZoom("out")} aria-label="Diminuir zoom">
                -
              </button>
              <span className="zoom-readout">{Math.round(previewZoom * 100)}%</span>
              <button type="button" className="zoom-button" onClick={() => adjustPreviewZoom("in")} aria-label="Aumentar zoom">
                +
              </button>
            </div>
            <button type="button" className="ghost-button preview-reset" onClick={() => setPreviewZoom(1)}>
              Voltar para 100%
            </button>
          </div>

          <div className="preview-stage">
            <PreviewSvg config={effectiveConfig} zoom={previewZoom} />
          </div>

          <div className="preview-actions">
            <button
              type="button"
              className="primary-button"
              onClick={() =>
                downloadTextFile(
                  `etiqueta-${config.preset.widthMm}x${config.preset.heightMm}-${config.labelsPerRow}x${config.rows}.zpl`,
                  zplContent,
                )
              }
            >
              Baixar ZPL
            </button>
            <button type="button" className="secondary-button" onClick={copyZpl}>
              Copiar ZPL
            </button>
            {copyFeedback ? <span className="copy-feedback">{copyFeedback}</span> : null}
          </div>

          <details className="zpl-details" open>
            <summary>Mostrar código ZPL</summary>
            <div className="zpl-output">
              <div className="zpl-output-header">
                <h3>Saída ZPL</h3>
                <span>Texto puro para conferência</span>
              </div>
              <pre>{zplContent}</pre>
            </div>
          </details>
        </section>
      </section>
    </main>
  );
}
