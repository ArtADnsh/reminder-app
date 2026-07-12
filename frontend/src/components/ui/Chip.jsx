export default function Chip({ active = false, children, onClick, ...props }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-8 px-3 rounded-full text-sm font-medium whitespace-nowrap transition-colors duration-150
        ${active
          ? 'bg-primary text-white'
          : 'bg-surface-2 text-foreground-soft hover:bg-border'}`}
      {...props}
    >
      {children}
    </button>
  );
}
