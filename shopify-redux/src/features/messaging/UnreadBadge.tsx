import { Badge, IconButton } from '@mui/material';
import ChatIcon from '@mui/icons-material/Chat';
import { useGetUnreadCountQuery } from '../../services/dbApi';

interface UnreadBadgeProps {
  onClick?: () => void;
}

export const UnreadBadge = ({ onClick }: UnreadBadgeProps) => {
  const { data } = useGetUnreadCountQuery();
  const count = data?.total_unread ?? 0;

  return (
    <IconButton onClick={onClick} sx={{ color: 'text.secondary' }}>
      <Badge
        badgeContent={count}
        color="primary"
        max={99}
        sx={{
          '& .MuiBadge-badge': {
            backgroundColor: '#00E5FF',
            color: '#0A0E14',
            fontWeight: 700,
          },
        }}
      >
        <ChatIcon />
      </Badge>
    </IconButton>
  );
};
