import { tokens } from '@/tokens';

export type SpaceToken = (typeof tokens.space)[keyof typeof tokens.space];
export type SizeToken = (typeof tokens.size)[keyof typeof tokens.size];
export type ShadowToken = (typeof tokens.shadow)[keyof typeof tokens.shadow];
export type FontSizeHeadingToken = (typeof tokens.fontSize.heading)[keyof typeof tokens.fontSize.heading];
export type FontSizeBodyToken = (typeof tokens.fontSize.body)[keyof typeof tokens.fontSize.body];
export type FontSizeDataToken = (typeof tokens.fontSize.data)[keyof typeof tokens.fontSize.data];
export type FontSizeToken = FontSizeHeadingToken | FontSizeBodyToken | FontSizeDataToken;
export type FontFamilyToken = (typeof tokens.fontFamily)[keyof typeof tokens.fontFamily];
export type FontWeightToken = (typeof tokens.fontWeight)[keyof typeof tokens.fontWeight];
export type LineHeightToken = (typeof tokens.lineHeight)[keyof typeof tokens.lineHeight];

/* Colors */
export type BackgroundColorToken =
  | (typeof tokens.bg.base)[keyof typeof tokens.bg.base]
  | (typeof tokens.bg.alt)[keyof typeof tokens.bg.alt]
  | (typeof tokens.bg.inverted)[keyof typeof tokens.bg.inverted];

export type ForegroundColorToken =
  | (typeof tokens.fg.regular)[keyof typeof tokens.fg.regular]
  | (typeof tokens.fg.muted)[keyof typeof tokens.fg.muted]
  | (typeof tokens.fg.inverted)[keyof typeof tokens.fg.inverted];

export type PrimaryColorToken =
  | (typeof tokens.primary.action)[keyof typeof tokens.primary.action]
  | (typeof tokens.primary.muted)[keyof typeof tokens.primary.muted];

export type SuccessColorToken =
  | (typeof tokens.success.action)[keyof typeof tokens.success.action]
  | (typeof tokens.success.muted)[keyof typeof tokens.success.muted];

export type WarningColorToken =
  | (typeof tokens.warning.action)[keyof typeof tokens.warning.action]
  | (typeof tokens.warning.muted)[keyof typeof tokens.warning.muted];

export type CriticalColorToken =
  | (typeof tokens.critical.action)[keyof typeof tokens.critical.action]
  | (typeof tokens.critical.muted)[keyof typeof tokens.critical.muted];

export type ColorToken =
  | (typeof tokens.bg.base)[keyof typeof tokens.bg.base]
  | (typeof tokens.bg.alt)[keyof typeof tokens.bg.alt]
  | (typeof tokens.bg.inverted)[keyof typeof tokens.bg.inverted]
  | (typeof tokens.fg.regular)[keyof typeof tokens.fg.regular]
  | (typeof tokens.fg.muted)[keyof typeof tokens.fg.muted]
  | (typeof tokens.fg.inverted)[keyof typeof tokens.fg.inverted]
  | (typeof tokens.primary.action)[keyof typeof tokens.primary.action]
  | (typeof tokens.primary.muted)[keyof typeof tokens.primary.muted]
  | (typeof tokens.success.action)[keyof typeof tokens.success.action]
  | (typeof tokens.success.muted)[keyof typeof tokens.success.muted]
  | (typeof tokens.warning.action)[keyof typeof tokens.warning.action]
  | (typeof tokens.warning.muted)[keyof typeof tokens.warning.muted]
  | (typeof tokens.critical.action)[keyof typeof tokens.critical.action]
  | (typeof tokens.critical.muted)[keyof typeof tokens.critical.muted];

export type AnyToken =
  | (typeof tokens.space)[keyof typeof tokens.space]
  | (typeof tokens.size)[keyof typeof tokens.size]
  | (typeof tokens.shadow)[keyof typeof tokens.shadow]
  | (typeof tokens.fontSize.heading)[keyof typeof tokens.fontSize.heading]
  | (typeof tokens.fontSize.body)[keyof typeof tokens.fontSize.body]
  | (typeof tokens.fontSize.data)[keyof typeof tokens.fontSize.data]
  | (typeof tokens.fontFamily)[keyof typeof tokens.fontFamily]
  | (typeof tokens.fontWeight)[keyof typeof tokens.fontWeight]
  | (typeof tokens.lineHeight)[keyof typeof tokens.lineHeight]
  | (typeof tokens.bg.base)[keyof typeof tokens.bg.base]
  | (typeof tokens.bg.alt)[keyof typeof tokens.bg.alt]
  | (typeof tokens.bg.inverted)[keyof typeof tokens.bg.inverted]
  | (typeof tokens.fg.regular)[keyof typeof tokens.fg.regular]
  | (typeof tokens.fg.muted)[keyof typeof tokens.fg.muted]
  | (typeof tokens.fg.inverted)[keyof typeof tokens.fg.inverted]
  | (typeof tokens.primary.action)[keyof typeof tokens.primary.action]
  | (typeof tokens.primary.muted)[keyof typeof tokens.primary.muted]
  | (typeof tokens.success.action)[keyof typeof tokens.success.action]
  | (typeof tokens.success.muted)[keyof typeof tokens.success.muted]
  | (typeof tokens.warning.action)[keyof typeof tokens.warning.action]
  | (typeof tokens.warning.muted)[keyof typeof tokens.warning.muted]
  | (typeof tokens.critical.action)[keyof typeof tokens.critical.action]
  | (typeof tokens.critical.muted)[keyof typeof tokens.critical.muted];
