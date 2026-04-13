import { Stack } from '@/components/shared/Stack';
import { BodyText } from '@/components/shared/Text';
import { tokens } from '@/tokens';

export default function Loading() {
  return (
    <Stack gap={tokens.space.x24}>
      <BodyText size="sm">loading...</BodyText>
    </Stack>
  );
}
