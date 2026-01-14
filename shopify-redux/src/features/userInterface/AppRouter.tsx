import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LandingPage } from "../display/landingPage";
import { Fulfill } from "../fulfill/fullfill";

const AppRouter: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
      <Route path="/" element={<Navigate to="/generate" replace />} />
        <Route path="/generate" element={<LandingPage/>} />
        <Route path="/fulfill" element={<Fulfill/>} />
        {/* Catch-all route for 404 */}
        <Route path="*" element={<h1>404 - Page Not Found</h1>} />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRouter;