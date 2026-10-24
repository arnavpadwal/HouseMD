import MarkdownIt from 'markdown-it';
import taskLists from 'markdown-it-task-lists';
import katex from 'katex';
import hljs from 'highlight.js/lib/common';

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

const languageAliases: Record<string, string> = {
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  html: 'xml',
  htm: 'xml',
  svg: 'xml',
  yml: 'yaml',
  toml: 'ini',
  cfg: 'ini',
  text: 'plaintext',
  txt: 'plaintext',
  plain: 'plaintext',
  md: 'markdown',
  py: 'python',
  rs: 'rust',
  docker: 'dockerfile',
  'c++': 'cpp',
  'c#': 'csharp',
  jsonc: 'json',
};

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  breaks: false,
}).use(taskLists, { enabled: false, label: true });

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/<[^>]*>/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-');
}

const defaultHeadingOpen =
  md.renderer.rules.heading_open ?? ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));

md.renderer.rules.heading_open = (tokens, idx, options, env, self) => {
  const renderEnv = (env ?? {}) as { explicitIds?: Set<string>; usedIds?: Set<string> };
  const id = slugify(tokens[idx + 1]?.content ?? '');
  const explicitIds = renderEnv.explicitIds ?? new Set<string>();
  const usedIds = renderEnv.usedIds ?? new Set<string>();
  if (id && !explicitIds.has(id)) {
    let unique = id;
    let suffix = 2;
    while (usedIds.has(unique) || explicitIds.has(unique)) unique = `${id}-${suffix++}`;
    usedIds.add(unique);
    tokens[idx].attrSet('id', unique);
  }
  renderEnv.usedIds = usedIds;
  return defaultHeadingOpen(tokens, idx, options, renderEnv, self);
};

md.renderer.rules.fence = (tokens, idx) => {
  const token = tokens[idx];
  const label = token.info.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
  if (label === 'mermaid') {
    return `<div class="mermaid">${escapeHtml(token.content)}</div>\n`;
  }
  if (!label) {
    return `<pre class="hljs"><code>${hljs.highlightAuto(token.content).value}</code></pre>\n`;
  }
  const language = languageAliases[label] ?? label;
  if (language === 'plaintext' || !hljs.getLanguage(language)) {
    return `<pre class="hljs"><code>${escapeHtml(token.content)}</code></pre>\n`;
  }
  const highlighted = hljs.highlight(token.content, { language, ignoreIllegals: true }).value;
  return `<pre class="hljs"><code class="language-${escapeHtml(language)}">${highlighted}</code></pre>\n`;
};

function looksLikeInlineMath(value: string) {
  if (!value || /^\s|\s$/.test(value)) return false;
  if (/^[\d.,\s]+$/.test(value)) return false;
  return /[\\^_={}[\]()]/.test(value) || /[A-Za-z]/.test(value);
}

export function renderMarkdown(source: string) {
  const math: string[] = [];
  const code: string[] = [];
  const anchors: string[] = [];
  const explicitIds = new Set<string>();
  const stash = (tex: string, display: boolean) => {
    const token = `HOUSEMDMATH${math.length}TOKEN`;
    const html = katex.renderToString(tex, { displayMode: display, throwOnError: false, output: 'html' });
    math.push(display ? `<div class="math-block">${html}</div>` : html);
    return token;
  };

  // Math and anchors are extracted before Markdown runs, so keep code spans
  // and fences out of those passes and restore them afterwards.
  let text = source.replace(/```math[ \t]*\r?\n([\s\S]*?)\r?\n```/g, (_, tex: string) => `\n\n${stash(tex, true)}\n\n`);
  text = text.replace(/```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`/g, (snippet) => {
    const token = `HOUSEMDCODE${code.length}TOKEN`;
    code.push(snippet);
    return token;
  });
  text = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex: string) => `\n\n${stash(tex, true)}\n\n`);
  text = text.replace(/(^|[^\\])\$([^$\n]+?)\$/g, (match, prefix: string, tex: string) =>
    looksLikeInlineMath(tex) ? prefix + stash(tex, false) : match,
  );
  text = text.replace(/<a\s+id=(["'])([^"']+)\1\s*>\s*<\/a>/gi, (_, _quote: string, id: string) => {
    explicitIds.add(id);
    anchors.push(id);
    return `HOUSEMDANCHOR${anchors.length - 1}TOKEN`;
  });
  code.forEach((snippet, index) => {
    text = text.split(`HOUSEMDCODE${index}TOKEN`).join(snippet);
  });

  let html = md.render(text, { explicitIds, usedIds: new Set<string>() });
  math.forEach((rendered, index) => {
    const token = `HOUSEMDMATH${index}TOKEN`;
    html = html.split(`<p>${token}</p>`).join(rendered).split(token).join(rendered);
  });
  anchors.forEach((id, index) => {
    const anchor = `<a id="${escapeHtml(id)}"></a>`;
    html = html
      .split(`<p>HOUSEMDANCHOR${index}TOKEN</p>`)
      .join(anchor)
      .split(`HOUSEMDANCHOR${index}TOKEN`)
      .join(anchor);
  });
  return html;
}
