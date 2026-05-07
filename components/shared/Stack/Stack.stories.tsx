import preview from '@/.storybook/preview';
import { tokens } from '@/tokens';
import { Stack } from './index';

const placeholderStyle = {
  backgroundColor: 'var(--bg-alt-default)',
  color: 'var(--fg-regular-default)',
  padding: 'var(--space-x16)',
};

const meta = preview.meta({
  component: Stack,
});

export const Default = meta.story({
  args: {
    direction: 'vertical',
    alignment: 'center',
    justify: 'start',
    gap: tokens.space.x16,
  },
  render: (args) => (
    <Stack {...args}>
      <div style={placeholderStyle}>One</div>
      <div style={placeholderStyle}>Two</div>
      <div style={placeholderStyle}>Three</div>
    </Stack>
  ),
});
