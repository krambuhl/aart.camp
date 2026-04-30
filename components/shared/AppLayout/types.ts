import type { ReactNode } from 'react';
import type { CoreComponent } from '@/types/core';
import type { SizeToken } from '@/types/tokens';

export interface AppLayoutProps extends CoreComponent {
  width?: SizeToken;
  topBar?: ReactNode;
  showHeader?: boolean;
  showFooter?: boolean;
  menu?: React.ReactNode;
  footer?: React.ReactNode;
}
