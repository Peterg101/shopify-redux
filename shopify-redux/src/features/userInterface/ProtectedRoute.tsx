import React from 'react';
import { Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { authApi } from '../../services/authApi';
import { selectIsLoggedIn } from '../../services/selectors';
import { CircularProgress, Box } from '@mui/material';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const selectSessionQuery = authApi.endpoints.getSession.select();

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const isLoggedIn = useSelector(selectIsLoggedIn);
  const { isLoading } = useSelector(selectSessionQuery);

  if (isLoading && !isLoggedIn) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
