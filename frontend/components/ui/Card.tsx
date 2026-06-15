export default function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl bg-white p-6 shadow-sm border border-slate-100 ${className}`}>
      {children}
    </div>
  );
}
