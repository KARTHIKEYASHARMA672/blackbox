export default function Logo({ size = 38 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true" className="brand-mark">
      <path d="M32 6 L56 20 L56 44 L32 58 L8 44 L8 20 Z" fill="#0e1611" stroke="#34f5a5" strokeWidth="3" strokeLinejoin="round" />
      <circle cx="32" cy="32" r="9.5" stroke="#34f5a5" strokeWidth="3" />
      <circle cx="32" cy="32" r="3" fill="#34f5a5" />
      <path d="M32 17v5.5M32 41.5V47M18.2 24.5 23 27.4M41 36.6l4.8 2.9M18.2 39.5 23 36.6M41 27.4l4.8-2.9" stroke="#34f5a5" strokeWidth="2" strokeLinecap="round" opacity="0.75" />
    </svg>
  );
}
