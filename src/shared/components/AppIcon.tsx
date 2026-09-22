import type { SVGProps } from 'react';

export type AppIconName =
  | 'home'
  | 'trophy'
  | 'fine'
  | 'wallet'
  | 'admin'
  | 'settings'
  | 'logout'
  | 'bell'
  | 'more'
  | 'refresh'
  | 'wifi-off'
  | 'download';

const paths: Record<AppIconName, React.ReactNode> = {
  home: <path d="m3 10 9-7 9 7v10H15v-7H9v7H3V10Z" />,
  trophy: (
    <>
      <path d="M8 4h8v4c0 3-1.8 5-4 5s-4-2-4-5V4Z" />
      <path d="M8 6H4v2c0 2 1.2 3 3.2 3M16 6h4v2c0 2-1.2 3-3.2 3M12 13v4M8 20h8m-6-3h4" />
    </>
  ),
  fine: <path d="M7 3h10v18l-2-1.5-3 1.5-3-1.5L7 21V3Zm3 5h4m-4 4h4m-4 4h2" />,
  wallet: (
    <path d="M4 6h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Zm0 0 12-3v3m1 5h4v4h-4a2 2 0 1 1 0-4Z" />
  ),
  admin: (
    <path d="M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h6v6h-6v-6Z" />
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19 13.5v-3l-2-.7-.7-1.7.9-1.9-2.1-2.1-1.9.9-1.7-.7-.7-2h-3l-.7 2-1.7.7-1.9-.9-2.1 2.1.9 1.9-.7 1.7-2 .7v3l2 .7.7 1.7-.9 1.9 2.1 2.1 1.9-.9 1.7.7.7 2h3l.7-2 1.7-.7 1.9.9 2.1-2.1-.9-1.9.7-1.7 2-.7Z" />
    </>
  ),
  logout: <path d="M10 4H5v16h5m5-4 4-4-4-4m4 4H9" />,
  bell: <path d="M6 9a6 6 0 0 1 12 0v5l2 3H4l2-3V9Zm4 11h4" />,
  more: (
    <>
      <circle cx="5" cy="12" r="1" fill="currentColor" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
      <circle cx="19" cy="12" r="1" fill="currentColor" />
    </>
  ),
  refresh: (
    <path d="M20 7v5h-5M4 17v-5h5m10.5-3A8 8 0 0 0 6 6.5L4 9m.5 6A8 8 0 0 0 18 17.5L20 15" />
  ),
  'wifi-off': (
    <path d="m3 3 18 18M8.5 8.5A9 9 0 0 1 20 10m-2.5 3.5a5 5 0 0 0-5.6-1M4 10a12 12 0 0 1 3-2m-1 5a8 8 0 0 1 3.5-1.5M9 16a4 4 0 0 1 6 0m-3 4h.01" />
  ),
  download: <path d="M12 3v12m-4-4 4 4 4-4M5 20h14" />,
};

export function AppIcon({
  name,
  ...props
}: { name: AppIconName } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
