import type { CoreComponent } from '@/types/core';

export interface PageHeaderProps extends Partial<CoreComponent> {
  title: string;
  subtitle?: string;
  date?: string;
}
