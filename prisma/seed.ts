import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Clear existing data
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();

  // Create sample products
  const products = await Promise.all([
    prisma.product.create({
      data: {
        name: "Wireless Bluetooth Headphones",
        description: "Premium noise-canceling wireless headphones with 30-hour battery life and crystal-clear sound quality.",
        price: 199.99,
        imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=400&fit=crop",
        category: "Electronics",
        stock: 50,
      },
    }),
    prisma.product.create({
      data: {
        name: "Smart Fitness Watch",
        description: "Advanced fitness tracking with heart rate monitoring, GPS, and 7-day battery life.",
        price: 299.99,
        imageUrl: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=400&fit=crop",
        category: "Electronics",
        stock: 30,
      },
    }),
    prisma.product.create({
      data: {
        name: "Organic Cotton T-Shirt",
        description: "Comfortable and sustainable cotton t-shirt available in multiple colors and sizes.",
        price: 29.99,
        imageUrl: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=400&fit=crop",
        category: "Clothing",
        stock: 100,
      },
    }),
    prisma.product.create({
      data: {
        name: "Stainless Steel Water Bottle",
        description: "Insulated water bottle that keeps drinks cold for 24 hours or hot for 12 hours.",
        price: 24.99,
        imageUrl: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=400&h=400&fit=crop",
        category: "Home & Garden",
        stock: 75,
      },
    }),
    prisma.product.create({
      data: {
        name: "Wireless Charging Pad",
        description: "Fast wireless charging pad compatible with all Qi-enabled devices.",
        price: 39.99,
        imageUrl: "https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=400&h=400&fit=crop",
        category: "Electronics",
        stock: 40,
      },
    }),
    prisma.product.create({
      data: {
        name: "Leather Wallet",
        description: "Handcrafted genuine leather wallet with RFID protection and multiple card slots.",
        price: 49.99,
        imageUrl: "https://images.unsplash.com/photo-1627123424574-724758594e93?w=400&h=400&fit=crop",
        category: "Accessories",
        stock: 60,
      },
    }),
  ]);

  // Create a sample user with hashed password
  const hashedPassword = await bcrypt.hash("password123", 10);
  
  await prisma.user.create({
    data: {
      email: "demo@example.com",
      name: "Demo User",
      password: hashedPassword,
    },
  });

  console.log("Database seeded successfully!");
  console.log(`Created ${products.length} products and 1 user`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 