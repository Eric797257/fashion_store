import { parseSimpleContent } from "../../lib/simple-content";

export function SimpleContent({ text }: { text: string }) {
  const blocks = parseSimpleContent(text);

  return (
    <div className="space-y-5 leading-relaxed">
      {blocks.map((block, i) => {
        if (block.type === "heading") {
          return block.level === 2 ? (
            <h2 key={i} className="pt-4 text-2xl font-semibold">
              {block.text}
            </h2>
          ) : (
            <h3 key={i} className="pt-2 font-sans text-lg font-semibold">
              {block.text}
            </h3>
          );
        }
        if (block.type === "list") {
          return (
            <ul key={i} className="list-disc space-y-1.5 pl-6">
              {block.items.map((item, j) => (
                <li key={j}>{item}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="whitespace-pre-line">
            {block.text}
          </p>
        );
      })}
    </div>
  );
}