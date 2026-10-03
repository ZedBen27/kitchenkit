  return <section className="mb-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.04)]"><div className="border-b border-slate-100 p-5 sm:p-6"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div className="flex items-center gap-3"><div className={`grid h-11 w-11 place-items-center rounded-2xl ${title === 'Résine' ? 'bg-violet-50 text-violet-700' : 'bg-sky-50 text-sky-700'}`}><Layers3 className="h-5 w-5" /></div><div><h2 className="text-xl font-black tracking-tight">مخطط {title}</h2><p className="mt-1 text-xs text-slate-500">{result.sheets.length} لوح · {totalUsedArea.toFixed(2)} m² مستخدمة · هدر {result.totalWasteArea.toFixed(2)} m²</p></div></div><div className="flex flex-wrap gap-2 text-xs font-bold"><Metric label="الألواح" value={String(result.sheets.length)} /><Metric label="الاستغلال" value={`${(result.totalUtilization * 100).toFixed(1)}%`} /><Metric label="التدوير" value="مفعّل" /></div></div></div><div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-2 xl:grid-cols-3">{result.sheets.map((sheet) => <SheetCard key={sheet.sheetIndex} sheet={sheet} />)}</div></section>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"><span className="text-slate-400">{label}</span><strong className="mr-1.5 text-slate-800">{value}</strong></div>;
}

function SheetCard({ sheet }: { sheet: OptimizationResult['sheets'][number] }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/50 transition hover:border-slate-300 hover:shadow-md">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <div>
          <p className="text-sm font-black">لوح #{sheet.sheetIndex}</p>
          <p className="mt-0.5 text-[11px] text-slate-400">{sheet.width.toFixed(3)} × {sheet.height.toFixed(3)} m</p>
        </div>
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700">{(sheet.utilization * 100).toFixed(1)}%</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="relative w-full pt-7 pr-8">
          <div className="pointer-events-none absolute left-0 right-8 top-0 flex h-6 items-center justify-center gap-2 text-[9px] font-semibold text-slate-500">
            <span className="h-px flex-1 bg-slate-300" />
            <span className="shrink-0 whitespace-nowrap">{sheet.width.toFixed(3)} m</span>
            <span className="h-px flex-1 bg-slate-300" />
          </div>

          <div className="pointer-events-none absolute bottom-0 right-0 top-7 flex w-7 items-center justify-center">
            <div className="relative flex h-full w-full items-center justify-center">
              <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-slate-300" />
              <span className="relative z-10 bg-slate-50 px-0.5 text-[9px] font-semibold text-slate-500" style={{ transform: 'rotate(-90deg)', whiteSpace: 'nowrap' }}>
                {sheet.height.toFixed(3)} m
              </span>
            </div>
          </div>

          <div className="relative w-full overflow-hidden rounded-none border border-slate-300 bg-slate-100" style={{ aspectRatio: `${sheet.width} / ${sheet.height}` }}>
            {sheet.placements.map((placement) => {
              const layout = getLabelLayout({
                width: placement.width,
                height: placement.height,
                label: placement.label,
                dimensionText: `${placement.width.toFixed(3)} × ${placement.height.toFixed(3)} m`,
              });
              const horizontalDimension = `${placement.width.toFixed(3)} m`;
              const verticalDimension = `${placement.height.toFixed(3)} m`;
              const dimensionFontSize = Math.max(7, Math.min(10, Math.round(layout.fontSize * 0.78)));
              const labelFontSize = Math.max(8, Math.min(13, layout.fontSize));

              return (
                <div
                  key={placement.id}
                  title={`${placement.label} — ${placement.width.toFixed(3)} × ${placement.height.toFixed(3)}${placement.rotated ? ' m · مدوّرة' : ' m'}`}
                  className="absolute overflow-hidden border border-slate-300 bg-white/90 text-slate-800 transition hover:z-20 hover:bg-white hover:shadow-lg"
                  style={{
                    left: `${(placement.x / sheet.width) * 100}%`,
                    top: `${(placement.y / sheet.height) * 100}%`,
                    width: `${(placement.width / sheet.width) * 100}%`,
                    height: `${(placement.height / sheet.height) * 100}%`,
                  }}
                >
                  <div className="pointer-events-none absolute inset-x-1 top-1 flex items-center gap-1" style={{ fontSize: `${dimensionFontSize}px`, lineHeight: '1' }}>
                    <span className="h-px flex-1 bg-slate-300" />
                    <span className="shrink-0 whitespace-nowrap font-semibold text-slate-500">{horizontalDimension}</span>
                    <span className="h-px flex-1 bg-slate-300" />
                  </div>

                  <div className="pointer-events-none absolute bottom-1 left-1 top-1 flex items-center justify-center" style={{ width: `${Math.max(14, dimensionFontSize + 5)}px` }}>
                    <div className="relative flex h-full w-full items-center justify-center">
                      <span className="absolute left-1/2 top-0 h-full w-[2px] -translate-x-1/2 bg-slate-300" />
                      <span className="relative z-10 bg-white px-0.5 font-semibold text-slate-500" style={{ fontSize: `${dimensionFontSize}px`, lineHeight: '1', transform: 'rotate(-90deg)', whiteSpace: 'nowrap' }}>
                        {verticalDimension}
                      </span>
                    </div>
                  </div>

                  <div className="absolute inset-0 flex items-center justify-center px-5 py-5 text-center" style={{ fontSize: `${labelFontSize}px`, lineHeight: `${layout.lineHeight}px` }}>
                    <span className="max-w-[68%] break-words font-black leading-tight">
                      {layout.labelLines.map((line, index) => (
                        <span key={index} className="block">{line}</span>
                      ))}
                    </span>
                  </div>

                  {placement.rotated && (
                    <span className="pointer-events-none absolute bottom-1 right-1 text-[8px] font-bold text-blue-600">↻</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 bg-white px-4 py-2.5 text-[11px] text-slate-500"><span>{sheet.placements.length} قطعة على اللوح</span><span>هدر {sheet.wasteArea.toFixed(2)} m²</span></div>
      </div>
    </article>
  );
}
