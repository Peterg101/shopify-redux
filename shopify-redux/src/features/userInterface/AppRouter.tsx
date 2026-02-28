import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { RootState } from "../../app/store";
import { LandingPage } from "../display/landingPage";
import { Fulfill } from "../fulfill/fulfill";
import { LoginPage } from "../display/LoginPage";
import { ProtectedRoute } from "./ProtectedRoute";
import { authApi } from "../../services/authApi";
import { CircularProgress, Box } from "@mui/material";

const selectSessionQuery = authApi.endpoints.getSession.select();

const RootRedirect: React.FC = () => {
  const isLoggedIn = useSelector((state: RootState) => state.userInterfaceState.isLoggedIn);
  const { isLoading } = useSelector(selectSessionQuery);

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return <Navigate to={isLoggedIn ? "/generate" : "/login"} replace />;
};

const AppRouter: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/generate" element={<ProtectedRoute><LandingPage /></ProtectedRoute>} />
        <Route path="/fulfill" element={<ProtectedRoute><Fulfill /></ProtectedRoute>} />
        <Route path="*" element={<h1>404 - Page Not Found</h1>} />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRouter;
