import a11y from '@storybook/addon-a11y';
import { definePreview } from '@storybook/nextjs-vite';

import 'the-new-css-reset/css/reset.css';
import '../styles/tokens.css';
import '../styles/globals.css';

export default definePreview({
  addons: [a11y],
});
