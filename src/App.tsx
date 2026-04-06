import { useEffect, useMemo, useState } from "react";
import { DEFAULT_ITEMS, LABEL_PRESETS } from "./data/presets";
import { buildLabelLayout, mmToDots } from "./lib/layout";
import { generateZpl } from "./lib/zpl";
import type { FontSize, LabelConfig, LabelItem } from "./types";

const STORAGE_KEY = "zebra-label-generator-config";

type PersistedConfig = {
  presetId: string;
  columns: number;
  items: LabelItem[];
};

function createItem(): LabelItem {
  return {
    id: crypto.randomUUID(),
    field: "",
    value: "",
    size: "md",
  };
}

function createDefaultConfig(): LabelConfig {
  return {
    preset: LABEL_PRESETS[0],
    columns: 1,
    items: DEFAULT_ITEMS,
    align: "center",
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
    const savedConfig = JSON.parse(storedValue) as PersistedConfig;
    return {
      preset: LABEL_PRESETS.find((preset) => preset.id === savedConfig.presetId) ?? LABEL_PRESETS[0],
      columns: Math.min(4, Math.max(1, savedConfig.columns || 1)),
      items: savedConfig.items?.length ? savedConfig.items : DEFAULT_ITEMS,
      align: "center",
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

function PreviewSvg({ config }: { config: LabelConfig }) {
  const layout = useMemo(() => buildLabelLayout(config), [config]);
  const previewWidth = Math.max(240, Math.round(layout.widthDots * 0.58));
  const previewHeight = Math.max(180, Math.round(layout.heightDots * 0.58));

  return (
    <svg
      className="preview-svg"
      viewBox={`0 0 ${layout.widthDots} ${layout.heightDots}`}
      width={previewWidth}
      height={previewHeight}
      role="img"
      aria-label="Pré-visualização da etiqueta"
    >
      <rect width={layout.widthDots} height={layout.heightDots} rx="8" fill="#fffdf7" />
      <rect
        x={layout.marginDots}
        y={layout.marginDots}
        width={layout.printableWidth}
        height={layout.printableHeight}
        fill="none"
        stroke="#d0b79b"
        strokeDasharray="8 6"
      />

      {layout.columns.map((column) => (
        <g key={column.index}>
          <rect
            x={column.x}
            y={layout.marginDots}
            width={column.width}
            height={layout.printableHeight}
            fill="rgba(184, 128, 70, 0.08)"
            stroke="rgba(111, 56, 16, 0.12)"
          />

          {column.items.map((item) => (
            <g key={item.id}>
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
    </svg>
  );
}

export default function App() {
  const [config, setConfig] = useState<LabelConfig>(getInitialConfig);
  const [copyFeedback, setCopyFeedback] = useState("");

  useEffect(() => {
    const data: PersistedConfig = {
      presetId: config.preset.id,
      columns: config.columns,
      items: config.items,
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

  const zplContent = useMemo(() => generateZpl(config), [config]);
  const sizeSummary = `${config.preset.widthMm} x ${config.preset.heightMm} mm • ${mmToDots(config.preset.widthMm)} x ${mmToDots(config.preset.heightMm)} dots`;

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
      items: current.items.map((item) => (item.id === id ? { ...item, [key]: value } : item)),
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

  async function copyZpl() {
    try {
      await navigator.clipboard.writeText(zplContent);
      setCopyFeedback("ZPL copiado");
    } catch {
      setCopyFeedback("Não foi possível copiar");
    }
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <p className="eyebrow">Gerador Zebra</p>
        <h1>Etiquetas Zebra em ZPL, prontas para baixar</h1>
        <p className="hero-copy">
          Escolha um tamanho padrão, defina as colunas e preencha os campos. O app calcula o layout
          automaticamente e exporta o arquivo <code>.zpl</code> sem depender de backend.
        </p>
      </section>

      <section className="workspace">
        <aside className="panel controls-panel">
          <div className="panel-header">
            <h2>Configuração</h2>
            <p>{sizeSummary}</p>
          </div>

          <label className="field-group">
            <span>Tamanho da etiqueta</span>
            <select value={config.preset.id} onChange={(event) => updatePreset(event.target.value)}>
              {LABEL_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field-group">
            <span>Número de colunas</span>
            <select
              value={config.columns}
              onChange={(event) =>
                setConfig((current) => ({
                  ...current,
                  columns: Number(event.target.value),
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

          <label className="field-group">
            <span>Alinhamento do texto</span>
            <input value="Centralizado" disabled />
          </label>

          <div className="items-header">
            <div>
              <h3>Campos</h3>
              <p>Os itens são distribuídos automaticamente entre as colunas.</p>
            </div>
            <button type="button" className="secondary-button" onClick={addItem}>
              Adicionar campo
            </button>
          </div>

          <div className="items-list">
            {config.items.map((item, index) => (
              <article key={item.id} className="item-card">
                <div className="item-card-header">
                  <strong>Campo {index + 1}</strong>
                  <button type="button" className="ghost-button" onClick={() => removeItem(item.id)}>
                    Remover
                  </button>
                </div>

                <label className="field-group">
                  <span>Campo</span>
                  <input
                    value={item.field}
                    onChange={(event) => updateItem(item.id, "field", event.target.value)}
                    placeholder="Ex.: Produto"
                  />
                </label>

                <label className="field-group">
                  <span>Valor</span>
                  <textarea
                    rows={3}
                    value={item.value}
                    onChange={(event) => updateItem(item.id, "value", event.target.value)}
                    placeholder="Ex.: Mouse Gamer"
                  />
                </label>

                <label className="field-group">
                  <span>Tamanho</span>
                  <select
                    value={item.size ?? "md"}
                    onChange={(event) => updateItem(item.id, "size", event.target.value as FontSize)}
                  >
                    <option value="sm">Pequeno</option>
                    <option value="md">Médio</option>
                    <option value="lg">Grande</option>
                  </select>
                </label>
              </article>
            ))}
          </div>
        </aside>

        <section className="panel preview-panel">
          <div className="panel-header">
            <h2>Pré-visualização</h2>
            <p>Mesmo cálculo usado na exportação ZPL.</p>
          </div>

          <div className="preview-stage">
            <PreviewSvg config={config} />
          </div>

          <div className="preview-actions">
            <button
              type="button"
              className="primary-button"
              onClick={() => downloadTextFile(`etiqueta-${config.preset.widthMm}x${config.preset.heightMm}.zpl`, zplContent)}
            >
              Baixar ZPL
            </button>
            <button type="button" className="secondary-button" onClick={copyZpl}>
              Copiar ZPL
            </button>
            {copyFeedback ? <span className="copy-feedback">{copyFeedback}</span> : null}
          </div>

          <div className="zpl-output">
            <div className="zpl-output-header">
              <h3>Saída ZPL</h3>
              <span>Texto puro para conferência</span>
            </div>
            <pre>{zplContent}</pre>
          </div>
        </section>
      </section>
    </main>
  );
}
