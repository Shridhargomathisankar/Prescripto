import { forwardRef } from 'react';

const Input = forwardRef(function Input({ label, className = '', ...props }, ref) {
  return (
    <div className={className}>
      {label && (
        <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
          {label}
        </label>
      )}
      <input
        ref={ref}
        className="w-full px-4 py-2.5 min-h-[48px] rounded-xl border border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 text-slate-800 text-sm outline-none transition"
        {...props}
      />
    </div>
  );
});

export default Input;
