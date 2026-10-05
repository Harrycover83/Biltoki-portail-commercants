export function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-l-4 border-[#348b57] bg-[#fffcf6] px-5 py-4 shadow-sm">
      <p className="text-xs font-bold uppercase text-[#626a78]">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-[#13223a]">{value}</p>
    </div>
  )
}
