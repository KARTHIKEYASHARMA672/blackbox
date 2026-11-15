interface IconProps {
  size?: number;
  className?: string;
  strokeWidth?: number;
  style?: React.CSSProperties;
}

function base(path: React.ReactNode, { size = 18, strokeWidth = 1.8, className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      {path}
    </svg>
  );
}

export const IconOverview = (p: IconProps) =>
  base(<><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>, p);

export const IconStructure = (p: IconProps) =>
  base(<><path d="M4 6h7" /><path d="M4 12h13" /><path d="M4 18h9" /><circle cx="4" cy="6" r="0" fill="currentColor" /><path d="M17 5l3 3-3 3" opacity="0" /></>, p);

export const IconTree = (p: IconProps) =>
  base(<><path d="M5 4v5a2 2 0 0 0 2 2h10" /><path d="M5 11v5a2 2 0 0 0 2 2h7" /><path d="M5 4h.01" /><circle cx="18" cy="9" r="1.6" /><circle cx="15" cy="16" r="1.6" /></>, p);

export const IconDiagram = (p: IconProps) =>
  base(<><circle cx="6" cy="6" r="2.4" /><circle cx="18" cy="10" r="2.4" /><circle cx="8" cy="18" r="2.4" /><path d="M8.2 7 15.8 9.2M7 8.3l.7 7.3M16.8 12.2 10 16.6" /></>, p);

export const IconPackage = (p: IconProps) =>
  base(<><path d="M12 3 4.5 7.5v9L12 21l7.5-4.5v-9L12 3Z" /><path d="M4.5 7.5 12 12l7.5-4.5M12 12v9" /></>, p);

export const IconApi = (p: IconProps) =>
  base(<><path d="M4.9 19.1a10 10 0 0 1 0-14.2M8.5 15.5a6 6 0 0 1 0-7M12.2 12h.01" /><path d="M15.5 8.5a6 6 0 0 1 0 7M19.1 4.9a10 10 0 0 1 0 14.2" /></>, p);

export const IconShield = (p: IconProps) =>
  base(<><path d="M12 3 5 6v6c0 4.6 3 8.2 7 9 4-0.8 7-4.4 7-9V6l-7-3Z" /><path d="M9.5 12.2 11.6 14.3 14.5 10.6" /></>, p);

export const IconDocs = (p: IconProps) =>
  base(<><path d="M7 3h7l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" /><path d="M14 3v4h4M9.5 12h5M9.5 15.5h5M9.5 8.5H11" /></>, p);

export const IconSettings = (p: IconProps) =>
  base(<><path d="M4 7h9M17 7h3M4 17h3M11 17h9M4 12h3M11 12h9" /><circle cx="15" cy="7" r="2" /><circle cx="9" cy="12" r="2" /><circle cx="9" cy="17" r="2" /></>, p);

export const IconUpload = (p: IconProps) =>
  base(<><path d="M12 16V4M12 4 7.5 8.5M12 4l4.5 4.5" /><path d="M4 15v3a2.5 2.5 0 0 0 2.5 2.5h11A2.5 2.5 0 0 0 20 18v-3" /></>, p);

export const IconFolder = (p: IconProps) =>
  base(<><path d="M4 7a2 2 0 0 1 2-2h4l2 2.5h6a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Z" /></>, p);

export const IconZip = (p: IconProps) =>
  base(<><path d="M7 3h7l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" /><path d="M12 3v2M12 7v2M12 11v2" /></>, p);

export const IconFile = (p: IconProps) =>
  base(<><path d="M7 3h7l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" /><path d="M14 3v4h4" /></>, p);

export const IconDownload = (p: IconProps) =>
  base(<><path d="M12 4v12M12 16l-4.5-4.5M12 16l4.5-4.5" /><path d="M4 17v2.5A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5V17" /></>, p);

export const IconCopy = (p: IconProps) =>
  base(<><rect x="9" y="9" width="11" height="11" rx="1.5" /><path d="M5 15V5a1.5 1.5 0 0 1 1.5-1.5H15" /></>, p);

export const IconCheck = (p: IconProps) =>
  base(<><path d="M4.5 12.5 9.5 17.5 19.5 6.5" /></>, p);

export const IconAlert = (p: IconProps) =>
  base(<><path d="M12 4 2.8 20h18.4L12 4Z" /><path d="M12 10v4.2M12 17.3h.01" /></>, p);

export const IconChevronRight = (p: IconProps) =>
  base(<><path d="M9 6l6 6-6 6" /></>, p);

export const IconChevronDown = (p: IconProps) =>
  base(<><path d="M6 9l6 6 6-6" /></>, p);

export const IconX = (p: IconProps) =>
  base(<><path d="M6 6l12 12M18 6 6 18" /></>, p);

export const IconZap = (p: IconProps) =>
  base(<><path d="M13 2 4.5 13.5H11L9.5 22 18 10.5h-6.5L13 2Z" /></>, p);

export const IconSearch = (p: IconProps) =>
  base(<><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></>, p);

export const IconExternal = (p: IconProps) =>
  base(<><path d="M14 4h6v6" /><path d="M20 4 11 13" /><path d="M9 6H5.5A1.5 1.5 0 0 0 4 7.5v11A1.5 1.5 0 0 0 5.5 20h11a1.5 1.5 0 0 0 1.5-1.5V14" /></>, p);

export const IconRefresh = (p: IconProps) =>
  base(<><path d="M20 5v6h-6" /><path d="M4 19v-6h6" /><path d="M19 11a8 8 0 0 0-14-4M5 13a8 8 0 0 0 14 4" /></>, p);

export const IconArrowRight = (p: IconProps) =>
  base(<><path d="M4 12h15M13 5l7 7-7 7" /></>, p);

export const IconBox = (p: IconProps) =>
  base(<><path d="M3 8.5 12 4l9 4.5M3 8.5 12 13l9-4.5M3 8.5v7L12 20l9-4.5v-7" /></>, p);

export const IconList = (p: IconProps) =>
  base(<><path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" /></>, p);

export const IconTarget = (p: IconProps) =>
  base(<><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4.2" /><circle cx="12" cy="12" r="0.9" fill="currentColor" /></>, p);

export const IconScan = (p: IconProps) =>
  base(<><path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" /><path d="M4 12h16" /></>, p);
