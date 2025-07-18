import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
} from "@remix-run/react";
import type { LinksFunction, LoaderFunctionArgs } from "@remix-run/node";

import "./tailwind.css";
import { Header } from "./components/Header";
import { getUser } from "./lib/session.server";
import { getCartItems } from "./lib/cart.server";

export const links: LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getUser(request);
  const cartItems = user ? await getCartItems(user.id) : [];
  
  return {
    user,
    cartItemCount: cartItems.length,
  };
}

export default function App() {
  const { user, cartItemCount } = useLoaderData<typeof loader>();
  
  return (
    <div className="min-h-screen bg-gray-50">
      <Header user={user} cartItemCount={cartItemCount} />
      <main>
        <Outlet />
      </main>
    </div>
  );
}
