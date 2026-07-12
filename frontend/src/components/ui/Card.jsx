export default function Card({ className = '', hover = false, children, ...props }) {
  return (
    <div
      className={`bg-surface rounded-[14px] border border-border shadow-sm p-5 ${
        hover ? 'transition-shadow duration-150 hover:shadow-md' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
