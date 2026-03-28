import { useSelector } from 'react-redux';
import { selectUserInformation } from '../../services/selectors';
import { useResendVerificationMutation } from '../../services/authApi';
import { Alert, Button } from '@mui/material';

export function VerifyEmailBanner() {
  const userInfo = useSelector(selectUserInformation);
  const [resend, { isLoading, isSuccess }] = useResendVerificationMutation();

  if (!userInfo || userInfo.email_verified) return null;

  return (
    <Alert
      severity="warning"
      sx={{ borderRadius: 0 }}
      action={
        <Button
          size="small"
          onClick={() => resend()}
          disabled={isLoading || isSuccess}
        >
          {isLoading ? 'Sending...' : isSuccess ? 'Sent!' : 'Resend'}
        </Button>
      }
    >
      Please verify your email to unlock all features.
    </Alert>
  );
}

export default VerifyEmailBanner;
