/**
 * 공통 아이콘 — lucide 한 세트(선 1.6, currentColor)를 앱 이름으로 묶어 둔다 (판정 D3).
 * 화면은 이 이름만 쓴다. 크기는 width/height(또는 부모의 [&_svg]:w-*)로 정한다.
 */
import type { SVGProps } from 'react';
import {
  LayoutDashboard, ChartLine, Wallet, Repeat, ChartPie, Folder, Lock, FileText, SquareCheck, Calendar, Box,
  Settings, Shield, Bell, Trash, Menu, Search, Plus, ChevronDown, LogOut, Upload, Pencil, X, Download, File,
  Landmark, TrendingUp, FolderPlus, Image, ChartColumn, Clock, GripVertical, Check, Star, Copy, Eye,
  CircleAlert, TriangleAlert, House, CreditCard,
  type LucideIcon,
} from 'lucide-react';

type IconProps = SVGProps<SVGSVGElement>;

// lucide 아이콘을 앱 기본값(선 1.6 · 24 기준)으로 감싼다
function wrap(Icon: LucideIcon) {
  const Wrapped = (p: IconProps) => <Icon strokeWidth={1.6} aria-hidden {...p} />;
  Wrapped.displayName = Icon.displayName;
  return Wrapped;
}

export const IconGrid = wrap(LayoutDashboard);
export const IconChart = wrap(ChartLine);
export const IconWon = wrap(Wallet);
export const IconRepeat = wrap(Repeat);
export const IconPie = wrap(ChartPie);
export const IconFolder = wrap(Folder);
export const IconLock = wrap(Lock);
export const IconDoc = wrap(FileText);
export const IconCheckSquare = wrap(SquareCheck);
export const IconCalendar = wrap(Calendar);
export const IconCube = wrap(Box);
export const IconSettings = wrap(Settings);
export const IconShield = wrap(Shield);
export const IconBell = wrap(Bell);
export const IconTrash = wrap(Trash);
export const IconMenu = wrap(Menu);
export const IconSearch = wrap(Search);
export const IconPlus = wrap(Plus);
export const IconCaret = wrap(ChevronDown);
export const IconLogout = wrap(LogOut);
export const IconUpload = wrap(Upload);
export const IconEdit = wrap(Pencil);
export const IconClose = wrap(X);
export const IconDownload = wrap(Download);
export const IconFileBlank = wrap(File);
export const IconBank = wrap(Landmark);
export const IconTrendUp = wrap(TrendingUp);
export const IconFolderPlus = wrap(FolderPlus);
export const IconImage = wrap(Image);
export const IconBars = wrap(ChartColumn);
export const IconClock = wrap(Clock);
export const IconDrag = wrap(GripVertical);
export const IconCheck = wrap(Check);
export const IconStar = wrap(Star);
export const IconCopy = wrap(Copy);
export const IconEye = wrap(Eye);
export const IconAlertCircle = wrap(CircleAlert);
export const IconAlertTriangle = wrap(TriangleAlert);
export const IconHome = wrap(House);
export const IconCreditCard = wrap(CreditCard);

// LifeLedger 로고(2x2 사각형) — 사이드바 개편 때 글자 로고로 바뀐다
export const IconLogo = (p: IconProps) => (
  <svg viewBox="0 0 22 22" fill="none" {...p}>
    <rect x="2" y="2" width="8" height="8" rx="2" fill="var(--accent)" />
    <rect x="12" y="2" width="8" height="8" rx="2" fill="var(--accent)" opacity=".3" />
    <rect x="2" y="12" width="8" height="8" rx="2" fill="var(--accent)" opacity=".3" />
    <rect x="12" y="12" width="8" height="8" rx="2" fill="var(--accent)" opacity=".12" />
  </svg>
);
