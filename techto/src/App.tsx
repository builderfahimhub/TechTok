import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";

type MediaType = "image" | "video";
type OrderStatus = "Pending Review" | "Approved" | "Rejected" | "Delivered";

type Product = {
  id: string;
  name: string;
  category: string;
  description: string;
  price: number;
  originalPrice?: number;
  stock: number;
  featured: boolean;
  badge?: string;
  rating: number;
  mediaType: MediaType;
  mediaUrl: string;
  accent: string;
  icon: string;
};

type Offer = {
  id: string;
  tag: string;
  title: string;
  subtitle: string;
  coupon: string;
  expires: string;
  mediaType: MediaType;
  mediaUrl: string;
};

type CartItem = {
  productId: string;
  quantity: number;
};

type CustomerDetails = {
  fullName: string;
  phone: string;
  email: string;
  city: string;
  area: string;
  address: string;
  note: string;
  confirmReal: boolean;
};

type OrderItem = {
  productId: string;
  name: string;
  price: number;
  quantity: number;
};

type Order = {
  id: string;
  items: OrderItem[];
  customer: CustomerDetails;
  subtotal: number;
  deliveryFee: number;
  total: number;
  paymentMethod: "Cash on Delivery";
  status: OrderStatus;
  createdAt: string;
  riskScore: number;
  riskLevel: string;
  riskReasons: string[];
  stockCommitted: boolean;
};

type AdminProductForm = {
  name: string;
  category: string;
  price: string;
  originalPrice: string;
  stock: string;
  description: string;
  badge: string;
  featured: boolean;
  mediaType: MediaType;
  mediaUrl: string;
  accent: string;
};

const STORAGE_KEYS = {
  products: "techtok-products",
  offer: "techtok-offer",
  orders: "techtok-orders",
  cart: "techtok-cart",
  adminSession: "techtok-admin-session",
} as const;

const gradientOptions = [
  "linear-gradient(135deg, #111827 0%, #0ea5e9 100%)",
  "linear-gradient(135deg, #1f2937 0%, #8b5cf6 100%)",
  "linear-gradient(135deg, #0f172a 0%, #22c55e 100%)",
  "linear-gradient(135deg, #292524 0%, #f97316 100%)",
  "linear-gradient(135deg, #312e81 0%, #ec4899 100%)",
] as const;

const emptyCustomer: CustomerDetails = {
  fullName: "",
  phone: "",
  email: "",
  city: "",
  area: "",
  address: "",
  note: "",
  confirmReal: false,
};

const emptyProductForm: AdminProductForm = {
  name: "",
  category: "Phones",
  price: "",
  originalPrice: "",
  stock: "",
  description: "",
  badge: "New",
  featured: true,
  mediaType: "image",
  mediaUrl: "",
  accent: gradientOptions[0],
};

function toSvgDataUrl(emoji: string, top: string, bottom: string, label: string) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="${top}" />
          <stop offset="100%" stop-color="${bottom}" />
        </linearGradient>
      </defs>
      <rect width="1200" height="900" rx="56" fill="url(#g)" />
      <circle cx="1020" cy="160" r="120" fill="rgba(255,255,255,0.14)" />
      <circle cx="190" cy="720" r="170" fill="rgba(255,255,255,0.10)" />
      <text x="120" y="290" font-size="220" font-family="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji">${emoji}</text>
      <text x="120" y="660" fill="white" font-size="94" font-family="Inter, Arial, sans-serif" font-weight="700">${label}</text>
      <text x="120" y="735" fill="rgba(255,255,255,0.8)" font-size="40" font-family="Inter, Arial, sans-serif">TechTok premium tech catalog</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function pickIcon(category: string) {
  const normalized = category.toLowerCase();
  if (normalized.includes("phone")) return "📱";
  if (normalized.includes("laptop")) return "💻";
  if (normalized.includes("audio") || normalized.includes("ear")) return "🎧";
  if (normalized.includes("wear") || normalized.includes("watch")) return "⌚";
  if (normalized.includes("camera")) return "📷";
  if (normalized.includes("access")) return "🔌";
  return "⚡";
}

