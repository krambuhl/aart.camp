import type { CoreComponent } from '@/types/core';
import type { SpaceToken } from '@/types/tokens';

import type { ValueOrResponsive } from '@/utilities/opaque-responsive';

export type Directions = 't' | 'r' | 'b' | 'l' | 'h' | 'v' | 'a';

export type MarginProps = {
  [MarginProperty in `m${Directions}`]?: ValueOrResponsive<SpaceToken>;
};

export type PaddingProps = {
  [PaddingProperty in `p${Directions}`]?: ValueOrResponsive<SpaceToken>;
};

export interface SpacerProps extends CoreComponent, MarginProps, PaddingProps {
  as?: 'div' | 'section' | 'header' | 'footer';
}
