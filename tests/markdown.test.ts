import assert from 'node:assert/strict';
import test from 'node:test';
import { escapeHtml, renderMarkdown } from '../src/markdown.ts';

test('renders headings, emphasis, and task lists', () => {
  const html = renderMarkdown('# Title\n\n**bold** and *italic*\n\n- [x] done\n- [ ] todo');
  assert.match(html, /<h1 id="title">Title<\/h1>/);
  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(html, /<em>italic<\/em>/);
  assert.match(html, /checked[^>]*type="checkbox"/);
  assert.match(html, /type="checkbox"/);
});

test('does not convert dollar amounts into math', () => {
  const html = renderMarkdown('The trip cost $5 and the coffee cost $10.');
  assert.match(html, /\$5 and the coffee cost \$10\./);
  assert.doesNotMatch(html, /katex/);
});

test('renders inline and display math', () => {
  const inline = renderMarkdown('Euler said $e^{i\\pi} + 1 = 0$.');
  assert.match(inline, /class="katex"/);
  const display = renderMarkdown('$$\n\\int_0^1 x^2 dx\n$$');
  assert.match(display, /class="math-block"/);
});

test('leaves math delimiters inside code untouched', () => {
  const html = renderMarkdown('`$x^2$`\n\n```sh\necho "$HOME"\n```');
  assert.doesNotMatch(html, /class="katex"/);
  assert.match(html, /\$x\^2\$/);
  assert.match(html, /\$HOME/);
});

test('supports the fenced math form', () => {
  const html = renderMarkdown('```math\n\\frac{1}{2}\n```');
  assert.match(html, /class="math-block"/);
  assert.doesNotMatch(html, /language-math/);
});

test('turns mermaid fences into diagram containers', () => {
  const html = renderMarkdown('```mermaid\ngraph LR\n  A --> B\n```');
  assert.match(html, /<div class="mermaid">/);
  assert.match(html, /graph LR/);
});

test('highlights fenced code with highlight.js', () => {
  const html = renderMarkdown('```ts\nconst answer = 42;\n```');
  assert.match(html, /class="hljs"/);
  assert.match(html, /hljs-keyword/);
  assert.match(html, /hljs-number/);
});

test('renders GitHub-style empty anchor targets', () => {
  const html = renderMarkdown('<a id="section-one"></a>\n\n## Section one');
  assert.match(html, /<a id="section-one"><\/a>/);
  assert.doesNotMatch(html, /&lt;a/);
  assert.match(html, /<h2>Section one<\/h2>/);
});

test('adds ids to headings for table-of-contents links', () => {
  const html = renderMarkdown('[Plan](#plan)\n\n## Plan\n\n## Client/server plan');
  assert.match(html, /<a href="#plan">Plan<\/a>/);
  assert.match(html, /<h2 id="plan">Plan<\/h2>/);
  assert.match(html, /<h2 id="clientserver-plan">/);
});

test('keeps anchors inside code blocks literal', () => {
  const html = renderMarkdown('```html\n<a id="not-an-anchor"></a>\n```');
  assert.doesNotMatch(html, /<a id="not-an-anchor"><\/a>/);
  assert.match(html, /hljs-tag/);
});

test('sanitizes raw HTML while allowing safe README markup', () => {
  const html = renderMarkdown(
    '<script>alert(1)</script><p align="center"><img src="x.png" onerror="alert(1)" width="120"></p>',
  );
  assert.doesNotMatch(html, /<script/);
  assert.doesNotMatch(html, /alert\(1\)/);
  assert.doesNotMatch(html, /onerror/);
  assert.match(html, /align="center"/);
  assert.match(html, /<img[^>]*src="x.png"/);
  assert.match(html, /width="120"/);
});

test('escapes attribute-sensitive characters', () => {
  assert.equal(escapeHtml(`<a href="x">'&'</a>`), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
});
