import classNames from 'classnames';
import React from 'react';
import type { CoreComponent } from '@/types/core';

interface ComponentOptions {
  tagName: string;
  className?: string;
  variants?: {
    [key: string]: string;
  };
}

export function createComponent<T extends HTMLElement, PropType extends CoreComponent<T>>({ tagName, className }: ComponentOptions) {
  return ({ className: userClassName, children, ...throughUserProps }: PropType) => {
    const classList = classNames(className, className);
    const props = {
      className: classList,
      ...throughUserProps,
    };

    return React.createElement(tagName, props, children);
  };
}
