interface ModulePlaceholderProps {
  module: "M2" | "M3";
  title: string;
  lede: string;
  owner: string;
  requirements: ReadonlyArray<{ id: string; text: string }>;
  firstTask: string;
}

/**
 * Stand-in page for a module whose UI has not been built yet. It states what the module owns,
 * which requirements it covers and where the work starts, so the placeholder is itself part of
 * the requirement baseline instead of an empty screen.
 */
export function ModulePlaceholder(props: ModulePlaceholderProps) {
  return (
    <section aria-labelledby={`${props.module}-title`}>
      <header className="page__head">
        <div>
          <p className="page__eyebrow">{props.module} · 待实现</p>
          <h1 id={`${props.module}-title`} className="page__title">
            {props.title}
          </h1>
          <p className="page__lede">{props.lede}</p>
        </div>
      </header>
      <div className="placeholder">
        <p>
          本页面是占位。模块由 <strong>{props.owner}</strong> 负责，起始任务{" "}
          <code>{props.firstTask}</code>
          ，页面结构请参照 <code>apps/web/src/features/m1</code>。
        </p>
        <ol>
          {props.requirements.map((req) => (
            <li key={req.id}>
              <code>{req.id}</code> {req.text}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
