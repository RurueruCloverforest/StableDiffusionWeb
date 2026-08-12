interface MainHeaderProps {
  title: string;
  meta?: string;
  showActions?: boolean;
  actionLabel?: string;
  onAction?: () => void;
}

export function MainHeader({ title, meta, showActions, actionLabel, onAction }: MainHeaderProps) {
  return (
    <div className="main-header">
      <div className="main-header__title">{title}</div>
      {meta && <div className="main-header__meta">{meta}</div>}
      {showActions && (
        <div className="main-header__actions">
          <div className="search-field">検索</div>
          {actionLabel && (
            <button type="button" className="btn-accent-sm" onClick={onAction}>
              {actionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
