import type { CoreComponent } from '@/types/core';
import type { SpaceToken } from '@/types/tokens';

import { ValueOrResponsive } from '@/utilities/opaque-responsive';

export type StackDirection = 'vertical' | 'horizontal';
export type StackAlignment = 'start' | 'center' | 'end';
export type StackJustify = 'start' | 'center' | 'end';

export interface StackProps extends CoreComponent {
  as?: 'div' | 'section' | 'header' | 'footer';
  direction?: ValueOrResponsive<StackDirection>;
  alignment?: ValueOrResponsive<StackAlignment>;
  justify?: ValueOrResponsive<StackJustify>;
  gap?: ValueOrResponsive<SpaceToken>;
}
