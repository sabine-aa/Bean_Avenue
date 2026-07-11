export interface OptionChoice {
  label: string;
  priceDelta: number;
}

export interface OptionGroup {
  name: string;
  choices: OptionChoice[];
}

// Nutrition facts (mainly for Protein Drinks). All optional — only shown when set.
export interface Nutrition {
  kcal?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fibers?: number;
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
  imageFit?: "cover" | "contain"; // how the photo fills the card (default "cover")
  focalX?: number; // focal point X % (0-100) — which part stays when cropped
  focalY?: number; // focal point Y % (0-100)
  ingredients?: string | null;
  nutrition?: Nutrition | null;
  inStock: boolean;
  isHidden: boolean;
  isBestSeller?: boolean;
  availableToday?: boolean;
  sortOrder: number;
  suggestions?: MenuItem[];
}

export interface SelectedOption {
  group: string;
  choice: string;
  priceDelta: number;
}

// ---- Add-ons ----
export interface Addon {
  id: number;
  groupId: number;
  name: string;
  price: number;
  maxQuantity: number;
  isAvailable: boolean;
  sortOrder: number;
}

export interface AddonAssignment {
  id: number;
  groupId: number;
  menuItemId: number | null;
  category: string | null;
}

export interface AddonGroup {
  id: number;
  name: string;
  selection: "SINGLE" | "MULTIPLE";
  minSelect: number;
  maxSelect: number; // 0 = no limit
  isAvailable: boolean;
  sortOrder: number;
  addons: Addon[];
  assignments?: AddonAssignment[];
}

// An add-on a customer picked, with its resolved price + quantity.
export interface SelectedAddon {
  addonId: number;
  name: string;
  price: number;
  quantity: number;
}

// As stored on an order item (price snapshot; addonId kept so it can be re-ordered).
export interface OrderAddon {
  addonId?: number;
  name: string;
  price: number;
  quantity: number;
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
  addons: SelectedAddon[];
  specialInstructions: string;
}

export type Fulfillment = "PICKUP" | "DELIVERY";

export type PaymentMethod = "ONLINE" | "CASH_ON_DELIVERY" | "CASH_AT_PICKUP" | "CASH" | "CARD" | "WHISH";

export type PaymentStatus =
  | "PENDING"
  | "PAID"
  | "FAILED"
  | "CANCELLED"
  | "REFUNDED"
  | "PARTIALLY_REFUNDED"
  | "CASH_DUE"
  | "CASH_COLLECTED";

export type OrderStatus =
  | "AWAITING_PAYMENT"
  | "RECEIVED"
  | "ACCEPTED"
  | "PREPARING"
  | "READY_FOR_PICKUP"
  | "COMPLETED"
  | "READY_FOR_DELIVERY"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "CANCELLED"
  // legacy values still present on old orders (aliased in orderStatus.ts)
  | "NEW"
  | "READY"
  | "PICKED_UP";

export interface OrderItemLine {
  id: number;
  menuItemId: number | null;
  name: string;
  unitPrice: number;
  quantity: number;
  selectedOptions: SelectedOption[];
  addons: OrderAddon[];
  specialInstructions: string | null;
  lineTotal: number;
}

export interface Payment {
  id: number;
  orderId: number | null;
  provider: string;
  transactionId: string;
  method: "CARD" | "CASH";
  amount: number;
  currency: string;
  status: "PENDING" | "PAID" | "FAILED" | "CANCELLED" | "REFUNDED" | "PARTIALLY_REFUNDED";
  cardBrand: string | null;
  cardLast4: string | null;
  refundedAmount: number;
  failureReason: string | null;
  createdAt: string;
  order?: { number: string; customerName: string; phone: string; fulfillment: Fulfillment; total: number } | null;
}

export interface Order {
  id: number;
  number: string;
  customerName: string;
  phone: string;
  email: string | null;

  fulfillment: Fulfillment;
  channel?: string; // ONLINE | POS
  orderType?: string | null; // POS: TAKEAWAY | DINE_IN
  tableNumber?: string | null;
  pickupTime: string | null;

  subtotal: number;
  addonsTotal: number;
  discount: number;
  loyaltyDiscount: number;
  deliveryFee: number;
  tax: number;
  total: number;
  promoCode: string | null;
  loyaltyRedemptionCode?: string | null;

  status: OrderStatus;
  cancelReason?: string | null;
  cancelledBy?: string | null;

  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paidAt?: string | null;

  // Delivery snapshot (present when fulfillment === "DELIVERY"; PII hidden on
  // public track responses for non-owners)
  zoneName?: string | null;
  deliveryName?: string | null;
  deliveryPhone?: string | null;
  addressLabel?: string | null;
  addressLine?: string | null;
  building?: string | null;
  floor?: string | null;
  apartment?: string | null;
  area?: string | null;
  landmark?: string | null;
  deliveryInstructions?: string | null;
  lat?: number | null;
  lng?: number | null;
  estimatedDelivery?: string | null;
  driverName?: string | null;

  beansEarned: number;
  createdAt: string;
  items: OrderItemLine[];
  payments?: Payment[];
}

export interface SavedAddress {
  id: number;
  label: string;
  fullName: string;
  phone: string;
  addressLine: string;
  building: string;
  floor: string;
  apartment: string;
  area: string;
  landmark: string;
  instructions: string;
  lat: number | null;
  lng: number | null;
  isDefault: boolean;
  createdAt?: string;
}

