import { RefreshCw, Phone, Shield, History, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

interface HeaderProps {
  onRefresh: () => void;
  onMakeCall: () => void;
}

const Header = ({ onRefresh, onMakeCall }: HeaderProps) => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <header className="flex items-center justify-between py-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="relative">
          <Shield className="w-10 h-10 text-primary" />
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-success rounded-full animate-pulse" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            CallGuard-Sentinel
          </h1>
          <p className="text-sm text-muted-foreground">
            Real-time call protection
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {user && (
          <>
            <Button variant="outline" onClick={() => navigate("/history")} className="gap-2">
              <History className="w-4 h-4" />
              <span className="hidden sm:inline">History</span>
            </Button>
            <Button variant="outline" onClick={onRefresh} className="gap-2">
              <RefreshCw className="w-4 h-4" />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button variant="danger" onClick={onMakeCall} className="gap-2">
              <Phone className="w-4 h-4" />
              Make Call
            </Button>
            <Button variant="ghost" size="icon" onClick={handleSignOut} title="Sign Out">
              <LogOut className="w-4 h-4" />
            </Button>
          </>
        )}
        {!user && (
          <Button variant="danger" onClick={() => navigate("/auth")}>
            Sign In
          </Button>
        )}
      </div>
    </header>
  );
};

export default Header;
