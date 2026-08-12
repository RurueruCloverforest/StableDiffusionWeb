interface ToggleProps {
  on: boolean;
  onClick: () => void;
}

export function Toggle({ on, onClick }: ToggleProps) {
  return (
    <span
      role="switch"
      aria-checked={on}
      tabIndex={0}
      className={`toggle-track ${on ? 'is-on' : 'is-off'}`}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <span className="toggle-knob" />
    </span>
  );
}
