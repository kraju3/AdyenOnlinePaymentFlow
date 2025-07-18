import { db } from "./db.server";
import type { CartItem, Product } from "@prisma/client";

export type CartItemWithProduct = CartItem & {
  product: Product;
};

export async function getCartItems(userId: string): Promise<CartItemWithProduct[]> {
  return db.cartItem.findMany({
    where: { userId },
    include: { product: true },
  });
}

export async function addToCart(userId: string, productId: string, quantity: number = 1) {
  const existingItem = await db.cartItem.findUnique({
    where: {
      userId_productId: {
        userId,
        productId,
      },
    },
  });

  if (existingItem) {
    return db.cartItem.update({
      where: { id: existingItem.id },
      data: { quantity: existingItem.quantity + quantity },
      include: { product: true },
    });
  }

  return db.cartItem.create({
    data: {
      userId,
      productId,
      quantity,
    },
    include: { product: true },
  });
}

export async function updateCartItemQuantity(cartItemId: string, quantity: number) {
  if (quantity <= 0) {
    return db.cartItem.delete({
      where: { id: cartItemId },
    });
  }

  return db.cartItem.update({
    where: { id: cartItemId },
    data: { quantity },
    include: { product: true },
  });
}

export async function removeFromCart(cartItemId: string) {
  return db.cartItem.delete({
    where: { id: cartItemId },
  });
}

export async function clearCart(userId: string) {
  return db.cartItem.deleteMany({
    where: { userId },
  });
}

export function calculateCartTotal(cartItems: CartItemWithProduct[]): number {
  return cartItems.reduce((total, item) => {
    return total + item.product.price * item.quantity;
  }, 0);
} 