const variants = {
  primary: 'bg-teal-600 text-white hover:bg-teal-700 focus:ring-teal-500',
  ghost: 'bg-transparent text-slate-600 hover:bg-slate-100 focus:ring-slate-400',
};

export default function Button({ children, loading, disabled, variant = 'primary', type, className = '', ...props }) {
  return (
    <button
      type={type ?? 'button'}
      className={`inline-flex items-center justify-center px-4 py-2.5 min-h-[48px] rounded-xl font-semibold focus:ring-2 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition-all active:scale-[0.98] ${variants[variant] || variants.primary} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
      ) : (
        children
      )}
    </button>
  );
}
