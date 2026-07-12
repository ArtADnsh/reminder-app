export default function Input({ label, error, className = '', id, ...props }) {
  const inputId = id || props.name;
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-foreground">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`h-10 px-3 rounded-[10px] border bg-surface text-foreground placeholder:text-muted
          ${error ? 'border-danger' : 'border-border'}
          focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
          transition-colors ${className}`}
        {...props}
      />
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}
