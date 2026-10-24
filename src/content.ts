export const icons = {
  file: '<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h8"/></svg>',
  folder:
    '<svg viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
  save: '<svg viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><path d="M17 21v-8H7v8M7 3v5h8"/></svg>',
  pdf: '<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 15h2a1.5 1.5 0 0 0 0-3H8v6m6-6v6h1a3 3 0 0 0 0-6z"/></svg>',
  sun: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2m10-10h-2M4 12H2m17.07 7.07-1.42-1.42M6.35 6.35 4.93 4.93m14.14 0-1.42 1.42M6.35 17.65l-1.42 1.42"/></svg>',
  moon: '<svg viewBox="0 0 24 24"><path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z"/></svg>',
  search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="m18 6-12 12M6 6l12 12"/></svg>',
  menu: '<svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  sidebar:
    '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M12.5 9h5.5M12.5 13h3.5"/></svg>',
  refresh: '<svg viewBox="0 0 24 24"><path d="M20 11a8 8 0 1 0-2.3 6.3M20 4v7h-7"/></svg>',
  chevron: '<svg viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  settings:
    '<svg viewBox="0 0 24 24"><path d="M4 6h8M16 6h4M4 12h2M10 12h10M4 18h8M16 18h4"/><circle cx="14" cy="6" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="14" cy="18" r="2"/></svg>',
};

export const sample = String.raw`# A little room to think

A calm place for your ideas. **Write in Markdown**, and let the details find their shape.

## The good kind of structure

> “The details are not the details. They make the design.”
> — Charles Eames

Bring your notes together with a few simple building blocks.

| Element | Syntax | Why it works |
|:--|:--|:--|
| **Clarity** | ${'`'}# A clear heading${'`'} | Gives ideas room to breathe |
| **Momentum** | ${'`'}- [x] First thought${'`'} | Keeps a little progress visible |
| **Precision** | ${'`'}$E = mc^2$${'`'} | Makes a complex idea feel simple |

- [x] Make space for the big idea
- [x] Find the right words
- [ ] Come back with fresh eyes

## Small things, connected

${'```'}mermaid
graph LR
  Idea[Idea] --> Draft[Draft]
  Draft --> Done[Done]
${'```'}

## Everything in its right place

Inline math feels **at home** here: $\sqrt{a^2 + b^2} = c$. For the moments that call for a little more space:

$$
\int_0^1 x^2 \, dx = \frac{1}{3}
$$

> Good tools get out of the way. Great ones make the work feel like yours.
`;

export interface HelpItem {
  name: string;
  syntax: string;
  description: string;
  insert: string;
  wrap?: [before: string, after: string, placeholder: string];
}

export const helpItems: HelpItem[] = [
  {
    name: 'Text',
    syntax: '**bold** · *italic* · ~~strike~~',
    description: 'Make text stand out',
    insert: '**bold**',
    wrap: ['**', '**', 'bold'],
  },
  {
    name: 'Headings',
    syntax: '# Heading · ## Subheading',
    description: 'Organize your ideas',
    insert: '\n## Heading',
  },
  {
    name: 'Lists',
    syntax: '- item · 1. item · - [ ] task',
    description: 'Lists, steps, and checkboxes',
    insert: '\n- item',
  },
  {
    name: 'Links',
    syntax: '[label](https://…)',
    description: 'Link to a page',
    insert: '[label](https://example.com)',
  },
  {
    name: 'Images',
    syntax: '![description](image.png)',
    description: 'Add an image',
    insert: '![description](image.png)',
  },
  {
    name: 'Quotes',
    syntax: '> A thoughtful note',
    description: 'Set a passage apart',
    insert: '\n> A thoughtful note',
  },
  {
    name: 'Code',
    syntax: '`inline` · ```language\ncode\n```',
    description: 'Show code clearly',
    insert: '\n```ts\ncode\n```\n',
  },
  {
    name: 'Tables',
    syntax: '| Name | Value |\n| --- | --- |\n| One | Two |',
    description: 'Arrange details in columns',
    insert: '\n| Name | Value |\n| --- | --- |\n| One | Two |\n',
  },
  {
    name: 'Math',
    syntax: '$E = mc^2$ · $$\int x dx$$',
    description: 'Write math with LaTeX',
    insert: '$E = mc^2$',
    wrap: ['$', '$', 'E = mc^2'],
  },
  {
    name: 'Diagrams',
    syntax: '```mermaid\ngraph TD\n A --> B\n```',
    description: 'Sketch a flow with Mermaid',
    insert: '\n```mermaid\ngraph TD\n  A --> B\n```\n',
  },
  {
    name: 'Divider',
    syntax: '---',
    description: 'Give ideas a little space',
    insert: '\n---\n',
  },
];

export const latexHelpItems: HelpItem[] = [
  {
    name: 'Section',
    syntax: '\\section{Heading}',
    description: 'Start a numbered section',
    insert: '\n\\section{Heading}\n',
  },
  {
    name: 'Bold',
    syntax: '\\textbf{bold}',
    description: 'Make text stand out',
    insert: '\\textbf{bold}',
    wrap: ['\\textbf{', '}', 'bold'],
  },
  {
    name: 'Italic',
    syntax: '\\textit{italic}',
    description: 'Add emphasis',
    insert: '\\textit{italic}',
    wrap: ['\\textit{', '}', 'italic'],
  },
  {
    name: 'Inline math',
    syntax: '$E = mc^2$',
    description: 'Write math in a line',
    insert: '$E = mc^2$',
    wrap: ['$', '$', 'E = mc^2'],
  },
  {
    name: 'Display math',
    syntax: '\\[\n\\int_0^1 x^2 \\, dx = \\frac{1}{3}\n\\]',
    description: 'A centered equation',
    insert: '\n\\[\n  \\int_0^1 x^2 \\, dx = \\frac{1}{3}\n\\]\n',
  },
  {
    name: 'Itemize',
    syntax: '\\begin{itemize}\n  \\item First\n  \\item Second\n\\end{itemize}',
    description: 'A bullet list',
    insert: '\n\\begin{itemize}\n  \\item First item\n  \\item Second item\n\\end{itemize}\n',
  },
  {
    name: 'Equation',
    syntax: '\\begin{equation}\n  E = mc^2\n\\end{equation}',
    description: 'A numbered equation',
    insert: '\n\\begin{equation}\n  E = mc^2\n\\end{equation}\n',
  },
  {
    name: 'Figure',
    syntax:
      '\\begin{figure}[h]\n  \\centering\n  \\includegraphics{image.png}\n  \\caption{Description}\n\\end{figure}',
    description: 'Insert an image with a caption',
    insert:
      '\n\\begin{figure}[h]\n  \\centering\n  \\includegraphics[width=0.8\\linewidth]{image.png}\n  \\caption{Description}\n  \\label{fig:example}\n\\end{figure}\n',
  },
  {
    name: 'Label / ref',
    syntax: '\\label{sec:intro} · \\ref{sec:intro}',
    description: 'Cross-reference a section or figure',
    insert: '\\label{sec:intro}',
  },
  {
    name: 'Document',
    syntax: '\\documentclass{article}\n\\begin{document}\n\n\\end{document}',
    description: 'Start a complete LaTeX document',
    insert: '\\documentclass{article}\n\n\\begin{document}\n\n\\end{document}\n',
  },
];
