import { Link } from "react-router-dom";
import { useAccount } from "wagmi";
import logo from "@/assets/logo.svg";
import { Shield } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { WalletButton } from "./WalletButton";

const Header = () => {
  const { isConnected } = useAccount();

  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <img src={logo} alt="Secret Vote Box Logo" className="h-10 w-10" />
            <div>
              <h1 className="text-xl font-bold text-foreground">Community Voting。</h1>
              <p className="text-sm text-muted-foreground">Community Change Suggestions</p>
            </div>
          </Link>
          
          <div className="flex items-center gap-6">
            <nav className="hidden md:flex items-center gap-6">
              <NavLink 
                to="/" 
                className="text-foreground/70 hover:text-foreground transition-colors"
                activeClassName="text-foreground font-semibold"
              >
                All Polls
              </NavLink>
              {isConnected && (
                <>
                  <NavLink 
                    to="/create-poll"
                    className="text-foreground/70 hover:text-foreground transition-colors"
                    activeClassName="text-foreground font-semibold"
                  >
                    Create Poll
                  </NavLink>
                  <NavLink 
                    to="/my-votes"
                    className="text-foreground/70 hover:text-foreground transition-colors"
                    activeClassName="text-foreground font-semibold"
                  >
                    My Votes
                  </NavLink>
                </>
              )}
            </nav>

            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <WalletButton />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
