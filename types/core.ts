import type { AriaAttributes } from 'react';

export interface CoreComponent<T extends HTMLElement = HTMLElement> extends React.HTMLAttributes<T>, AriaAttributes {
  className?: string;
  children?: React.ReactNode;
}
