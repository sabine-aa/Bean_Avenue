export interface OptionChoice {
  label: string;
  priceDelta: number;
}

export interface OptionGroup {
  name: string;
  choices: OptionChoice[];
}

export interface MenuItem {
  id: number;
  name: string;
  category: string;
  description: string;
  price: number;
  options: OptionGroup[];
  tags: string[];
  photo: string | null;
  inStock: boolean;
  isHidden: boolean;
  sortOrder: number;
  suggestions?: MenuItem[];
}

export interface SelectedOption {
  group: string;
  choice: string;
  priceDelta: number;
}

export interface CartLine {
  key: string;
  menuItemId: number;
  name: string;
  photo: string | null;
  basePrice: number;
  unitPrice: number;
  quantity: number;
  selectedOptions: SelectedOption[];
}

export type OrderStatus = "NEW" | "PREPARING" | "READY" | "PICKED_UP" | "CANCELLED";

export interface Order {
  id: number;
  number: string;
  customerName: string;
  phone: string;
  email: string | null;
  subtotal: number;
  discount: number;
  total: number;
  promoCode: string | null;
  pickupTime: string | null;
  status: OrderStatus;
  beansEarned: number;
  createdAt: string;
  items: {
    id: number;
    name: string;
    unitPrice: number;
    quantity: number;
    selectedOptions: SelectedOption[];
    lineTotal: number;
  }[];
}

export interface Room {
  id: number;
  name: string;
  type: "STUDY" | "CONFERENCE";
  description: string;
  pricePerHour: number;
  capacityMin: number;
  capacityMax: number;
  openHour: number;
  closeHour: number;
  amenities: string[];
  rules: string[];
  images: string[];
  isAvailable: boolean;
  bufferMinutes: number;
}

export type BookingStatus =
  | "PENDING"
  | "CONFIRMED"
  | "IN_USE"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW";

export interface Booking {
  id: number;
  number: string;
  roomId: number;
  room?: Room;
  customerName: string;
  phone: string;
  startTime: string;
  endTime: string;
  durationHours: number;
  peopleCount: number;
  notes: string | null;
  total: number;
  status: BookingStatus;
  beansEarned: number;
  createdAt: string;
}

export interface LoyaltyAccount {
  id: number;
  name: string;
  phone: string;
  beanBalance: number;
  lifetimeBeans: number;
  tier: string;
  nextTier: { name: string; beansToGo: number } | null;
  transactions?: {
    id: number;
    type: "EARN" | "REDEEM" | "ADJUST";
    amount: number;
    source: string;
    refId: string | null;
    note: string | null;
    createdAt: string;
  }[];
  alreadyMember?: boolean;
  redeemed?: string;
  message?: string;
}

export interface Customer {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  beanBalance: number;
  lifetimeBeans: number;
  tier: string;
  isVip: boolean;
  noShowCount: number;
  createdAt: string;
  _count?: { orders: number; bookings: number };
  orders?: Order[];
  bookings?: Booking[];
  lifetimeValue?: number;
  transactions?: LoyaltyAccount["transactions"];
}
