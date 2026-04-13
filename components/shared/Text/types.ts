import type { tokens } from '@/tokens';
import type { CoreComponent } from '@/types/core';
import type { ValueOrResponsive } from '@/utilities/opaque-responsive';

export type TextElement = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'span' | 'div';

export interface HeadingTextProps extends CoreComponent {
  as: TextElement;
  size?: ValueOrResponsive<keyof typeof tokens.fontSize.heading>;
}

export interface BodyTextProps extends CoreComponent {
  as?: TextElement;
  size?: ValueOrResponsive<keyof typeof tokens.fontSize.body>;
}

export interface DataTextProps extends CoreComponent {
  as?: TextElement;
  size?: ValueOrResponsive<keyof typeof tokens.fontSize.data>;
}
