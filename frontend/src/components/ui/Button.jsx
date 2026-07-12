export default function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}) {
  const base = 'inline-flex items-center justify-center gap-2 font-medium rounded-[10px] transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed';
  const sizes = {
    sm: 'h-8 px-3 text-sm',
    md: 'h-10 px-4 text-sm',
    lg: 'h-12 px-6 text-base',
  };
  const variants = {
    primary: 'bg-primary text-white hover:bg-primary-hover',
    secondary: 'bg-surface-2 text-foreground hover:bg-border',
    ghost: 'bg-transparent text-foreground-soft hover:bg-surface-2',
    danger: 'bg-danger text-white hover:opacity-90',
    outline: 'border border-border bg-surface text-foreground hover:bg-surface-2',
  };
  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}
