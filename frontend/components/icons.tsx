/**
 * 공통 아이콘 — lucide 한 세트(선 1.6, currentColor)를 앱 이름으로 묶어 둔다 (판정 D3).
 * 화면은 이 이름만 쓴다. 크기는 width/height(또는 부모의 [&_svg]:w-*)로 정한다.
 */
import type { SVGProps } from 'react';
import {
  LayoutDashboard, ChartLine, Wallet, Repeat, ChartPie, Folder, Lock, FileText, SquareCheck, Calendar, Box,
  Settings, Shield, Bell, Trash, Menu, Search, Plus, ChevronDown, LogOut, Upload, Pencil, X, Download, File,
  Landmark, TrendingUp, FolderPlus, Image, ChartColumn, Clock, GripVertical, Check, Star, Copy, Eye,
  CircleAlert, TriangleAlert, House, CreditCard, KeyRound, ScrollText, Tag, Sun, Moon, Ellipsis, ExternalLink,
  Inbox, ArrowUp, ArrowDown, ArrowLeftRight, RefreshCw, ChevronRight, ChevronLeft, Info, Minus, LockOpen, List, LayoutGrid,
  Pause, Play, Ban, Link, Mail, User, Monitor, Smartphone, ShieldCheck, CalendarPlus, Archive, Send, CircleCheck, Funnel, ArrowUpRight, Percent, PiggyBank, Coins, RotateCcw, Hourglass, Loader, FolderOpen, FileImage, FileArchive, Paperclip, BellOff, SlidersHorizontal,
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
export const IconKey = wrap(KeyRound);
export const IconLogs = wrap(ScrollText);
export const IconTag = wrap(Tag);
export const IconSun = wrap(Sun);
export const IconMoon = wrap(Moon);
export const IconMore = wrap(Ellipsis);
export const IconExternal = wrap(ExternalLink);
export const IconInbox = wrap(Inbox);
export const IconArrowUp = wrap(ArrowUp);
export const IconArrowDown = wrap(ArrowDown);
export const IconTransfer = wrap(ArrowLeftRight);
export const IconRefresh = wrap(RefreshCw);
export const IconChevronRight = wrap(ChevronRight);
export const IconChevronLeft = wrap(ChevronLeft);
export const IconInfo = wrap(Info);
export const IconMinus = wrap(Minus);
export const IconUnlock = wrap(LockOpen);
export const IconList = wrap(List);
export const IconTiles = wrap(LayoutGrid);
export const IconPause = wrap(Pause);
export const IconPlay = wrap(Play);
export const IconBan = wrap(Ban);
export const IconLink = wrap(Link);
export const IconMail = wrap(Mail);
export const IconUser = wrap(User);
export const IconMonitor = wrap(Monitor);
export const IconPhone = wrap(Smartphone);
export const IconShieldCheck = wrap(ShieldCheck);
export const IconCalendarPlus = wrap(CalendarPlus);
export const IconArchive = wrap(Archive);
export const IconSend = wrap(Send);
export const IconCircleCheck = wrap(CircleCheck);
export const IconFilter = wrap(Funnel);
export const IconArrowUpRight = wrap(ArrowUpRight);
export const IconPercent = wrap(Percent);
export const IconPiggyBank = wrap(PiggyBank);
export const IconCoins = wrap(Coins);
export const IconUndo = wrap(RotateCcw);
export const IconHourglass = wrap(Hourglass);
export const IconLoader = wrap(Loader);
export const IconFolderOpen = wrap(FolderOpen);
export const IconFileImage = wrap(FileImage);
export const IconFileArchive = wrap(FileArchive);
export const IconPaperclip = wrap(Paperclip);
export const IconBellOff = wrap(BellOff);
export const IconSliders = wrap(SlidersHorizontal);
