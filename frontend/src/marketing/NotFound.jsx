import { Link } from "react-router-dom";
import Logo from "../shared/components/Logo";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-charcoal text-center">
      <Logo />
      <p className="font-display text-3xl text-cream">Page not found</p>
      <Link to="/" className="text-saffron hover:text-saffron-dark">
        Back to home
      </Link>
    </div>
  );
}