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
    menuItemId: number | null;
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

export type LoyaltyTxType = "EARN" | "REDEEM" | "ADJUST";

export interface LoyaltyTransaction {
  id: number;
  type: LoyaltyTxType;
  amount: number;
  balanceAfter: number;
  source: string;
  refId: string | null;
  note: string | null;
  createdAt: string;
  customer?: { id: number; name: string; phone: string };
}

export type RewardType = "FREE_ITEM" | "DISCOUNT";

export interface Reward {
  id: number;
  name: string;
  description: string;
  category: string | null;
  cost: number;
  type: RewardType;
  icon: string;
  image: string | null;
  redeemMethod: string;
  isActive: boolean;
  isAvailable: boolean;
  sortOrder: number;
  createdAt?: string;
  _count?: { redemptions: number };
}

// The menu categories rewards can be organised under.
export const REWARD_CATEGORIES = [
  "Special Item",
  "Espresso Based",
  "Sandwiches",
  "Salads",
  "Freshly Baked",
  "Desserts",
  "Beverages",
  "Refreshers",
  "Iced Teas",
  "Milk Shakes",
  "Frappes",
  "Hot Teas",
  "Rakwah",
  "Frozen Yogurt",
  "Iced Drinks",
  "Filtered Coffee",
  "Hot Drinks",
] as const;

export type RedemptionStatus = "ACTIVE" | "CLAIMED" | "EXPIRED";

export interface Redemption {
  id: number;
  code: string;
  customerId: number;
  rewardId: number | null;
  rewardName: string;
  cost: number;
  status: RedemptionStatus;
  createdAt: string;
  claimedAt: string | null;
  customer?: { id: number; name: string; phone: string };
}

export interface EventItem {
  id: number;
  title: string;
  description: string;
  startTime: string;
  price: number;
  spots: number | null;
  image: string | null;
  isHidden: boolean;
  sortOrder: number;
  createdAt?: string;
}

export interface Subscriber {
  id: number;
  name: string | null;
  phone: string;
  createdAt: string;
}

export interface Banner {
  id: number;
  title: string;
  text: string;
  image: string | null;
  buttonText: string | null;
  buttonLink: string | null;
  startDate: string | null;
  endDate: string | null;
  isVisible: boolean;
  createdAt?: string;
}

export type SuggestionStatus = "NEW" | "REVIEWED" | "RESOLVED";

export interface Suggestion {
  id: number;
  customerId: number | null;
  name: string | null;
  phone: string | null;
  message: string;
  status: SuggestionStatus;
  adminNote: string | null;
  createdAt: string;
  customer?: { id: number; name: string; phone: string } | null;
}

export interface LoyaltyAccount {
  id: number;
  name: string;
  phone: string;
  email?: string | null;
  beanBalance: number;
  lifetimeBeans: number;
  tier: string;
  nextTier: { name: string; beansToGo: number } | null;
  transactions?: LoyaltyTransaction[];
  redemptions?: Redemption[];
  orders?: Order[];
  bookings?: Booking[];
  message?: string;
  voucherCode?: string;
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
