import React, { memo } from 'react';
import Svg, { Path, Circle, Rect, Line, Polygon, G } from 'react-native-svg';

type IconProps = {
  size?: number;
  color?: string;
};

// ─── Combat / Swords (⚔) ──────────────────────────────────
export const SwordIcon = memo(({ size = 14, color = '#00FF41' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M4 20L9 15M20 4L14.5 9.5M14.5 9.5L17 12L12 17L9.5 14.5M14.5 9.5L9.5 14.5M9 15L5 19" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M20 4L15 4L15 9" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
));

// ─── Target / Crosshair (🎯) ──────────────────────────────
export const TargetIcon = memo(({ size = 14, color = '#FFB000' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={2} />
    <Circle cx={12} cy={12} r={4} stroke={color} strokeWidth={2} />
    <Line x1={12} y1={1} x2={12} y2={5} stroke={color} strokeWidth={2} />
    <Line x1={12} y1={19} x2={12} y2={23} stroke={color} strokeWidth={2} />
    <Line x1={1} y1={12} x2={5} y2={12} stroke={color} strokeWidth={2} />
    <Line x1={19} y1={12} x2={23} y2={12} stroke={color} strokeWidth={2} />
  </Svg>
));

// ─── DNA / Race (🧬) ──────────────────────────────────────
export const DnaIcon = memo(({ size = 14, color = '#00E5FF' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M7 2C7 2 7 8 12 12C17 16 17 22 17 22" stroke={color} strokeWidth={2} strokeLinecap="round" />
    <Path d="M17 2C17 2 17 8 12 12C7 16 7 22 7 22" stroke={color} strokeWidth={2} strokeLinecap="round" />
    <Line x1={8} y1={5} x2={16} y2={5} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    <Line x1={9} y1={9} x2={15} y2={9} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    <Line x1={9} y1={15} x2={15} y2={15} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    <Line x1={8} y1={19} x2={16} y2={19} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
  </Svg>
));

// ─── Trident / Subclass (🔱) ──────────────────────────────
export const TridentIcon = memo(({ size = 14, color = '#B266FF' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Line x1={12} y1={7} x2={12} y2={23} stroke={color} strokeWidth={2} strokeLinecap="round" />
    <Path d="M12 2L12 7" stroke={color} strokeWidth={2} strokeLinecap="round" />
    <Path d="M5 8L5 2L12 7L19 2L19 8" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    <Line x1={8} y1={19} x2={16} y2={19} stroke={color} strokeWidth={2} strokeLinecap="round" />
  </Svg>
));

// ─── Clipboard / Actions (📋) ─────────────────────────────
export const ClipboardIcon = memo(({ size = 14, color = '#00FF41' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x={5} y={4} width={14} height={18} rx={2} stroke={color} strokeWidth={2} />
    <Path d="M9 2H15V4H9V2Z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
    <Line x1={9} y1={10} x2={15} y2={10} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    <Line x1={9} y1={14} x2={15} y2={14} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    <Line x1={9} y1={18} x2={13} y2={18} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
  </Svg>
));

// ─── Warning (⚠) ──────────────────────────────────────────
export const WarningIcon = memo(({ size = 14, color = '#FFB000' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M12 2L2 22H22L12 2Z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
    <Line x1={12} y1={9} x2={12} y2={15} stroke={color} strokeWidth={2} strokeLinecap="round" />
    <Circle cx={12} cy={18} r={1} fill={color} />
  </Svg>
));

// ─── Chevron Down (▾) ─────────────────────────────────────
export const ChevronDownIcon = memo(({ size = 14, color = '#00FF41' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M6 9L12 15L18 9" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
));

// ─── Chevron Right (▸) ────────────────────────────────────
export const ChevronRightIcon = memo(({ size = 14, color = '#00FF41' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M9 6L15 12L9 18" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
));

// ─── Checkmark (✓) ────────────────────────────────────────
export const CheckIcon = memo(({ size = 14, color = '#00FF41' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M5 12L10 17L19 7" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
));

// ─── Radio Dot (●) ────────────────────────────────────────
export const RadioDotIcon = memo(({ size = 14, color = '#00FF41' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx={12} cy={12} r={5} fill={color} />
  </Svg>
));

// ─── Book / Glossary (📖) ─────────────────────────────────
export const BookIcon = memo(({ size = 14, color = '#00FF41' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M4 4C4 4 4 2 8 2C12 2 12 4 12 4V22C12 22 12 20 8 20C4 20 4 22 4 22V4Z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
    <Path d="M20 4C20 4 20 2 16 2C12 2 12 4 12 4V22C12 22 12 20 16 20C20 20 20 22 20 22V4Z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
  </Svg>
));

// ─── Search (🔍) ──────────────────────────────────────────
export const SearchIcon = memo(({ size = 14, color = '#00FF41' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx={10} cy={10} r={7} stroke={color} strokeWidth={2} />
    <Line x1={15} y1={15} x2={21} y2={21} stroke={color} strokeWidth={2.5} strokeLinecap="round" />
  </Svg>
));

// ─── Stats / Bar Chart (📊) ──────────────────────────────
export const StatsIcon = memo(({ size = 14, color = '#00FF41' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x={3} y={14} width={4} height={8} rx={1} stroke={color} strokeWidth={2} />
    <Rect x={10} y={8} width={4} height={14} rx={1} stroke={color} strokeWidth={2} />
    <Rect x={17} y={3} width={4} height={19} rx={1} stroke={color} strokeWidth={2} />
  </Svg>
));

// ─── Monster / Skull (👹) ─────────────────────────────────
export const SkullIcon = memo(({ size = 14, color = '#FF3E3E' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M12 2C7 2 4 6 4 10C4 14 6 16 6 16V19H9V17H11V19H13V17H15V19H18V16C18 16 20 14 20 10C20 6 17 2 12 2Z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
    <Circle cx={9} cy={10} r={2} fill={color} />
    <Circle cx={15} cy={10} r={2} fill={color} />
  </Svg>
));

// ─── Lightning (⚡) ───────────────────────────────────────
export const LightningIcon = memo(({ size = 14, color = '#FFB000' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M13 2L4 14H12L11 22L20 10H12L13 2Z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
  </Svg>
));

// ─── Dice (🎲) ────────────────────────────────────────────
export const DiceIcon = memo(({ size = 14, color = '#00FF41' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x={3} y={3} width={18} height={18} rx={3} stroke={color} strokeWidth={2} />
    <Circle cx={8} cy={8} r={1.5} fill={color} />
    <Circle cx={16} cy={8} r={1.5} fill={color} />
    <Circle cx={12} cy={12} r={1.5} fill={color} />
    <Circle cx={8} cy={16} r={1.5} fill={color} />
    <Circle cx={16} cy={16} r={1.5} fill={color} />
  </Svg>
));

// ─── Shield (🛡) ──────────────────────────────────────────
export const ShieldIcon = memo(({ size = 14, color = '#00E5FF' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M12 2L4 6V12C4 17 8 21 12 22C16 21 20 17 20 12V6L12 2Z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
  </Svg>
));

// ─── Hammer / Blacksmith (⚒) ──────────────────────────────
export const HammerIcon = memo(({ size = 14, color = '#FFB000' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M6 6L3 3" stroke={color} strokeWidth={2.5} strokeLinecap="round" />
    <Rect x={6} y={4} width={8} height={4} rx={1} stroke={color} strokeWidth={2} transform="rotate(45 6 4)" />
    <Line x1={10} y1={14} x2={20} y2={22} stroke={color} strokeWidth={2.5} strokeLinecap="round" />
    <Line x1={8} y1={10} x2={12} y2={14} stroke={color} strokeWidth={2} strokeLinecap="round" />
  </Svg>
));

// ─── Diamond / Market (◈) ─────────────────────────────────
export const DiamondIcon = memo(({ size = 14, color = '#00FF41' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Polygon points="12,2 22,12 12,22 2,12" stroke={color} strokeWidth={2} strokeLinejoin="round" />
    <Polygon points="12,6 18,12 12,18 6,12" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
  </Svg>
));

// ─── Moon / Inn (☽) ───────────────────────────────────────
export const MoonIcon = memo(({ size = 14, color = '#FFB000' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M20 14C20 18.4 16.4 22 12 22C7.6 22 4 18.4 4 14C4 9.6 7.6 6 12 6C10 8 9.5 11 11 14C12.5 17 15.5 18.5 18 18C19.2 17 20 15.6 20 14Z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
  </Svg>
));

// ─── Cross / Church (✟) ──────────────────────────────────
export const CrossIcon = memo(({ size = 14, color = '#00FF41' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Line x1={12} y1={2} x2={12} y2={22} stroke={color} strokeWidth={2.5} strokeLinecap="round" />
    <Line x1={6} y1={8} x2={18} y2={8} stroke={color} strokeWidth={2.5} strokeLinecap="round" />
  </Svg>
));

// ─── Anvil / alternative blacksmith ──────────────────────
export const AnvilIcon = memo(({ size = 14, color = '#FFB000' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M4 14H20V17C20 18.1 19.1 19 18 19H6C4.9 19 4 18.1 4 17V14Z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
    <Path d="M8 14V10C8 8 10 6 12 6H20V10H14V14" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    <Line x1={8} y1={19} x2={8} y2={22} stroke={color} strokeWidth={2} strokeLinecap="round" />
    <Line x1={16} y1={19} x2={16} y2={22} stroke={color} strokeWidth={2} strokeLinecap="round" />
  </Svg>
));

// ─── Guild (⚔ alternative for village) ───────────────────
export const GuildIcon = memo(({ size = 14, color = '#FF3E3E' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M5 3L12 10" stroke={color} strokeWidth={2} strokeLinecap="round" />
    <Path d="M19 3L12 10" stroke={color} strokeWidth={2} strokeLinecap="round" />
    <Path d="M3 5L10 12" stroke={color} strokeWidth={2} strokeLinecap="round" />
    <Path d="M21 5L14 12" stroke={color} strokeWidth={2} strokeLinecap="round" />
    <Line x1={12} y1={12} x2={12} y2={22} stroke={color} strokeWidth={2} strokeLinecap="round" />
    <Line x1={8} y1={22} x2={16} y2={22} stroke={color} strokeWidth={2} strokeLinecap="round" />
  </Svg>
));

// ─── Gear / Mechanics (⚙) ────────────────────────────────
export const GearIcon = memo(({ size = 14, color = '#00FF41' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx={12} cy={12} r={3} stroke={color} strokeWidth={2} />
    <Path d="M12 1V4M12 20V23M4.22 4.22L6.34 6.34M17.66 17.66L19.78 19.78M1 12H4M20 12H23M4.22 19.78L6.34 17.66M17.66 6.34L19.78 4.22" stroke={color} strokeWidth={2} strokeLinecap="round" />
  </Svg>
));

// ─── Scale / Alignments (⚖) ─────────────────────────────
export const ScaleIcon = memo(({ size = 14, color = '#00FF41' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Line x1={12} y1={2} x2={12} y2={22} stroke={color} strokeWidth={2} strokeLinecap="round" />
    <Line x1={4} y1={22} x2={20} y2={22} stroke={color} strokeWidth={2} strokeLinecap="round" />
    <Line x1={4} y1={6} x2={20} y2={6} stroke={color} strokeWidth={2} strokeLinecap="round" />
    <Path d="M4 6L2 14H10L8 6" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M20 6L18 14H22" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M16 6L14 14H22L20 6" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
));

// ─── Scroll / Background (📜) ────────────────────────────
export const ScrollIcon = memo(({ size = 14, color = '#00E5FF' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M6 3C4.9 3 4 3.9 4 5V19C4 20.1 4.9 21 6 21H18C19.1 21 20 20.1 20 19" stroke={color} strokeWidth={2} strokeLinejoin="round" />
    <Path d="M20 19V5C20 3.9 19.1 3 18 3H6" stroke={color} strokeWidth={2} strokeLinejoin="round" />
    <Line x1={8} y1={8} x2={16} y2={8} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    <Line x1={8} y1={12} x2={16} y2={12} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    <Line x1={8} y1={16} x2={13} y2={16} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
  </Svg>
));

// ─── Tag / Label (🏷) ────────────────────────────────────
export const TagIcon = memo(({ size = 14, color = '#00FF41' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M2 12V3H11L22 12L13 21L2 12Z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
    <Circle cx={7} cy={7} r={1.5} fill={color} />
  </Svg>
));

// ─── Brain (🧠) ──────────────────────────────────────────
export const BrainIcon = memo(({ size = 14, color = '#00E5FF' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M12 2C9 2 7 4 7 6C5 6 3 8 3 10C3 12 4 13.5 6 14C6 16 7 18 9 19V22H15V19C17 18 18 16 18 14C20 13.5 21 12 21 10C21 8 19 6 17 6C17 4 15 2 12 2Z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
    <Line x1={12} y1={6} x2={12} y2={16} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
  </Svg>
));
