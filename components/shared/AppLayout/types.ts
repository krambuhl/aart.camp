import type { CoreComponent } from '@/types/core';
import type { SizeToken } from '@/types/tokens';

export interface AppLayoutProps extends CoreComponent {
  width?: SizeToken;
  showHeader?: boolean;
  showFooter?: boolean;
  menu?: React.ReactNode;
  footer?: React.ReactNode;
}
