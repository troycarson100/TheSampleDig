"use client"

import { createContext, useContext, type ReactNode } from "react"
import { useCartState, type Cart } from "@/lib/use-cart"

const CartContext = createContext<Cart | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  return <CartContext.Provider value={useCartState()}>{children}</CartContext.Provider>
}

/** One shared cart. Throws rather than silently handing back an isolated one. */
export function useCart(): Cart {
  const cart = useContext(CartContext)
  if (!cart) throw new Error("useCart must be used inside <CartProvider>")
  return cart
}
