import { defineMain } from '@storybook/nextjs-vite/node';

export default defineMain({
  framework: '@storybook/nextjs-vite',
  stories: ['../components/**/*.stories.@(tsx|mdx)'],
  addons: ['@storybook/addon-a11y'],
});
