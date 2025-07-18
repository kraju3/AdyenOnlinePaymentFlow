# ShopDrop - Modern Checkout Experience

A modern e-commerce checkout experience built with Remix, featuring a complete shopping flow from product browsing to order confirmation.

## Features

- 🛍️ **Product Catalog**: Browse products with modern card layouts
- 🛒 **Shopping Cart**: Add, remove, and update cart items
- 💳 **Checkout Process**: Complete checkout with shipping and payment forms
- 🔐 **User Authentication**: Secure login/logout functionality
- 📱 **Responsive Design**: Mobile-first design with Tailwind CSS
- 🗄️ **Database**: SQLite with Prisma ORM
- 🎨 **Modern UI**: Clean, sleek design with smooth animations

## Tech Stack

- **Framework**: Remix (React-based full-stack framework)
- **Styling**: Tailwind CSS
- **Database**: SQLite with Prisma ORM
- **Authentication**: Session-based with bcrypt
- **Icons**: Lucide React
- **TypeScript**: Full type safety

## Getting Started

### Prerequisites

- Node.js 20+ 
- npm or yarn

### Installation

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment variables**:
   Create a `.env` file in the root directory with:
   ```env
   SESSION_SECRET="your-super-secret-session-key-change-this-in-production"
   ADYEN_API_KEY="your-adyen-api-key"
   ADYEN_ENVIRONMENT="TEST"
   ADYEN_MERCHANT_ACCOUNT="your-merchant-account"
   ```
   
   **Important**: You must create this file before running the database commands!

3. **Set up the database**:
   ```bash
   # Generate Prisma client
   npm run db:generate
   
   # Push schema to database
   npm run db:push
   
   # Seed the database with sample data
   npm run db:seed
   ```

4. **Start the development server**:
   ```bash
   npm run dev
   ```

5. **Open your browser**:
   Navigate to `http://localhost:5173`

## Demo Credentials

Use these credentials to test the application:
- **Email**: `demo@example.com`
- **Password**: `password123`

## Project Structure

```
dropin/
├── app/
│   ├── components/          # Reusable UI components
│   │   ├── Header.tsx      # Navigation header
│   │   └── ProductCard.tsx # Product display card
│   ├── lib/                # Utility functions
│   │   ├── db.server.ts    # Database connection
│   │   ├── session.server.ts # Authentication utilities
│   │   └── cart.server.ts  # Cart management
│   ├── routes/             # Remix routes
│   │   ├── _index.tsx      # Home page
│   │   ├── login.tsx       # Login page
│   │   ├── logout.tsx      # Logout handler
│   │   ├── cart.tsx        # Shopping cart
│   │   ├── checkout.tsx    # Checkout process
│   │   ├── checkout.success.tsx # Order confirmation
│   │   └── products.$productId.tsx # Product details
│   └── root.tsx            # Root layout
├── prisma/
│   ├── schema.prisma       # Database schema
│   └── seed.ts            # Database seeder
└── package.json
```

## Database Schema

The application uses the following database models:

- **User**: User accounts and authentication
- **Product**: Product catalog with images and pricing
- **CartItem**: Shopping cart items
- **Order**: Customer orders
- **OrderItem**: Individual items in orders

## Key Features Explained

### 1. Product Browsing
- Responsive product grid with modern cards
- Product categories and filtering
- Add to cart functionality with quantity selection

### 2. Shopping Cart
- Real-time cart updates
- Quantity controls with stock validation
- Remove items functionality
- Order summary with tax calculation

### 3. Checkout Process
- Multi-step checkout form
- Shipping information collection
- Payment form (demo only)
- Order confirmation and success page

### 4. Authentication
- Session-based authentication
- Protected routes
- Login/logout functionality
- Redirect handling

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run db:generate` - Generate Prisma client
- `npm run db:push` - Push schema changes
- `npm run db:seed` - Seed database with sample data
- `npm run lint` - Run ESLint
- `npm run typecheck` - Run TypeScript checks

### Adding New Features

1. **New Routes**: Create files in `app/routes/`
2. **Components**: Add reusable components in `app/components/`
3. **Database Changes**: Update `prisma/schema.prisma` and run migrations
4. **Styling**: Use Tailwind CSS classes for consistent design

## Deployment

1. Build the application:
   ```bash
   npm run build
   ```

2. Set production environment variables
3. Deploy the `build/` directory to your hosting platform

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is open source and available under the [MIT License](LICENSE).

## Support

For questions or issues, please open an issue on GitHub.
