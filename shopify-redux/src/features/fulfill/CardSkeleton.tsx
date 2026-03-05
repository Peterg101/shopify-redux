import { Card, CardContent, Skeleton, Box, Stack } from '@mui/material'

export const CardSkeleton = () => (
  <Card>
    <Skeleton
      variant="rectangular"
      sx={{ width: '100%', aspectRatio: '4/3' }}
      animation="wave"
    />
    <CardContent>
      <Skeleton variant="text" width="75%" height={28} animation="wave" />
      <Stack direction="row" spacing={0.5} mt={1}>
        <Skeleton variant="rounded" width={48} height={22} animation="wave" />
        <Skeleton variant="rounded" width={64} height={22} animation="wave" />
        <Skeleton variant="rounded" width={40} height={22} animation="wave" />
      </Stack>
      <Skeleton
        variant="rectangular"
        height={6}
        sx={{ mt: 1.5, borderRadius: 1 }}
        animation="wave"
      />
      <Skeleton variant="text" width="40%" height={24} sx={{ mt: 1 }} animation="wave" />
      <Stack direction="row" spacing={1} mt={1.5}>
        <Skeleton variant="rounded" width={72} height={32} animation="wave" />
        <Skeleton variant="rounded" width={72} height={32} animation="wave" />
      </Stack>
    </CardContent>
  </Card>
)

export const SkeletonGrid = ({ count = 8 }: { count?: number }) => (
  <Box
    sx={{
      display: 'grid',
      gridTemplateColumns: {
        xs: '1fr',
        sm: 'repeat(2, 1fr)',
        md: 'repeat(3, 1fr)',
        lg: 'repeat(4, 1fr)',
      },
      gap: 2,
    }}
  >
    {Array.from({ length: count }).map((_, i) => (
      <CardSkeleton key={i} />
    ))}
  </Box>
)
