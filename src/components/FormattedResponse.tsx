import React from 'react';

const inline = (text: string, keyPrefix: string) => {
  const parts = text.split(/(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*]+\*|_[^_]+_)/g);
  return (
    <>
      {parts.map((part, i) => {
        const key = `${keyPrefix}-${i}`;
        if (
          (part.startsWith('**') && part.endsWith('**')) ||
          (part.startsWith('__') && part.endsWith('__'))
        ) {
          return (
            <strong key={key} className="font-semibold text-stone-100">
              {part.slice(2, -2)}
            </strong>
          );
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return (
            <code
              key={key}
              className="rounded bg-stone-900 border border-stone-800 px-1.5 py-0.5 font-mono text-[0.9em] text-amber-200"
            >
              {part.slice(1, -1)}
            </code>
          );
        }
        if (
          (part.startsWith('*') && part.endsWith('*')) ||
          (part.startsWith('_') && part.endsWith('_'))
        ) {
          return <em key={key}>{part.slice(1, -1)}</em>;
        }
        return <React.Fragment key={key}>{part}</React.Fragment>;
      })}
    </>
  );
};

export const FormattedResponse: React.FC<{
  content: string;
  className?: string;
}> = ({ content, className = '' }) => {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const nodes: React.ReactNode[] = [];
  let paragraph: string[] = [];
  let bullets: string[] = [];
  let numbered: string[] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];
  let idx = 0;

  const flushParagraphOnly = () => {
    if (!paragraph.length) return;
    const text = paragraph.join(' ').trim();
    if (text) {
      nodes.push(
        <p key={`p-${idx++}`} className="mb-3 last:mb-0 leading-relaxed">
          {inline(text, `p-${idx}`)}
        </p>
      );
    }
    paragraph = [];
  };

  const flush = () => {
    flushParagraphOnly();
    if (bullets.length) {
      const items = bullets;
      nodes.push(
        <ul key={`ul-${idx++}`} className="mb-3 list-disc space-y-1.5 pl-5">
          {items.map((item, i) => (
            <li key={`${idx}-${i}`}>{inline(item, `ul-${idx}-${i}`)}</li>
          ))}
        </ul>
      );
      bullets = [];
    }
    if (numbered.length) {
      const items = numbered;
      nodes.push(
        <ol key={`ol-${idx++}`} className="mb-3 list-decimal space-y-1.5 pl-5">
          {items.map((item, i) => (
            <li key={`${idx}-${i}`}>{inline(item, `ol-${idx}-${i}`)}</li>
          ))}
        </ol>
      );
      numbered = [];
    }
  };

  lines.forEach((raw, lineIndex) => {
    const trimmed = raw.trim();

    if (/^```/.test(trimmed)) {
      if (!inCodeBlock) {
        flush();
        inCodeBlock = true;
        codeLines = [];
      } else {
        nodes.push(
          <pre
            key={`code-${idx++}`}
            className="mb-3 overflow-x-auto rounded-xl bg-stone-950 border border-stone-800 p-4 text-xs leading-relaxed"
          >
            <code className="font-mono text-stone-300 whitespace-pre">
              {codeLines.join('\n')}
            </code>
          </pre>
        );
        inCodeBlock = false;
        codeLines = [];
      }
      return;
    }

    if (inCodeBlock) {
      codeLines.push(raw);
      return;
    }

    if (!trimmed) {
      flush();
      return;
    }

    const heading = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      flush();
      const level = heading[1].length;
      const Tag = (`h${level}` as 'h1' | 'h2' | 'h3' | 'h4');
      const cls =
        level === 1
          ? 'text-xl font-semibold text-stone-100 mb-3'
          : level === 2
          ? 'text-lg font-semibold text-stone-100 mb-2.5'
          : level === 3
          ? 'text-base font-semibold text-stone-100 mb-2'
          : 'text-sm font-semibold text-stone-200 mb-2';
      nodes.push(
        React.createElement(
          Tag,
          { key: `h-${lineIndex}`, className: cls },
          inline(heading[2], `h-${lineIndex}`)
        )
      );
      return;
    }

    const quote = trimmed.match(/^>\s?(.*)$/);
    if (quote) {
      flush();
      nodes.push(
        <blockquote
          key={`quote-${idx++}`}
          className="border-l-2 border-amber-500/50 pl-4 mb-3 text-stone-400 italic"
        >
          {inline(quote[1], `q-${lineIndex}`)}
        </blockquote>
      );
      return;
    }

    const bullet = trimmed.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      flushParagraphOnly();
      if (numbered.length) flush();
      bullets.push(bullet[1]);
      return;
    }

    const number = trimmed.match(/^\d+[.)]\s+(.+)$/);
    if (number) {
      flushParagraphOnly();
      if (bullets.length) flush();
      numbered.push(number[1]);
      return;
    }

    paragraph.push(trimmed);
  });

  if (inCodeBlock && codeLines.length) {
    nodes.push(
      <pre
        key={`code-${idx++}`}
        className="mb-3 overflow-x-auto rounded-xl bg-stone-950 border border-stone-800 p-4 text-xs leading-relaxed"
      >
        <code className="font-mono text-stone-300 whitespace-pre">
          {codeLines.join('\n')}
        </code>
      </pre>
    );
  }

  flush();

  return <div className={className}>{nodes}</div>;
};
