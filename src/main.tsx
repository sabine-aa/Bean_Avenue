import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AdminAuthProvider } from "./context/AdminAuthContext";
import { CartProvider } from "./context/CartContext";
import { CustomerAuthProvider } from "./context/CustomerAuthContext";
import { NotificationsProvider } from "./context/NotificationsContext";
import { ToastProvider } from "./context/ToastContext";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AdminAuthProvider>
          <CustomerAuthProvider>
            <NotificationsProvider>
              <CartProvider>
                <App />
              </CartProvider>
            </NotificationsProvider>
          </CustomerAuthProvider>
        </AdminAuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
