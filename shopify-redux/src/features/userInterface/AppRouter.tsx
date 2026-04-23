import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { selectIsLoggedIn } from "../../services/selectors";
import { FEATURES } from "../../config/featureFlags";
import { LandingPage } from "../display/landingPage";
import { Fulfill } from "../fulfill/fulfill";
import { LoginPage } from "../display/LoginPage";
import { OrderDetailPage } from "../orders/OrderDetailPage";
import { CatalogPage } from "../catalog/CatalogPage";
import { PartDetailPage } from "../catalog/PartDetailPage";
import { ProtectedRoute } from "./ProtectedRoute";
import { NotFoundPage } from "../shared/NotFoundPage";
import { ForgotPasswordPage } from "../auth/ForgotPasswordPage";
import { ResetPasswordPage } from "../auth/ResetPasswordPage";
import { VerifyEmailPage } from "../auth/VerifyEmailPage";
import { ConversationsPage } from "../messaging/ConversationsPage";
import { FulfillerSettingsPage } from "../fulfill/FulfillerSettingsPage";
import { OrdersPage } from "../orders/OrdersPage";
import { authApi } from "../../services/authApi";
import { CircularProgress, Box } from "@mui/material";
import FloatingBasketBar from "../basket/FloatingBasketBar";
import BillingPage from "../billing/BillingPage";


const selectSessionQuery = authApi.endpoints.getSlimSession.select();

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
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/generate" element={<ProtectedRoute><LandingPage /></ProtectedRoute>} />
          {FEATURES.MANUFACTURING && <Route path="/fulfill" element={<ProtectedRoute><Fulfill /></ProtectedRoute>} />}
          {FEATURES.MANUFACTURING && <Route path="/orders" element={<ProtectedRoute><OrdersPage /></ProtectedRoute>} />}
          {FEATURES.MANUFACTURING && <Route path="/orders/:orderId" element={<ProtectedRoute><OrderDetailPage /></ProtectedRoute>} />}
          {FEATURES.MANUFACTURING && <Route path="/catalog" element={<ProtectedRoute><CatalogPage /></ProtectedRoute>} />}
          {FEATURES.MANUFACTURING && <Route path="/catalog/:partId" element={<ProtectedRoute><PartDetailPage /></ProtectedRoute>} />}
          {FEATURES.MANUFACTURING && <Route path="/fulfiller-settings" element={<ProtectedRoute><FulfillerSettingsPage /></ProtectedRoute>} />}
          <Route path="/billing" element={<ProtectedRoute><BillingPage /></ProtectedRoute>} />
          <Route path="/messages" element={<ProtectedRoute><ConversationsPage /></ProtectedRoute>} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        {FEATURES.MANUFACTURING && <FloatingBasketBar />}
    </BrowserRouter>
  );
};

export default AppRouter;
