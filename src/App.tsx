import { Navigate, Route, Routes } from "react-router-dom";
import { AdminLayout } from "./admin/AdminLayout";
import { AdminAddons } from "./admin/AddonsManager";
import { AdminBanners } from "./admin/BannerManager";
import { AdminBirthdayRewards } from "./admin/BirthdayRewards";
import { AdminBookings } from "./admin/Bookings";
import { AdminCustomers } from "./admin/Customers";
import { AdminDashboard } from "./admin/Dashboard";
import { AdminDelivery } from "./admin/Delivery";
import { AdminDoughnuts } from "./admin/DoughnutsManager";
import { AdminEvents } from "./admin/EventsManager";
import { AdminEventSuggestions } from "./admin/EventSuggestions";
import { AdminFeatured } from "./admin/FeaturedManager";
import { AdminLogin } from "./admin/Login";
import { AdminLoyalty } from "./admin/LoyaltyLedger";
import { AdminMenuManager } from "./admin/MenuManager";
import { AdminOrders } from "./admin/Orders";
import { AdminPayments } from "./admin/Payments";
import { AdminReports } from "./admin/Reports";
import { AdminRewards } from "./admin/RewardsManager";
import { AdminRooms } from "./admin/RoomsManagement";
import { AdminStaff } from "./admin/StaffManager";
import { AdminSubscribers } from "./admin/Subscribers";
import { AdminSuggestions } from "./admin/Suggestions";
import { Layout } from "./components/Layout";
import { About } from "./pages/About";
import { Account } from "./pages/Account";
import { Doughnuts } from "./pages/Doughnuts";
import { Events } from "./pages/Events";
import { EventDetails } from "./pages/EventDetails";
import { BookingSuccess } from "./pages/BookingSuccess";
import { BookRoom } from "./pages/BookRoom";
import { Cart } from "./pages/Cart";
import { Checkout } from "./pages/Checkout";
import { Contact } from "./pages/Contact";
import { Home } from "./pages/Home";
import { KDS } from "./pages/KDS";
import { Loyalty } from "./pages/Loyalty";
import { Menu } from "./pages/Menu";
import { OrderSuccess } from "./pages/OrderSuccess";
import { POS } from "./pages/POS";
import { ProductDetails } from "./pages/ProductDetails";
import { Rooms } from "./pages/Rooms";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/menu" element={<Menu />} />
        <Route path="/menu/:id" element={<ProductDetails />} />
        <Route path="/doughnuts" element={<Doughnuts />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/order-success/:number" element={<OrderSuccess />} />
        <Route path="/rooms" element={<Rooms />} />
        <Route path="/book" element={<BookRoom />} />
        <Route path="/booking-success/:number" element={<BookingSuccess />} />
        <Route path="/loyalty" element={<Loyalty />} />
        <Route path="/events" element={<Events />} />
        <Route path="/events/:id" element={<EventDetails />} />
        <Route path="/account" element={<Account />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
      </Route>

      <Route path="/pos" element={<POS />} />
      <Route path="/kds" element={<KDS />} />

      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AdminDashboard />} />
        <Route path="orders" element={<AdminOrders />} />
        <Route path="delivery" element={<AdminDelivery />} />
        <Route path="payments" element={<AdminPayments />} />
        <Route path="menu" element={<AdminMenuManager />} />
        <Route path="addons" element={<AdminAddons />} />
        <Route path="doughnuts" element={<AdminDoughnuts />} />
        <Route path="featured" element={<AdminFeatured />} />
        <Route path="bookings" element={<AdminBookings />} />
        <Route path="rooms" element={<AdminRooms />} />
        <Route path="customers" element={<AdminCustomers />} />
        <Route path="rewards" element={<AdminRewards />} />
        <Route path="birthday" element={<AdminBirthdayRewards />} />
        <Route path="loyalty" element={<AdminLoyalty />} />
        <Route path="events" element={<AdminEvents />} />
        <Route path="event-suggestions" element={<AdminEventSuggestions />} />
        <Route path="banners" element={<AdminBanners />} />
        <Route path="subscribers" element={<AdminSubscribers />} />
        <Route path="suggestions" element={<AdminSuggestions />} />
        <Route path="reports" element={<AdminReports />} />
        <Route path="staff" element={<AdminStaff />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
