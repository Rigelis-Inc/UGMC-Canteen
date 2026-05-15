import { createContext, useContext, useEffect, useReducer } from "react";

const CartContext = createContext(null);

const STORAGE_KEY = "mayrit_cart";

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function cartReducer(state, action) {
  switch (action.type) {
    case "ADD_ITEM": {
      const existing = state.find((i) => i.id === action.item.id);
      if (existing) {
        return state.map((i) =>
          i.id === action.item.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...state, { ...action.item, quantity: 1 }];
    }
    case "REMOVE_ITEM":
      return state.filter((i) => i.id !== action.id);
    case "UPDATE_QUANTITY": {
      if (action.quantity <= 0) return state.filter((i) => i.id !== action.id);
      return state.map((i) =>
        i.id === action.id ? { ...i, quantity: action.quantity } : i
      );
    }
    case "CLEAR_CART":
      return [];
    default:
      return state;
  }
}

export function CartProvider({ children }) {
  const [items, dispatch] = useReducer(cartReducer, [], loadFromStorage);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  const addItem = (item) => dispatch({ type: "ADD_ITEM", item });
  const removeItem = (id) => dispatch({ type: "REMOVE_ITEM", id });
  const updateQuantity = (id, quantity) => dispatch({ type: "UPDATE_QUANTITY", id, quantity });
  const clearCart = () => dispatch({ type: "CLEAR_CART" });

  return (
    <CartContext.Provider value={{ items, totalItems, totalPrice, addItem, removeItem, updateQuantity, clearCart }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