function formatCurrency(value: number) {
  return value.toLocaleString("en-US") + " BDT";
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function usePersistentState<T>(key: string, initialValue: T) {
  const [state, setState] = useState<T>(() => {
    if (typeof window === "undefined") return initialValue;

    try {
      const raw = window.localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, JSON.stringify(state));
  }, [key, state]);

  return [state, setState] as const;
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

function validateCustomer(details: CustomerDetails) {
  const errors: Record<string, string> = {};
  const digits = details.phone.replace(/\D/g, "");

  if (!/^[a-zA-Z][a-zA-Z\s.'-]{2,}$/.test(details.fullName.trim())) {
    errors.fullName = "Enter a real full name.";
  }

  if (digits.length < 10 || digits.length > 15) {
    errors.phone = "Enter a valid phone number.";
  }

  if (details.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(details.email.trim())) {
    errors.email = "Enter a valid email address.";
  }

  if (details.city.trim().length < 2) {
    errors.city = "City is required.";
  }

  if (details.area.trim().length < 2) {
    errors.area = "Area / locality is required.";
  }

  if (details.address.trim().length < 15) {
    errors.address = "Enter a complete delivery address.";
  }

  if (!details.confirmReal) {
    errors.confirmReal = "You must confirm the order details are real.";
  }

  return errors;
}

function assessOrder(details: CustomerDetails) {
  let score = 100;
  const reasons: string[] = [];
  const digits = details.phone.replace(/\D/g, "");

  if (/\d/.test(details.fullName)) {
    score -= 35;
    reasons.push("Name contains digits.");
  }

  if (details.address.trim().length < 18) {
    score -= 20;
    reasons.push("Address looks short.");
  }

  if (/^(\d)\1+$/.test(digits)) {
    score -= 30;
    reasons.push("Phone number looks suspicious.");
  }

  if (/(fake|test|abc)/i.test(`${details.fullName} ${details.note}`)) {
    score -= 45;
    reasons.push("Customer note/name triggered fake-order keyword check.");
  }

  if (details.city.trim().toLowerCase() === details.area.trim().toLowerCase()) {
    score -= 10;
    reasons.push("City and area are identical.");
  }

  score = Math.max(0, score);

  return {
    score,
    level: score >= 80 ? "Low Risk" : score >= 55 ? "Medium Risk" : "High Risk",
    reasons: reasons.length ? reasons : ["Basic customer details checks passed."],
  };
}

const seedProducts: Product[] = [
  {
    id: "product-nova-x-pro",
    name: "Nova X Pro 5G",
    category: "Phones",
    description: "Flagship AMOLED phone with fast charging, clean performance, and COD delivery from TechTok.",
    price: 499,
    originalPrice: 549,
    stock: 12,
    featured: true,
    badge: "Best Seller",
    rating: 4.8,
    mediaType: "image",
    mediaUrl: toSvgDataUrl("📱", "#0f172a", "#0ea5e9", "Nova X Pro"),
    accent: gradientOptions[0],
    icon: "📱",
  },
  {
    id: "product-cloudbeat-tws",
    name: "CloudBeat TWS",
    category: "Audio",
    description: "Noise-reduction earbuds with deep bass, pocket case, and smooth all-day connectivity.",
    price: 69,
    originalPrice: 89,
    stock: 28,
    featured: true,
    badge: "Flash Deal",
    rating: 4.6,
    mediaType: "image",
    mediaUrl: toSvgDataUrl("🎧", "#1f2937", "#8b5cf6", "CloudBeat TWS"),
    accent: gradientOptions[1],
    icon: "🎧",
  },
  {
    id: "product-voltedge-laptop",
    name: "VoltEdge Gaming Laptop",
    category: "Laptops",
    description: "16GB RAM, RTX-class graphics, fast SSD, and a cooling profile built for heavy gaming sessions.",
    price: 1299,
    originalPrice: 1399,
    stock: 6,
    featured: true,
    badge: "Premium",
    rating: 4.9,
    mediaType: "image",
    mediaUrl: toSvgDataUrl("💻", "#111827", "#22c55e", "VoltEdge"),
    accent: gradientOptions[2],
    icon: "💻",
  },
  {
    id: "product-pulsefit-watch",
    name: "PulseFit Smartwatch",
    category: "Wearables",
    description: "Track activity, calls, sleep, and heart rate with a sleek ash-black body.",
    price: 149,
    originalPrice: 179,
    stock: 18,
    featured: false,
    badge: "New",
    rating: 4.5,
    mediaType: "image",
    mediaUrl: toSvgDataUrl("⌚", "#292524", "#f97316", "PulseFit"),
    accent: gradientOptions[3],
    icon: "⌚",
  },
  {
    id: "product-hypercore-bank",
    name: "HyperCore 30W Power Bank",
    category: "Accessories",
    description: "Slim fast-charging power bank with digital battery display and airline-safe design.",
    price: 39,
    originalPrice: 49,
    stock: 40,
    featured: false,
    badge: "Hot Accessory",
    rating: 4.4,
    mediaType: "image",
    mediaUrl: toSvgDataUrl("🔋", "#312e81", "#ec4899", "HyperCore 30W"),
    accent: gradientOptions[4],
    icon: "🔋",
  },
  {
    id: "product-vision-cam",
    name: "Vision 4K Action Cam",
    category: "Cameras",
    description: "Ultra-wide 4K recording, stabilization, waterproof body, and creator-ready accessories.",
    price: 219,
    originalPrice: 249,
    stock: 9,
    featured: true,
    badge: "Creator Pick",
    rating: 4.7,
    mediaType: "image",
    mediaUrl: toSvgDataUrl("📷", "#111827", "#38bdf8", "Vision 4K"),
    accent: gradientOptions[0],
    icon: "📷",
  },
];

const seedOffer: Offer = {
  id: "live-offer-default",
  tag: "LIVE OFFER",
  title: "Up to 25% OFF on accessories + same-day order review",
  subtitle:
    "Use coupon TOK25 today. Every order is verified before approval, and payment is Cash on Delivery only.",
  coupon: "TOK25",
  expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
  mediaType: "image",
  mediaUrl: toSvgDataUrl("⚡", "#111827", "#06b6d4", "TechTok Live Offer"),
};

function MediaTile({
  mediaUrl,
  mediaType,
  alt,
  className,
  videoControls = false,
}: {
  mediaUrl: string;
  mediaType: MediaType;
  alt: string;
  className?: string;
  videoControls?: boolean;
}) {
  if (mediaType === "video") {
    return (
      <video
        className={className}
        src={mediaUrl}
        controls={videoControls}
        muted={!videoControls}
        autoPlay={!videoControls}
        loop={!videoControls}
        playsInline
      />
    );
  }

  return <img className={className} src={mediaUrl} alt={alt} loading="lazy" />;
}

export default function App() {
  const [pathname, setPathname] = useState(() => window.location.pathname + window.location.hash + window.location.search);
  const [products, setProducts] = usePersistentState<Product[]>(STORAGE_KEYS.products, seedProducts);
  const [offer, setOffer] = usePersistentState<Offer>(STORAGE_KEYS.offer, seedOffer);
  const [orders, setOrders] = usePersistentState<Order[]>(STORAGE_KEYS.orders, []);
  const [cart, setCart] = usePersistentState<CartItem[]>(STORAGE_KEYS.cart, []);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = usePersistentState<boolean>(STORAGE_KEYS.adminSession, false);

  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [customerDetails, setCustomerDetails] = useState<CustomerDetails>(emptyCustomer);
  const [checkoutErrors, setCheckoutErrors] = useState<Record<string, string>>({});
  const [storeMessage, setStoreMessage] = useState("");

  const [adminTab, setAdminTab] = useState<"overview" | "products" | "offer" | "orders">("overview");
  const [loginForm, setLoginForm] = useState({ username: "admin", password: "admin123" });
  const [loginError, setLoginError] = useState("");
  const [adminNotice, setAdminNotice] = useState("");
  const [productForm, setProductForm] = useState<AdminProductForm>(emptyProductForm);
  const [offerDraft, setOfferDraft] = useState<Offer>(offer);
  const [uploadingProduct, setUploadingProduct] = useState(false);
  const [uploadingOffer, setUploadingOffer] = useState(false);

  useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname + window.location.hash + window.location.search);
    window.addEventListener("popstate", onPopState);
    window.addEventListener("hashchange", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("hashchange", onPopState);
    };
  }, []);

  useEffect(() => {
    setOfferDraft(offer);
  }, [offer]);

  useEffect(() => {
    if (!storeMessage) return;
    const timeout = window.setTimeout(() => setStoreMessage(""), 3500);
    return () => window.clearTimeout(timeout);
  }, [storeMessage]);

  useEffect(() => {
    if (!adminNotice) return;
    const timeout = window.setTimeout(() => setAdminNotice(""), 3500);
    return () => window.clearTimeout(timeout);
  }, [adminNotice]);

  const lowerPath = pathname.toLowerCase();
  const isAdminRoute =
    lowerPath.includes("/login") ||
    lowerPath.includes("/admin") ||
    lowerPath.includes("#login") ||
    lowerPath.includes("#admin") ||
    lowerPath.includes("?login") ||
    lowerPath.includes("?admin");

  const categories = useMemo(() => {
    return ["All", ...Array.from(new Set(products.map((product) => product.category)))];
  }, [products]);

  const productMap = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesCategory = categoryFilter === "All" || product.category === categoryFilter;
      const query = searchQuery.trim().toLowerCase();
      const matchesQuery =
        !query ||
        product.name.toLowerCase().includes(query) ||
        product.description.toLowerCase().includes(query) ||
        product.category.toLowerCase().includes(query);

      return matchesCategory && matchesQuery;
    });
  }, [categoryFilter, products, searchQuery]);

  const cartDetails = useMemo(() => {
    return cart
      .map((item) => {
        const product = productMap.get(item.productId);
        if (!product) return null;
        return {
          ...item,
          product,
          lineTotal: item.quantity * product.price,
        };
      })
      .filter(Boolean) as Array<CartItem & { product: Product; lineTotal: number }>;
  }, [cart, productMap]);

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cartDetails.reduce((sum, item) => sum + item.lineTotal, 0);
  const deliveryFee = subtotal === 0 ? 0 : subtotal >= 200 ? 0 : 10;
  const total = subtotal + deliveryFee;

  const pendingOrders = orders.filter((order) => order.status === "Pending Review");
  const approvedOrders = orders.filter((order) => order.status === "Approved");
  const rejectedOrders = orders.filter((order) => order.status === "Rejected");
  const deliveredOrders = orders.filter((order) => order.status === "Delivered");
  const lowStockProducts = products.filter((product) => product.stock <= 5);

  function navigate(to: string) {
    window.history.pushState({}, "", to);
    setPathname(to);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function addToCart(product: Product) {
    if (product.stock <= 0) {
      setStoreMessage("This product is out of stock.");
      return;
    }

    setCart((current) => {
      const existing = current.find((item) => item.productId === product.id);
      if (existing) {
        return current.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: Math.min(item.quantity + 1, product.stock) }
            : item,
        );
      }

      return [...current, { productId: product.id, quantity: 1 }];
    });

    setStoreMessage(`${product.name} added to cart.`);
    setCartOpen(true);
  }

  function updateCartQuantity(productId: string, quantity: number) {
    const product = productMap.get(productId);
    if (!product) return;

    if (quantity <= 0) {
      setCart((current) => current.filter((item) => item.productId !== productId));
      return;
    }

    setCart((current) =>
      current.map((item) =>
        item.productId === productId
          ? { ...item, quantity: Math.min(quantity, Math.max(product.stock, 1)) }
          : item,
      ),
    );
  }

  function resetCheckout() {
    setCustomerDetails(emptyCustomer);
    setCheckoutErrors({});
  }

  function handleCheckoutSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!cartDetails.length) {
      setStoreMessage("Your cart is empty.");
      return;
    }

    const stockIssue = cartDetails.find((item) => item.quantity > item.product.stock || item.product.stock <= 0);
    if (stockIssue) {
      setStoreMessage(`Please update cart. ${stockIssue.product.name} stock changed.`);
      return;
    }

    const errors = validateCustomer(customerDetails);
    setCheckoutErrors(errors);

    if (Object.keys(errors).length > 0) return;

    const risk = assessOrder(customerDetails);

    const newOrder: Order = {
      id: `TT-${Date.now()}`,
      items: cartDetails.map((item) => ({
        productId: item.product.id,
        name: item.product.name,
        price: item.product.price,
        quantity: item.quantity,
      })),
      customer: customerDetails,
      subtotal,
      deliveryFee,
      total,
      paymentMethod: "Cash on Delivery",
      status: "Pending Review",
      createdAt: new Date().toISOString(),
      riskScore: risk.score,
      riskLevel: risk.level,
      riskReasons: risk.reasons,
      stockCommitted: false,
    };

    setOrders((current) => [newOrder, ...current]);
    setCart([]);
    setCheckoutOpen(false);
    resetCheckout();
    setStoreMessage(`Order ${newOrder.id} placed. Awaiting admin approval.`);
  }

  async function handleProductUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingProduct(true);

    try {
      const dataUrl = await fileToDataUrl(file);
      setProductForm((current) => ({
        ...current,
        mediaUrl: dataUrl,
        mediaType: file.type.startsWith("video") ? "video" : "image",
      }));
      setAdminNotice("Product media uploaded.");
    } catch {
      setAdminNotice("Could not upload product media.");
    } finally {
      setUploadingProduct(false);
      event.target.value = "";
    }
  }

  async function handleOfferUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingOffer(true);

    try {
      const dataUrl = await fileToDataUrl(file);
      setOfferDraft((current) => ({
        ...current,
        mediaUrl: dataUrl,
        mediaType: file.type.startsWith("video") ? "video" : "image",
      }));
      setAdminNotice("Offer media uploaded.");
    } catch {
      setAdminNotice("Could not upload offer media.");
    } finally {
      setUploadingOffer(false);
      event.target.value = "";
    }
  }

  function handleAddProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const price = Number(productForm.price);
    const originalPrice = Number(productForm.originalPrice);
    const stock = Number(productForm.stock);

    if (!productForm.name.trim() || !productForm.category.trim() || !productForm.description.trim()) {
      setAdminNotice("Fill in the product name, category, and description.");
      return;
    }

    if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(stock) || stock < 0) {
      setAdminNotice("Enter valid product price and stock.");
      return;
    }

    const icon = pickIcon(productForm.category);
    const mediaUrl =
      productForm.mediaUrl ||
      toSvgDataUrl(icon, "#111827", "#64748b", productForm.name.trim().slice(0, 18));

    const newProduct: Product = {
      id: `product-${Date.now()}`,
      name: productForm.name.trim(),
      category: productForm.category.trim(),
      description: productForm.description.trim(),
      price,
      originalPrice: Number.isFinite(originalPrice) && originalPrice > price ? originalPrice : undefined,
      stock,
      featured: productForm.featured,
      badge: productForm.badge.trim() || undefined,
      rating: 4.7,
      mediaType: productForm.mediaType,
      mediaUrl,
      accent: productForm.accent,
      icon,
    };

    setProducts((current) => [newProduct, ...current]);
    setProductForm(emptyProductForm);
    setAdminNotice("New product added to TechTok catalog.");
  }

  function handleSaveOffer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!offerDraft.title.trim() || !offerDraft.subtitle.trim()) {
      setAdminNotice("Offer title and subtitle are required.");
      return;
    }

    setOffer({
      ...offerDraft,
      tag: offerDraft.tag.trim() || "LIVE OFFER",
      coupon: offerDraft.coupon.trim() || "TOK25",
    });
    setAdminNotice("Live offer banner updated.");
  }

  function handleDeleteProduct(productId: string) {
    setProducts((current) => current.filter((product) => product.id !== productId));
    setCart((current) => current.filter((item) => item.productId !== productId));
    setAdminNotice("Product removed.");
  }

  function toggleFeatured(productId: string) {
    setProducts((current) =>
      current.map((product) =>
        product.id === productId ? { ...product, featured: !product.featured } : product,
      ),
    );
  }

  function adjustStock(productId: string, delta: number) {
    setProducts((current) =>
      current.map((product) =>
        product.id === productId ? { ...product, stock: Math.max(0, product.stock + delta) } : product,
      ),
    );
  }

  function updateOrderStatus(orderId: string, nextStatus: OrderStatus) {
    const order = orders.find((entry) => entry.id === orderId);
    if (!order) return;

    if (order.status === nextStatus) return;

    if (order.status !== "Approved" && nextStatus === "Approved") {
      const hasEnoughStock = order.items.every((item) => {
        const product = productMap.get(item.productId);
        return (product?.stock ?? 0) >= item.quantity;
      });

      if (!hasEnoughStock) {
        setAdminNotice("Cannot approve order: not enough stock in catalog.");
        return;
      }

      setProducts((current) =>
        current.map((product) => {
          const matchingItem = order.items.find((item) => item.productId === product.id);
          return matchingItem
            ? { ...product, stock: Math.max(0, product.stock - matchingItem.quantity) }
            : product;
        }),
      );
    }

    if (order.status === "Approved" && nextStatus === "Rejected") {
      setProducts((current) =>
        current.map((product) => {
          const matchingItem = order.items.find((item) => item.productId === product.id);
          return matchingItem ? { ...product, stock: product.stock + matchingItem.quantity } : product;
        }),
      );
    }

    setOrders((current) =>
      current.map((entry) =>
        entry.id === orderId
          ? {
              ...entry,
              status: nextStatus,
              stockCommitted: nextStatus === "Approved" || nextStatus === "Delivered",
            }
          : entry,
      ),
    );

    setAdminNotice(`Order ${orderId} marked as ${nextStatus}.`);
  }

  function handleAdminLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loginForm.username.trim() === "admin" && loginForm.password === "admin123") {
      setIsAdminLoggedIn(true);
      setLoginError("");
      setAdminNotice("Admin access granted.");
      return;
    }

    setLoginError("Use name: admin and password: admin123");
  }

  function logoutAdmin() {
    setIsAdminLoggedIn(false);
    setAdminNotice("Admin logged out.");
  }

  const featuredProducts = products.filter((product) => product.featured).slice(0, 4);

  if (isAdminRoute) {
    return (
      <div className="min-h-screen bg-[#d4d4cf] text-slate-900">
        <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
          <div className="glass-panel mb-6 flex flex-wrap items-center justify-between gap-4 rounded-[28px] px-5 py-4">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="flex items-center gap-3 text-left"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-xl text-white shadow-lg shadow-slate-400/40">
                TT
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">TechTok</p>
                <h1 className="text-xl font-semibold text-slate-900">Admin dashboard</h1>
              </div>
            </button>

            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="rounded-full border border-white/70 bg-white/70 px-3 py-2 text-slate-600">
                Route: /login
              </span>
              <button
                type="button"
                onClick={() => navigate("/")}
                className="rounded-full bg-slate-900 px-4 py-2 font-medium text-white transition hover:bg-slate-700"
              >
                View store
              </button>
            </div>
          </div>

          {!isAdminLoggedIn ? (
            <div className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <section className="glass-panel rounded-[32px] p-8">
                <p className="mb-3 inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700">
                  Hassle-free admin access
                </p>
                <h2 className="max-w-xl text-4xl font-semibold tracking-tight text-slate-900">
                  Manage products, latest offers, uploaded media, and order approval from one place.
                </h2>
                <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
                  TechTok orders stay in pending review until admin approval, helping block fake orders.
                  Upload product images or short videos directly here and keep the live banner updated.
                </p>

                <div className="mt-8 grid gap-4 sm:grid-cols-3">
                  {[
                    `${products.length} products live`,
                    `${pendingOrders.length} orders pending`,
                    "COD checkout only",
                  ].map((item) => (
                    <div key={item} className="rounded-3xl border border-white/70 bg-white/70 p-4 text-sm font-medium text-slate-700 shadow-sm">
                      {item}
                    </div>
                  ))}
                </div>

                <div className="mt-8 overflow-hidden rounded-[28px] border border-white/70 bg-slate-950 p-4 text-white shadow-2xl shadow-slate-500/20">
                  <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
                    <div>
                      <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Live preview</p>
                      <h3 className="mt-2 text-2xl font-semibold">{offer.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-300">{offer.subtitle}</p>
                      <div className="mt-4 flex flex-wrap gap-3 text-sm">
                        <span className="rounded-full bg-white/10 px-3 py-2">Coupon: {offer.coupon}</span>
                        <span className="rounded-full bg-white/10 px-3 py-2">Expires: {formatDate(offer.expires)}</span>
                      </div>
                    </div>
                    <MediaTile
                      mediaType={offer.mediaType}
                      mediaUrl={offer.mediaUrl}
                      alt={offer.title}
                      className="aspect-[4/3] w-full rounded-[24px] border border-white/10 object-cover"
                    />
                  </div>
                </div>
              </section>

              <section className="glass-panel rounded-[32px] p-8">
                <h3 className="text-2xl font-semibold text-slate-900">Login</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Credentials are pre-filled to keep demo admin access quick and easy.
                </p>

                <form onSubmit={handleAdminLogin} className="mt-6 space-y-4">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">Name</span>
                    <input
                      value={loginForm.username}
                      onChange={(event) => setLoginForm((current) => ({ ...current, username: event.target.value }))}
                      className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-slate-900"
                      placeholder="admin"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">Password</span>
                    <input
                      type="password"
                      value={loginForm.password}
                      onChange={(event) => setLoginForm((current) => ({ ...current, password: event.target.value }))}
                      className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-slate-900"
                      placeholder="admin123"
                    />
                  </label>
                  {loginError ? <p className="text-sm font-medium text-rose-600">{loginError}</p> : null}
                  <button
                    type="submit"
                    className="w-full rounded-2xl bg-slate-950 px-5 py-3 font-semibold text-white transition hover:bg-slate-800"
                  >
                    Open dashboard
                  </button>
                </form>

                <div className="mt-5 rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
                  Demo note: This admin panel is client-side for a Vercel-ready frontend demo. Uploaded files,
                  products, offers, and orders are saved in your browser storage.
                </div>
              </section>
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
              <aside className="glass-panel h-fit rounded-[32px] p-5 lg:sticky lg:top-6">
                <div className="rounded-[28px] bg-slate-950 p-5 text-white">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">TechTok secure zone</p>
                  <h2 className="mt-2 text-2xl font-semibold">Welcome, admin</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    Review orders, upload banner media, and keep your catalog fresh.
                  </p>
                </div>

                <div className="mt-5 space-y-2">
                  {[
                    ["overview", "Overview"],
                    ["products", "Products + upload"],
                    ["offer", "Live offer"],
                    ["orders", "Orders"],
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setAdminTab(key as typeof adminTab)}
                      className={`w-full rounded-2xl px-4 py-3 text-left text-sm font-medium transition ${
                        adminTab === key
                          ? "bg-slate-950 text-white shadow-lg shadow-slate-400/30"
                          : "bg-white/70 text-slate-700 hover:bg-white"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={logoutAdmin}
                  className="mt-6 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-950 hover:text-slate-950"
                >
                  Logout
                </button>
              </aside>

              <main className="space-y-6">
                {adminNotice ? (
                  <div className="rounded-3xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                    {adminNotice}
                  </div>
                ) : null}

                {adminTab === "overview" ? (
                  <section className="grid gap-6">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      {[
                        { label: "Catalog products", value: String(products.length) },
                        { label: "Pending orders", value: String(pendingOrders.length) },
                        { label: "Approved orders", value: String(approvedOrders.length) },
                        { label: "Low stock items", value: String(lowStockProducts.length) },
                      ].map((card) => (
                        <div key={card.label} className="glass-panel rounded-[28px] p-5">
                          <p className="text-sm text-slate-500">{card.label}</p>
                          <h3 className="mt-3 text-4xl font-semibold text-slate-900">{card.value}</h3>
                        </div>
                      ))}
                    </div>

                    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                      <div className="glass-panel rounded-[32px] p-6">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Recent orders</p>
                            <h3 className="mt-2 text-2xl font-semibold text-slate-900">Approval queue</h3>
                          </div>
                          <button
                            type="button"
                            onClick={() => setAdminTab("orders")}
                            className="rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white"
                          >
                            Review all
                          </button>
                        </div>

                        <div className="mt-5 space-y-4">
                          {orders.slice(0, 5).map((order) => (
                            <div key={order.id} className="rounded-3xl border border-white/70 bg-white/80 p-4 shadow-sm">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <h4 className="font-semibold text-slate-900">{order.id}</h4>
                                  <p className="text-sm text-slate-500">
                                    {order.customer.fullName} • {order.customer.city} • {formatDate(order.createdAt)}
                                  </p>
                                </div>
                                <span
                                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                    order.status === "Approved"
                                      ? "bg-emerald-100 text-emerald-700"
                                      : order.status === "Rejected"
                                        ? "bg-rose-100 text-rose-700"
                                        : order.status === "Delivered"
                                          ? "bg-sky-100 text-sky-700"
                                          : "bg-amber-100 text-amber-700"
                                  }`}
                                >
                                  {order.status}
                                </span>
                              </div>
                              <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                                <span className="rounded-full bg-slate-100 px-3 py-1">{order.paymentMethod}</span>
                                <span className="rounded-full bg-slate-100 px-3 py-1">Risk: {order.riskLevel}</span>
                                <span className="rounded-full bg-slate-100 px-3 py-1">Total: {formatCurrency(order.total)}</span>
                              </div>
                            </div>
                          ))}

                          {!orders.length ? (
                            <div className="rounded-3xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
                              No orders yet. Customer orders will appear here for manual approval.
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div className="glass-panel rounded-[32px] p-6">
                        <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Operational notes</p>
                        <h3 className="mt-2 text-2xl font-semibold text-slate-900">Fake-order prevention</h3>
                        <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-600">
                          <li>• Every new order is placed into Pending Review.</li>
                          <li>• Customer details are validated before an order can be submitted.</li>
                          <li>• Risk level is auto-scored for suspicious patterns.</li>
                          <li>• Stock is deducted only when the order is approved.</li>
                          <li>• Payment method is locked to Cash on Delivery.</li>
                        </ul>

                        <div className="mt-6 rounded-[28px] bg-slate-950 p-5 text-white">
                          <p className="text-sm text-slate-300">Current live offer</p>
                          <h4 className="mt-2 text-xl font-semibold">{offer.title}</h4>
                          <p className="mt-2 text-sm leading-6 text-slate-300">{offer.subtitle}</p>
                        </div>
                      </div>
                    </div>
                  </section>
                ) : null}

                {adminTab === "products" ? (
                  <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
                    <form onSubmit={handleAddProduct} className="glass-panel rounded-[32px] p-6">
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Add new item</p>
                      <h3 className="mt-2 text-2xl font-semibold text-slate-900">Catalog uploader</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        Upload an image or short video for animated product cards. Use small files for best browser-storage performance.
                      </p>

                      <div className="mt-6 grid gap-4 sm:grid-cols-2">
                        <label className="block sm:col-span-2">
                          <span className="mb-2 block text-sm font-medium text-slate-700">Product name</span>
                          <input
                            value={productForm.name}
                            onChange={(event) => setProductForm((current) => ({ ...current, name: event.target.value }))}
                            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3"
                            placeholder="Example: AeroBook 14"
                          />
                        </label>

                        <label className="block">
                          <span className="mb-2 block text-sm font-medium text-slate-700">Category</span>
                          <input
                            value={productForm.category}
                            onChange={(event) => setProductForm((current) => ({ ...current, category: event.target.value }))}
                            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3"
                            placeholder="Phones"
                          />
                        </label>

                        <label className="block">
                          <span className="mb-2 block text-sm font-medium text-slate-700">Badge</span>
                          <input
                            value={productForm.badge}
                            onChange={(event) => setProductForm((current) => ({ ...current, badge: event.target.value }))}
                            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3"
                            placeholder="New"
                          />
                        </label>

                        <label className="block">
                          <span className="mb-2 block text-sm font-medium text-slate-700">Price</span>
                          <input
                            type="number"
                            min="0"
                            value={productForm.price}
                            onChange={(event) => setProductForm((current) => ({ ...current, price: event.target.value }))}
                            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3"
                            placeholder="299"
                          />
                        </label>

                        <label className="block">
                          <span className="mb-2 block text-sm font-medium text-slate-700">Original price</span>
                          <input
                            type="number"
                            min="0"
                            value={productForm.originalPrice}
                            onChange={(event) => setProductForm((current) => ({ ...current, originalPrice: event.target.value }))}
                            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3"
                            placeholder="349"
                          />
                        </label>

                        <label className="block">
                          <span className="mb-2 block text-sm font-medium text-slate-700">Stock</span>
                          <input
                            type="number"
                            min="0"
                            value={productForm.stock}
                            onChange={(event) => setProductForm((current) => ({ ...current, stock: event.target.value }))}
                            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3"
                            placeholder="10"
                          />
                        </label>

                        <label className="block">
                          <span className="mb-2 block text-sm font-medium text-slate-700">Card accent</span>
                          <select
                            value={productForm.accent}
                            onChange={(event) => setProductForm((current) => ({ ...current, accent: event.target.value }))}
                            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3"
                          >
                            {gradientOptions.map((option, index) => (
                              <option key={option} value={option}>
                                Accent {index + 1}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="block sm:col-span-2">
                          <span className="mb-2 block text-sm font-medium text-slate-700">Description</span>
                          <textarea
                            rows={4}
                            value={productForm.description}
                            onChange={(event) => setProductForm((current) => ({ ...current, description: event.target.value }))}
                            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3"
                            placeholder="Short product details"
                          />
                        </label>

                        <label className="block sm:col-span-2">
                          <span className="mb-2 block text-sm font-medium text-slate-700">Upload image or video</span>
                          <input
                            type="file"
                            accept="image/*,video/*"
                            onChange={handleProductUpload}
                            className="w-full rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-3"
                          />
                          <span className="mt-2 block text-xs text-slate-500">
                            {uploadingProduct ? "Uploading media..." : "Supported: images and short videos."}
                          </span>
                        </label>

                        <label className="flex items-center gap-3 rounded-2xl border border-slate-300 bg-white px-4 py-3 sm:col-span-2">
                          <input
                            type="checkbox"
                            checked={productForm.featured}
                            onChange={(event) => setProductForm((current) => ({ ...current, featured: event.target.checked }))}
                            className="h-4 w-4"
                          />
                          <span className="text-sm font-medium text-slate-700">Show in featured catalog section</span>
                        </label>
                      </div>

                      {productForm.mediaUrl ? (
                        <div className="mt-5 overflow-hidden rounded-[28px] border border-white/70 bg-slate-950 p-3">
                          <MediaTile
                            mediaType={productForm.mediaType}
                            mediaUrl={productForm.mediaUrl}
                            alt="Product preview"
                            className="aspect-video w-full rounded-[20px] object-cover"
                            videoControls
                          />
                        </div>
                      ) : null}

                      <button
                        type="submit"
                        className="mt-6 w-full rounded-2xl bg-slate-950 px-5 py-3 font-semibold text-white transition hover:bg-slate-800"
                      >
                        Add product to catalog
                      </button>
                    </form>

                    <div className="glass-panel rounded-[32px] p-6">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Manage catalog</p>
                          <h3 className="mt-2 text-2xl font-semibold text-slate-900">Product inventory</h3>
                        </div>
                        <span className="rounded-full bg-white/70 px-3 py-2 text-sm font-medium text-slate-600">
                          {products.length} items
                        </span>
                      </div>

                      <div className="mt-5 space-y-4">
                        {products.map((product) => (
                          <div key={product.id} className="rounded-[28px] border border-white/70 bg-white/80 p-4 shadow-sm">
                            <div className="grid gap-4 md:grid-cols-[180px_1fr] md:items-start">
                              <MediaTile
                                mediaType={product.mediaType}
                                mediaUrl={product.mediaUrl}
                                alt={product.name}
                                className="aspect-[4/3] w-full rounded-[22px] object-cover"
                                videoControls
                              />
                              <div>
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div>
                                    <h4 className="text-lg font-semibold text-slate-900">{product.name}</h4>
                                    <p className="mt-1 text-sm text-slate-500">{product.category}</p>
                                  </div>
                                  {product.badge ? (
                                    <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold text-white">
                                      {product.badge}
                                    </span>
                                  ) : null}
                                </div>

                                <p className="mt-3 text-sm leading-6 text-slate-600">{product.description}</p>

                                <div className="mt-4 flex flex-wrap gap-2 text-sm">
                                  <span className="rounded-full bg-slate-100 px-3 py-2 font-semibold text-slate-700">
                                    {formatCurrency(product.price)}
                                  </span>
                                  <span className="rounded-full bg-slate-100 px-3 py-2 text-slate-600">Stock: {product.stock}</span>
                                  <span className="rounded-full bg-slate-100 px-3 py-2 text-slate-600">
                                    {product.featured ? "Featured" : "Standard"}
                                  </span>
                                </div>

                                <div className="mt-4 flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() => toggleFeatured(product.id)}
                                    className="rounded-full border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
                                  >
                                    Toggle featured
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => adjustStock(product.id, 1)}
                                    className="rounded-full border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
                                  >
                                    +1 stock
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => adjustStock(product.id, -1)}
                                    className="rounded-full border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
                                  >
                                    -1 stock
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteProduct(product.id)}
                                    className="rounded-full bg-rose-600 px-3 py-2 text-sm font-semibold text-white"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>
                ) : null}

                {adminTab === "offer" ? (
                  <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
                    <form onSubmit={handleSaveOffer} className="glass-panel rounded-[32px] p-6">
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Top banner editor</p>
                      <h3 className="mt-2 text-2xl font-semibold text-slate-900">Update live offer</h3>

                      <div className="mt-6 space-y-4">
                        <label className="block">
                          <span className="mb-2 block text-sm font-medium text-slate-700">Banner tag</span>
                          <input
                            value={offerDraft.tag}
                            onChange={(event) => setOfferDraft((current) => ({ ...current, tag: event.target.value }))}
                            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3"
                            placeholder="LIVE OFFER"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-2 block text-sm font-medium text-slate-700">Offer title</span>
                          <input
                            value={offerDraft.title}
                            onChange={(event) => setOfferDraft((current) => ({ ...current, title: event.target.value }))}
                            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-2 block text-sm font-medium text-slate-700">Offer subtitle</span>
                          <textarea
                            rows={4}
                            value={offerDraft.subtitle}
                            onChange={(event) => setOfferDraft((current) => ({ ...current, subtitle: event.target.value }))}
                            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3"
                          />
                        </label>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <label className="block">
                            <span className="mb-2 block text-sm font-medium text-slate-700">Coupon</span>
                            <input
                              value={offerDraft.coupon}
                              onChange={(event) => setOfferDraft((current) => ({ ...current, coupon: event.target.value }))}
                              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3"
                            />
                          </label>
                          <label className="block">
                            <span className="mb-2 block text-sm font-medium text-slate-700">Expiry date</span>
                            <input
                              type="date"
                              value={offerDraft.expires ? new Date(offerDraft.expires).toISOString().slice(0, 10) : ""}
                              onChange={(event) =>
                                setOfferDraft((current) => ({
                                  ...current,
                                  expires: event.target.value ? new Date(event.target.value).toISOString() : current.expires,
                                }))
                              }
                              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3"
                            />
                          </label>
                        </div>

                        <label className="block">
                          <span className="mb-2 block text-sm font-medium text-slate-700">Upload banner image or video</span>
                          <input
                            type="file"
                            accept="image/*,video/*"
                            onChange={handleOfferUpload}
                            className="w-full rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-3"
                          />
                          <span className="mt-2 block text-xs text-slate-500">
                            {uploadingOffer ? "Uploading banner media..." : "Images or short promo videos work best."}
                          </span>
                        </label>
                      </div>

                      <button
                        type="submit"
                        className="mt-6 w-full rounded-2xl bg-slate-950 px-5 py-3 font-semibold text-white transition hover:bg-slate-800"
                      >
                        Save live offer
                      </button>
                    </form>

                    <div className="glass-panel rounded-[32px] p-6">
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Storefront preview</p>
                      <h3 className="mt-2 text-2xl font-semibold text-slate-900">What customers see</h3>

                      <div className="mt-5 overflow-hidden rounded-[32px] border border-white/70 bg-slate-950 text-white shadow-2xl shadow-slate-500/20">
                        <div className="border-b border-white/10 px-5 py-3">
                          <div className="marquee-track text-xs font-semibold uppercase tracking-[0.3em] text-white/80">
                            {[1, 2, 3].map((item) => (
                              <span key={item} className="mr-10 inline-flex items-center gap-3 whitespace-nowrap">
                                <span className="soft-pulse h-2 w-2 rounded-full bg-emerald-400" />
                                {offerDraft.tag || "LIVE OFFER"}
                                <span className="text-white">{offerDraft.title}</span>
                                <span className="rounded-full bg-white/10 px-3 py-1">Coupon {offerDraft.coupon || "TOK25"}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="grid gap-5 p-5 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
                          <div>
                            <span className="rounded-full bg-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-200">
                              {offerDraft.tag || "LIVE OFFER"}
                            </span>
                            <h4 className="mt-4 text-3xl font-semibold leading-tight">{offerDraft.title}</h4>
                            <p className="mt-3 text-sm leading-7 text-slate-300">{offerDraft.subtitle}</p>
                            <div className="mt-5 flex flex-wrap gap-3 text-sm">
                              <span className="rounded-full bg-white/10 px-3 py-2">Expires: {formatDate(offerDraft.expires)}</span>
                              <span className="rounded-full bg-emerald-400/20 px-3 py-2 text-emerald-200">
                                Coupon: {offerDraft.coupon || "TOK25"}
                              </span>
                            </div>
                          </div>
                          <MediaTile
                            mediaType={offerDraft.mediaType}
                            mediaUrl={offerDraft.mediaUrl}
                            alt="Offer preview"
                            className="aspect-[4/3] w-full rounded-[24px] border border-white/10 object-cover"
                            videoControls
                          />
                        </div>
                      </div>
                    </div>
                  </section>
                ) : null}

                {adminTab === "orders" ? (
                  <section className="glass-panel rounded-[32px] p-6">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Manual approval center</p>
                        <h3 className="mt-2 text-2xl font-semibold text-slate-900">Orders</h3>
                      </div>
                      <div className="flex flex-wrap gap-2 text-sm">
                        <span className="rounded-full bg-amber-100 px-3 py-2 text-amber-700">Pending {pendingOrders.length}</span>
                        <span className="rounded-full bg-emerald-100 px-3 py-2 text-emerald-700">Approved {approvedOrders.length}</span>
                        <span className="rounded-full bg-rose-100 px-3 py-2 text-rose-700">Rejected {rejectedOrders.length}</span>
                        <span className="rounded-full bg-sky-100 px-3 py-2 text-sky-700">Delivered {deliveredOrders.length}</span>
                      </div>
                    </div>

                    <div className="mt-6 space-y-5">
                      {orders.map((order) => (
                        <div key={order.id} className="rounded-[28px] border border-white/70 bg-white/80 p-5 shadow-sm">
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div>
                              <div className="flex flex-wrap items-center gap-3">
                                <h4 className="text-lg font-semibold text-slate-900">{order.id}</h4>
                                <span
                                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                    order.status === "Approved"
                                      ? "bg-emerald-100 text-emerald-700"
                                      : order.status === "Rejected"
                                        ? "bg-rose-100 text-rose-700"
                                        : order.status === "Delivered"
                                          ? "bg-sky-100 text-sky-700"
                                          : "bg-amber-100 text-amber-700"
                                  }`}
                                >
                                  {order.status}
                                </span>
                                <span
                                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                    order.riskLevel === "Low Risk"
                                      ? "bg-emerald-100 text-emerald-700"
                                      : order.riskLevel === "Medium Risk"
                                        ? "bg-amber-100 text-amber-700"
                                        : "bg-rose-100 text-rose-700"
                                  }`}
                                >
                                  {order.riskLevel} • {order.riskScore}/100
                                </span>
                              </div>
                              <p className="mt-2 text-sm text-slate-500">
                                {order.customer.fullName} • {order.customer.phone} • {order.customer.city}, {order.customer.area}
                              </p>
                              <p className="mt-1 text-sm text-slate-500">Placed on {formatDate(order.createdAt)}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-slate-500">Payment</p>
                              <p className="mt-1 font-semibold text-slate-900">{order.paymentMethod}</p>
                              <p className="mt-2 text-lg font-semibold text-slate-900">{formatCurrency(order.total)}</p>
                            </div>
                          </div>

                          <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_0.95fr]">
                            <div className="rounded-[24px] bg-slate-50 p-4">
                              <h5 className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">Items</h5>
                              <div className="mt-3 space-y-3 text-sm text-slate-700">
                                {order.items.map((item) => (
                                  <div key={`${order.id}-${item.productId}`} className="flex items-center justify-between gap-3">
                                    <div>
                                      <p className="font-medium text-slate-900">{item.name}</p>
                                      <p className="text-slate-500">Qty {item.quantity}</p>
                                    </div>
                                    <p className="font-semibold text-slate-900">{formatCurrency(item.price * item.quantity)}</p>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="rounded-[24px] bg-slate-50 p-4">
                              <h5 className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">Customer details</h5>
                              <div className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                                <p><span className="font-medium text-slate-900">Address:</span> {order.customer.address}</p>
                                {order.customer.email ? (
                                  <p><span className="font-medium text-slate-900">Email:</span> {order.customer.email}</p>
                                ) : null}
                                {order.customer.note ? (
                                  <p><span className="font-medium text-slate-900">Note:</span> {order.customer.note}</p>
                                ) : null}
                                <div className="pt-2">
                                  <p className="font-medium text-slate-900">Verification notes</p>
                                  <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-600">
                                    {order.riskReasons.map((reason) => (
                                      <li key={reason}>{reason}</li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="mt-5 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => updateOrderStatus(order.id, "Approved")}
                              className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => updateOrderStatus(order.id, "Rejected")}
                              className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white"
                            >
                              Reject
                            </button>
                            <button
                              type="button"
                              onClick={() => updateOrderStatus(order.id, "Delivered")}
                              className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white"
                            >
                              Mark delivered
                            </button>
                          </div>
                        </div>
                      ))}

                      {!orders.length ? (
                        <div className="rounded-[28px] border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">
                          No orders yet.
                        </div>
                      ) : null}
                    </div>
                  </section>
                ) : null}
              </main>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#d4d4cf] text-slate-900">
      <div className="border-b border-slate-900/10 bg-slate-950 text-white">
        <div className="mx-auto flex max-w-7xl items-center gap-3 overflow-hidden px-4 py-3 sm:px-6 lg:px-8">
          <div className="marquee-track flex items-center text-xs font-semibold uppercase tracking-[0.34em] text-white/90">
            {[1, 2, 3].map((item) => (
              <span key={item} className="mr-10 inline-flex items-center gap-3 whitespace-nowrap">
                <span className="soft-pulse h-2 w-2 rounded-full bg-emerald-400" />
                {offer.tag}
                <span className="text-white">{offer.title}</span>
                <span className="rounded-full bg-white/10 px-3 py-1 text-[11px]">Coupon {offer.coupon}</span>
                <span className="text-white/60">Expires {formatDate(offer.expires)}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      <header className="sticky top-0 z-30 border-b border-white/60 bg-[#d4d4cf]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <button type="button" onClick={() => navigate("/")} className="flex items-center gap-3 text-left">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-lg font-bold text-white shadow-lg shadow-slate-500/30">
              TT
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Tech shop since 2026</p>
              <h1 className="text-xl font-semibold text-slate-900">TechTok</h1>
            </div>
          </button>

          <div className="hidden items-center gap-3 lg:flex">
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 640, behavior: "smooth" })}
              className="rounded-full px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-white/70 hover:text-slate-900"
            >
              Catalog
            </button>
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 9999, behavior: "smooth" })}
              className="rounded-full px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-white/70 hover:text-slate-900"
            >
              COD info
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-slate-500/25 transition hover:bg-slate-800"
            >
              Cart ({cartCount})
            </button>
          </div>
        </div>
      </header>

      {storeMessage ? (
        <div className="fixed inset-x-0 top-24 z-40 mx-auto max-w-md px-4">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center text-sm font-medium text-emerald-700 shadow-lg shadow-emerald-100">
            {storeMessage}
          </div>
        </div>
      ) : null}

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-stretch">
          <div className="glass-panel overflow-hidden rounded-[36px] p-6 sm:p-8 lg:p-10">
            <p className="inline-flex rounded-full bg-slate-950 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white">
              Ash-theme tech commerce
            </p>
            <h2 className="mt-5 max-w-3xl text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
              Smart gadgets, animated catalog cards, and Cash on Delivery checkout for TechTok.
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
              Discover trending phones, audio, laptops, wearables, and accessories. Every order is
              verified before approval so fake orders stay blocked.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => window.scrollTo({ top: 760, behavior: "smooth" })}
                className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Shop now
              </button>
              <button
                type="button"
                onClick={() => setCartOpen(true)}
                className="rounded-full border border-slate-300 bg-white/70 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-900 hover:text-slate-900"
              >
                View cart
              </button>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {[
                { label: "Live products", value: String(products.length) },
                { label: "COD only", value: "100%" },
                { label: "Orders reviewed", value: "Admin approved" },
              ].map((item) => (
                <div key={item.label} className="rounded-[28px] border border-white/70 bg-white/70 p-4 shadow-sm">
                  <p className="text-sm text-slate-500">{item.label}</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-6">
            <div className="glass-panel rounded-[36px] p-5 sm:p-6">
              <div className="overflow-hidden rounded-[28px] bg-slate-950 p-5 text-white shadow-2xl shadow-slate-500/20">
                <div className="grid gap-5 lg:grid-cols-[1fr_220px] lg:items-center">
                  <div>
                    <span className="rounded-full bg-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-200">
                      {offer.tag}
                    </span>
                    <h3 className="mt-4 text-2xl font-semibold">{offer.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-slate-300">{offer.subtitle}</p>
                    <div className="mt-5 flex flex-wrap gap-3 text-sm">
                      <span className="rounded-full bg-white/10 px-3 py-2">Coupon: {offer.coupon}</span>
                      <span className="rounded-full bg-white/10 px-3 py-2">Expires: {formatDate(offer.expires)}</span>
                    </div>
                  </div>
                  <MediaTile
                    mediaType={offer.mediaType}
                    mediaUrl={offer.mediaUrl}
                    alt={offer.title}
                    className="aspect-square w-full rounded-[24px] border border-white/10 object-cover"
                  />
                </div>
              </div>
            </div>

            <div className="glass-panel rounded-[36px] p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Featured now</p>
                  <h3 className="mt-2 text-2xl font-semibold text-slate-900">Trending at TechTok</h3>
                </div>
                <span className="rounded-full bg-white/80 px-4 py-2 text-sm font-medium text-slate-600">
                  Animated catalog cards
                </span>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {featuredProducts.map((product, index) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => addToCart(product)}
                    className="catalog-card overflow-hidden rounded-[28px] border border-white/70 bg-white/80 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <div className="h-2 w-full" style={{ background: product.accent }} />
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{product.name}</p>
                          <p className="mt-1 text-xs uppercase tracking-[0.25em] text-slate-500">{product.category}</p>
                        </div>
                        <span className="text-2xl">{product.icon}</span>
                      </div>
                      <p className="mt-3 text-xl font-semibold text-slate-900">{formatCurrency(product.price)}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 glass-panel rounded-[36px] p-5 sm:p-6 lg:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Explore products</p>
              <h3 className="mt-2 text-3xl font-semibold text-slate-900">TechTok catalog</h3>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">
                Animated product cards with add-to-cart, product media, stock display, and COD checkout.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search phones, laptops, audio..."
                className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm"
              />
              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm"
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredProducts.map((product, index) => (
              <article
                key={product.id}
                className="catalog-card overflow-hidden rounded-[32px] border border-white/70 bg-white/80 shadow-sm transition hover:-translate-y-1 hover:shadow-2xl"
                style={{ animationDelay: `${index * 80}ms` }}
              >
                <div className="relative overflow-hidden p-4 pb-0">
                  <div className="absolute inset-x-4 top-4 z-10 flex items-start justify-between gap-3">
                    {product.badge ? (
                      <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold text-white shadow-lg">
                        {product.badge}
                      </span>
                    ) : (
                      <span />
                    )}
                    <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-slate-700">
                      {product.stock > 0 ? `${product.stock} in stock` : "Out of stock"}
                    </span>
                  </div>
                  <div
                    className="overflow-hidden rounded-[28px] border border-white/50 p-3 shadow-inner"
                    style={{ background: product.accent }}
                  >
                    <MediaTile
                      mediaType={product.mediaType}
                      mediaUrl={product.mediaUrl}
                      alt={product.name}
                      className="aspect-[4/3] w-full rounded-[22px] object-cover"
                    />
                  </div>
                </div>

                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.28em] text-slate-500">{product.category}</p>
                      <h4 className="mt-2 text-xl font-semibold text-slate-900">{product.name}</h4>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">
                      ⭐ {product.rating}
                    </span>
                  </div>

                  <p className="mt-3 text-sm leading-7 text-slate-600">{product.description}</p>

                  <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <p className="text-2xl font-semibold text-slate-900">{formatCurrency(product.price)}</p>
                      {product.originalPrice ? (
                        <p className="text-sm text-slate-400 line-through">{formatCurrency(product.originalPrice)}</p>
                      ) : null}
                    </div>
                    <span className="rounded-full bg-amber-100 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">
                      COD only
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => addToCart(product)}
                    disabled={product.stock <= 0}
                    className="mt-5 w-full rounded-2xl bg-slate-950 px-5 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {product.stock > 0 ? "Add to cart" : "Out of stock"}
                  </button>
                </div>
              </article>
            ))}
          </div>

          {!filteredProducts.length ? (
            <div className="mt-8 rounded-[28px] border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">
              No products matched your search.
            </div>
          ) : null}
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-3">
          {[
            {
              title: "Order verification",
              text: "Customers must enter full delivery details before an order can be submitted.",
            },
            {
              title: "Cash on Delivery only",
              text: "No online payment gateway is used. Orders are confirmed for COD only.",
            },
            {
              title: "Admin approval flow",
              text: "Every order stays pending until reviewed from the /login dashboard.",
            },
          ].map((item) => (
            <div key={item.title} className="glass-panel rounded-[32px] p-6">
              <h3 className="text-xl font-semibold text-slate-900">{item.title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{item.text}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="mx-auto max-w-7xl px-4 pb-10 pt-2 sm:px-6 lg:px-8">
        <div className="glass-panel rounded-[36px] p-6 sm:p-8">
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">TechTok trust checkout</p>
              <h3 className="mt-2 text-3xl font-semibold text-slate-900">Customers enter real details before placing COD orders.</h3>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                Address, phone, city, and area are required. Orders are verified and approved from the admin dashboard at /login.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCheckoutOpen(true)}
              className="rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Checkout now
            </button>
          </div>
        </div>
      </footer>

      <div
        className={`fixed inset-0 z-50 transition ${cartOpen ? "pointer-events-auto" : "pointer-events-none"}`}
        aria-hidden={!cartOpen}
      >
        <div
          className={`absolute inset-0 bg-slate-950/40 transition ${cartOpen ? "opacity-100" : "opacity-0"}`}
          onClick={() => setCartOpen(false)}
        />
        <aside
          className={`absolute right-0 top-0 h-full w-full max-w-md transform bg-[#ecece8] p-4 shadow-2xl transition duration-300 sm:p-6 ${
            cartOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="glass-panel flex h-full flex-col rounded-[32px] p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Your cart</p>
                <h3 className="mt-2 text-2xl font-semibold text-slate-900">TechTok cart</h3>
              </div>
              <button
                type="button"
                onClick={() => setCartOpen(false)}
                className="rounded-full border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600"
              >
                Close
              </button>
            </div>

            <div className="mt-5 flex-1 space-y-4 overflow-y-auto pr-1">
              {cartDetails.map((item) => (
                <div key={item.product.id} className="rounded-[24px] border border-white/70 bg-white/80 p-4 shadow-sm">
                  <div className="flex gap-4">
                    <MediaTile
                      mediaType={item.product.mediaType}
                      mediaUrl={item.product.mediaUrl}
                      alt={item.product.name}
                      className="h-20 w-20 rounded-2xl object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <h4 className="truncate font-semibold text-slate-900">{item.product.name}</h4>
                      <p className="mt-1 text-sm text-slate-500">{formatCurrency(item.product.price)} each</p>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <div className="flex items-center rounded-full border border-slate-300 bg-white">
                          <button
                            type="button"
                            onClick={() => updateCartQuantity(item.product.id, item.quantity - 1)}
                            className="px-3 py-1 text-lg text-slate-700"
                          >
                            −
                          </button>
                          <span className="min-w-10 px-2 text-center text-sm font-semibold text-slate-900">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => updateCartQuantity(item.product.id, item.quantity + 1)}
                            className="px-3 py-1 text-lg text-slate-700"
                          >
                            +
                          </button>
                        </div>
                        <p className="font-semibold text-slate-900">{formatCurrency(item.lineTotal)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {!cartDetails.length ? (
                <div className="rounded-[28px] border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">
                  Cart is empty. Add products from the TechTok catalog.
                </div>
              ) : null}
            </div>

            <div className="mt-5 rounded-[28px] bg-slate-950 p-5 text-white">
              <div className="flex items-center justify-between text-sm text-slate-300">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm text-slate-300">
                <span>Delivery</span>
                <span>{deliveryFee === 0 ? "Free" : formatCurrency(deliveryFee)}</span>
              </div>
              <div className="mt-4 flex items-center justify-between text-lg font-semibold">
                <span>Total</span>
                <span>{formatCurrency(total)}</span>
              </div>
              <p className="mt-3 text-xs uppercase tracking-[0.28em] text-slate-400">Cash on delivery only</p>

              <button
                type="button"
                onClick={() => {
                  setCartOpen(false);
                  setCheckoutOpen(true);
                }}
                disabled={!cartDetails.length}
                className="mt-5 w-full rounded-2xl bg-white px-5 py-3 font-semibold text-slate-950 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Proceed to checkout
              </button>
            </div>
          </div>
        </aside>
      </div>

      <div
        className={`fixed inset-0 z-[60] overflow-y-auto px-4 py-8 transition ${checkoutOpen ? "pointer-events-auto" : "pointer-events-none"}`}
        aria-hidden={!checkoutOpen}
      >
        <div
          className={`absolute inset-0 bg-slate-950/50 transition ${checkoutOpen ? "opacity-100" : "opacity-0"}`}
          onClick={() => setCheckoutOpen(false)}
        />
        <div className={`relative mx-auto max-w-4xl transition ${checkoutOpen ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"}`}>
          <div className="glass-panel rounded-[36px] p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Checkout</p>
                <h3 className="mt-2 text-3xl font-semibold text-slate-900">Confirm customer details</h3>
                <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">
                  Only real orders are approved. Fill out the delivery form correctly before placing your TechTok COD order.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCheckoutOpen(false)}
                className="rounded-full border border-slate-300 bg-white/70 px-4 py-2 text-sm font-medium text-slate-700"
              >
                Close
              </button>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
              <form onSubmit={handleCheckoutSubmit} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block sm:col-span-2">
                    <span className="mb-2 block text-sm font-medium text-slate-700">Full name</span>
                    <input
                      value={customerDetails.fullName}
                      onChange={(event) => setCustomerDetails((current) => ({ ...current, fullName: event.target.value }))}
                      className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3"
                      placeholder="Your real full name"
                    />
                    {checkoutErrors.fullName ? <span className="mt-1 block text-sm text-rose-600">{checkoutErrors.fullName}</span> : null}
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">Phone number</span>
                    <input
                      value={customerDetails.phone}
                      onChange={(event) => setCustomerDetails((current) => ({ ...current, phone: event.target.value }))}
                      className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3"
                      placeholder="Delivery contact"
                    />
                    {checkoutErrors.phone ? <span className="mt-1 block text-sm text-rose-600">{checkoutErrors.phone}</span> : null}
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">Email (optional)</span>
                    <input
                      value={customerDetails.email}
                      onChange={(event) => setCustomerDetails((current) => ({ ...current, email: event.target.value }))}
                      className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3"
                      placeholder="name@email.com"
                    />
                    {checkoutErrors.email ? <span className="mt-1 block text-sm text-rose-600">{checkoutErrors.email}</span> : null}
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">City</span>
                    <input
                      value={customerDetails.city}
                      onChange={(event) => setCustomerDetails((current) => ({ ...current, city: event.target.value }))}
                      className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3"
                    />
                    {checkoutErrors.city ? <span className="mt-1 block text-sm text-rose-600">{checkoutErrors.city}</span> : null}
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">Area / locality</span>
                    <input
                      value={customerDetails.area}
                      onChange={(event) => setCustomerDetails((current) => ({ ...current, area: event.target.value }))}
                      className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3"
                    />
                    {checkoutErrors.area ? <span className="mt-1 block text-sm text-rose-600">{checkoutErrors.area}</span> : null}
                  </label>

                  <label className="block sm:col-span-2">
                    <span className="mb-2 block text-sm font-medium text-slate-700">Full address</span>
                    <textarea
                      rows={4}
                      value={customerDetails.address}
                      onChange={(event) => setCustomerDetails((current) => ({ ...current, address: event.target.value }))}
                      className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3"
                      placeholder="House / road / landmark / delivery instructions"
                    />
                    {checkoutErrors.address ? <span className="mt-1 block text-sm text-rose-600">{checkoutErrors.address}</span> : null}
                  </label>

                  <label className="block sm:col-span-2">
                    <span className="mb-2 block text-sm font-medium text-slate-700">Order note (optional)</span>
                    <textarea
                      rows={3}
                      value={customerDetails.note}
                      onChange={(event) => setCustomerDetails((current) => ({ ...current, note: event.target.value }))}
                      className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3"
                      placeholder="Any delivery timing note"
                    />
                  </label>
                </div>

                <label className="flex items-start gap-3 rounded-[24px] border border-slate-300 bg-white px-4 py-4">
                  <input
                    type="checkbox"
                    checked={customerDetails.confirmReal}
                    onChange={(event) =>
                      setCustomerDetails((current) => ({ ...current, confirmReal: event.target.checked }))
                    }
                    className="mt-1 h-4 w-4"
                  />
                  <span className="text-sm leading-6 text-slate-700">
                    I confirm that my delivery details are correct and this is a real Cash on Delivery order.
                  </span>
                </label>
                {checkoutErrors.confirmReal ? <span className="block text-sm text-rose-600">{checkoutErrors.confirmReal}</span> : null}

                <button
                  type="submit"
                  className="w-full rounded-2xl bg-slate-950 px-5 py-3 font-semibold text-white transition hover:bg-slate-800"
                >
                  Place COD order for {formatCurrency(total)}
                </button>
              </form>

              <div className="rounded-[32px] bg-slate-950 p-5 text-white shadow-2xl shadow-slate-500/20">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Order summary</p>
                <div className="mt-5 space-y-4">
                  {cartDetails.map((item) => (
                    <div key={item.product.id} className="flex items-center justify-between gap-3 border-b border-white/10 pb-4 text-sm last:border-b-0 last:pb-0">
                      <div>
                        <p className="font-medium text-white">{item.product.name}</p>
                        <p className="mt-1 text-slate-400">Qty {item.quantity}</p>
                      </div>
                      <p className="font-semibold text-white">{formatCurrency(item.lineTotal)}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-6 space-y-3 rounded-[24px] bg-white/5 p-4 text-sm">
                  <div className="flex items-center justify-between text-slate-300">
                    <span>Subtotal</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-300">
                    <span>Delivery</span>
                    <span>{deliveryFee === 0 ? "Free" : formatCurrency(deliveryFee)}</span>
                  </div>
                  <div className="flex items-center justify-between text-lg font-semibold text-white">
                    <span>Total</span>
                    <span>{formatCurrency(total)}</span>
                  </div>
                </div>

                <div className="mt-5 rounded-[24px] border border-amber-400/20 bg-amber-400/10 p-4 text-sm leading-6 text-amber-100">
                  TechTok accepts <strong>Cash on Delivery only</strong>. After you place an order, it stays pending until admin verifies the customer information.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