export interface DeliveryZone {
  id: number;
  name: string;
  fee: number;
  minOrder: number;
  estimatedTime: string;
  maxDistanceKm: number | null;
  centerLat: number | null;
  centerLng: number | null;
  isAvailable: boolean;
  sortOrder: number;
}

export interface DeliveryQuote {
  available: boolean;
  reason?: string;
  zone?: { id: number; name: string; estimatedTime: string };
  fee: number;
  minOrder: number;
  belowMinimum: boolean;
  freeApplied: boolean;
}

export interface StorefrontConfig {
  currency: string;
  tax: { rate: number; label: string };
  delivery: {
    enabled: boolean;
    paused: boolean;
    hoursOpen: boolean;
    available: boolean;
    freeThreshold: number;
    defaultEstimate: string;
    hours: { enabled: boolean; start: string; end: string };
  };
  pickup: { enabled: boolean; prepTime: string; scheduleEnabled: boolean; location: string };
  payment: { online: boolean; cashOnDelivery: boolean; cashAtPickup: boolean };
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
  value?: number; // DISCOUNT rewards: $ off the order
  icon: string;
  image: string | null;
  redeemMethod: string;
  isActive: boolean;
  isAvailable: boolean;
  sortOrder: number;
  createdAt?: string;
  _count?: { redemptions: number };
}

// The menu categories rewards & add-ons can be organised under. Kept in sync with
// the seeded CATEGORY_ORDER (server/prisma/categories-data.ts).
export const REWARD_CATEGORIES = [
  "Espresso Based",
  "Filtered Coffee",
  "Hot Drinks",
  "Iced Drinks",
  "Special Items",
  "Rakwah",
  "Frappes",
  "Milkshakes",
  "Hot Teas",
  "Refreshers",
  "Iced Teas",
  "Beverages",
  "Protein Drinks",
  "Soft Cream",
  "Desserts",
  "Freshly Baked",
  "Salads",
  "Sandwiches",
  "Hanson Doughnuts",
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
  category: string;
  description: string;
  startTime: string;
  durationMins: number | null;
  location: string;
  included: string; // "what's included", one item per line
  price: number;
  spots: number | null; // remaining spots, null = not tracked
  maxSpots: number | null; // capacity, null = not tracked
  image: string | null;
  isPublished: boolean;
  isHidden: boolean;
  isCompleted: boolean;
  isCancelled: boolean;
  sortOrder: number;
  createdAt?: string;
}

export type EventSuggestionStatus = "NEW" | "REVIEWED" | "CONSIDERING" | "APPROVED" | "REJECTED";

export interface EventSuggestion {
  id: number;
  customerId: number | null;
  idea: string;
  category: string;
  description: string;
  preferredDay: string;
  preferredTime: string;
  name: string | null;
  phone: string | null;
  status: EventSuggestionStatus;
  adminNote: string | null;
  createdAt: string;
}

export type VotingStatus = "OPEN" | "CLOSED" | "SELECTED";

export interface VotingOption {
  id: number;
  title: string;
  description: string;
  category: string;
  image: string | null;
  possibleDate: string;
  isPublished: boolean;
  closesAt: string | null;
  status: VotingStatus;
  sourceSuggestionId: number | null;
  convertedEventId: number | null;
  sortOrder: number;
  createdAt: string;
  voteCount: number;
  hasVoted?: boolean; // present on the public endpoint when logged in
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

export type NotificationType = "ORDER" | "BOOKING" | "REWARD" | "VOUCHER" | "POINTS" | "PAYMENT" | "DELIVERY";

export interface AppNotification {
  id: number;
  type: NotificationType;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
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

export type BirthdayVoucherStatus = "AVAILABLE" | "USED" | "EXPIRED" | "CANCELLED";

export interface BirthdayVoucher {
  id: number;
  code: string;
  customerName: string;
  rewardName: string;
  year: number;
  status: BirthdayVoucherStatus;
  effectiveStatus?: BirthdayVoucherStatus;
  issuedAt: string;
  expiresAt: string;
  usedAt: string | null;
  usedBy: string | null;
  deductedBeans: number;
}

export interface BirthdaySettings {
  enabled: boolean;
  daysBefore: number;
  daysAfter: number;
  rewardName: string;
  eligibleCategory: string;
  eligibleItemIds: number[];
  deductBeans: number;
}

// Admin view of a voucher (includes linked customer + private contact details).
export interface AdminBirthdayVoucher extends BirthdayVoucher {
  customerId: number;
  phone: string | null;
  email: string | null;
  issuedByAdmin: boolean;
  customer?: { id: number; name: string; phone: string | null; email: string | null };
}

export interface UpcomingBirthday {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  birthday: string;
  daysUntil: number;
  claimedThisYear: boolean;
}

export interface BirthdayReward {
  enabled: boolean;
  hasBirthday: boolean;
  birthdayLocked: boolean;
  verified: boolean;
  available: boolean;
  windowStart: string | null;
  windowEnd: string | null;
  rewardName: string;
  eligibleNote: string;
  voucher: BirthdayVoucher | null;
  reason: string;
}

export interface LoyaltyAccount {
  id: number;
  name: string;
  phone: string | null;
  phoneVerified?: boolean;
  email?: string | null;
  emailVerified?: boolean;
  birthday?: string | null;
  birthdayReward?: BirthdayReward;
  needsProfile?: boolean;
  beanBalance: number;
  lifetimeBeans: number;
  tier: string;
  nextTier: { name: string; beansToGo: number } | null;
  transactions?: LoyaltyTransaction[];
  redemptions?: Redemption[];
  orders?: Order[];
  bookings?: Booking[];
  addresses?: SavedAddress[];
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
