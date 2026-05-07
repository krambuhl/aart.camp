import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';

import { Stack } from './index';

test('Stack renders children inside the element configured by the `as` prop', () => {
  render(
    <Stack as="section">
      <span>child-content</span>
    </Stack>,
  );

  const section = screen.getByText('child-content').closest('section');
  expect(section).not.toBeNull();
});
