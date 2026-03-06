import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { selectIsLoggedIn } from "../../services/selectors";
import { LandingPage } from "../display/landingPage";
import { Fulfill } from "../fulfill/fulfill";
import { LoginPage } from "../display/LoginPage";
import { OrderDetailPage } from "../orders/OrderDetailPage";
import { ProtectedRoute } from "./ProtectedRoute";
import { authApi } from "../../services/authApi";
import { CircularProgress, Box } from "@mui/material";

const selectSessionQuery = authApi.endpoints.getSession.select();

function RootRedirect() {
  const isLoggedIn = useSelector(selectIsLoggedIn);
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

function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/generate" element={<ProtectedRoute><LandingPage /></ProtectedRoute>} />
        <Route path="/fulfill" element={<ProtectedRoute><Fulfill /></ProtectedRoute>} />
        <Route path="/orders/:orderId" element={<ProtectedRoute><OrderDetailPage /></ProtectedRoute>} />
        <Route path="*" element={<h1>404 - Page Not Found</h1>} />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRouter;
