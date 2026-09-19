/**
 * Рендер документа игровой ситуации.
 * Маркеры {{id}} в тексте превращаются в кликабельные элементы.
 */
import type { DocBlock, DocLine, Scenario } from '../core/types';
import { escapeHtml, h } from './dom';

const MARKER = /\{\{([a-z0-9-]+)\}\}/gi;

function renderText(scenario: Scenario, text: string): string {
  return escapeHtml(text).replace(MARKER, (_match, id: string) => {
    const hotspot = scenario.hotspots.find((item) => item.id === id);
    if (!hotspot) return '';
    return `<button type="button" class="hotspot" data-hotspot="${escapeHtml(id)}">${escapeHtml(
      hotspot.text,
    )}</button>`;
  });
}

function renderLine(scenario: Scenario, line: DocLine): string {
  const kind = line.kind ?? 'text';
  const content = renderText(scenario, line.text);
  if (kind === 'bullet') return `<li class="doc-bullet">${content}</li>`;
  if (kind === 'meta') return `<p class="doc-meta-line">${content}</p>`;
  if (kind === 'quote') return `<blockquote class="doc-quote">${content}</blockquote>`;
  if (kind === 'signature') return `<p class="doc-signature">${content}</p>`;
  if (kind === 'amount') return `<p class="doc-amount">${content}</p>`;
  return `<p class="doc-text">${content}</p>`;
}

function renderBlock(scenario: Scenario, block: DocBlock): string {
  switch (block.type) {
    case 'fields':
      return `<dl class="doc-fields">${(block.rows ?? [])
        .map(
          (row) =>
            `<div class="doc-field"><dt>${escapeHtml(row.label)}</dt><dd>${renderText(
              scenario,
              row.value,
            )}</dd></div>`,
        )
        .join('')}</dl>`;

    case 'table':
      return `<div class="doc-table">${
        block.caption ? `<span class="doc-caption">${escapeHtml(block.caption)}</span>` : ''
      }${(block.rows ?? [])
        .map(
          (row) =>
            `<div class="doc-row"><span>${escapeHtml(row.label)}</span><strong>${renderText(
              scenario,
              row.value,
            )}</strong></div>`,
        )
        .join('')}</div>`;

    case 'chat':
      return `<div class="doc-chat">${(block.lines ?? [])
        .map(
          (line) =>
            `<div class="bubble bubble--${line.author ?? 'them'}">${renderText(
              scenario,
              line.text,
            )}</div>`,
        )
        .join('')}</div>`;

    case 'lines':
    default: {
      const lines = block.lines ?? [];
      const html: string[] = [];
      let bulletBuffer: string[] = [];

      const flush = () => {
        if (bulletBuffer.length > 0) {
          html.push(`<ul class="doc-list">${bulletBuffer.join('')}</ul>`);
          bulletBuffer = [];
        }
      };

      for (const line of lines) {
        const rendered = renderLine(scenario, line);
        if ((line.kind ?? 'text') === 'bullet') bulletBuffer.push(rendered);
        else {
          flush();
          html.push(rendered);
        }
      }
      flush();
      return html.join('');
    }
  }
}

const KIND_LABEL: Record<Scenario['kind'], string> = {
  email: 'Электронное письмо',
  chat: 'Переписка',
  contract: 'Договор',
  memo: 'Служебная записка',
  invoice: 'Накладная',
  form: 'Форма',
};

/** Карточка документа целиком. */
export function renderDocument(scenario: Scenario): HTMLElement {
  const card = h('article', 'doc');
  card.innerHTML = `
    <header class="doc-head">
      <span class="doc-kind doc-kind--${scenario.kind}">${KIND_LABEL[scenario.kind]}</span>
      <h2 class="doc-title">${escapeHtml(scenario.title)}</h2>
      <p class="doc-source">${escapeHtml(scenario.source)}</p>
    </header>
    <div class="doc-body">
      ${scenario.blocks.map((block) => renderBlock(scenario, block)).join('')}
    </div>
  `;
  return card;
}
