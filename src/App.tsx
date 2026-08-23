import { Route, Routes, Link } from "react-router-dom";
import Home from "./pages/Home";
import ProductDetail from "./pages/ProductDetail";
import Cart from "./pages/Cart";
import Navbar from "./components/Navbar";

function App() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-blue-100 selection:text-blue-900 dark:selection:bg-blue-950 dark:selection:text-blue-200 transition-colors">
      <Navbar />
      <main className="py-6 sm:py-8">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/product/:id" element={<ProductDetail />} />
          <Route path="/cart" element={<Cart />} />
          <Route
            path="*"
            element={
              <div className="max-w-md mx-auto text-center py-20 px-4">
                <h1 className="text-4xl font-bold text-blue-600 mb-2">404</h1>
                <p className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-1">
                  Page Not Found
                </p>
                <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
                  The page you are looking for doesn't exist or has been moved.
                </p>
                <Link
                  to="/"
                  className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Return Home
                </Link>
              </div>
            }
          />
        </Routes>
      </main>
    </div>
  );
}

export default App;
