import { Navigate, Route, Routes } from "react-router-dom";
import { AdminLayout } from "./admin/AdminLayout";
import { AdminBookings } from "./admin/Bookings";
import { AdminCustomers } from "./admin/Customers";
import { AdminDashboard } from "./admin/Dashboard";
import { AdminLogin } from "./admin/Login";
import { AdminMenuManager } from "./admin/MenuManager";
import { AdminOrders } from "./admin/Orders";
import { AdminReports } from "./admin/Reports";
import { AdminRooms } from "./admin/RoomsManagement";
import { Layout } from "./components/Layout";
import { About } from "./pages/About";
import { BookingSuccess } from "./pages/BookingSuccess";
import { BookRoom } from "./pages/BookRoom";
import { Cart } from "./pages/Cart";
import { Checkout } from "./pages/Checkout";
import { Contact } from "./pages/Contact";
import { Home } from "./pages/Home";
import { Loyalty } from "./pages/Loyalty";
import { Menu } from "./pages/Menu";
import { OrderSuccess } from "./pages/OrderSuccess";
import { ProductDetails } from "./pages/ProductDetails";
import { Rooms } from "./pages/Rooms";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/menu" element={<Menu />} />
        <Route path="/menu/:id" element={<ProductDetails />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/order-success/:number" element={<OrderSuccess />} />
        <Route path="/rooms" element={<Rooms />} />
        <Route path="/book" element={<BookRoom />} />
        <Route path="/booking-success/:number" element={<BookingSuccess />} />
        <Route path="/loyalty" element={<Loyalty />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
      </Route>

      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AdminDashboard />} />
        <Route path="orders" element={<AdminOrders />} />
        <Route path="menu" element={<AdminMenuManager />} />
        <Route path="bookings" element={<AdminBookings />} />
        <Route path="rooms" element={<AdminRooms />} />
        <Route path="customers" element={<AdminCustomers />} />
        <Route path="reports" element={<AdminReports />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
