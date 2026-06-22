import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const REMOTE_TIMESHEETS_URL = (import.meta.env.VITE_TIMESHEETS_URL || "https://timesheets.deckfamilyfarm.com").replace(/\/+$/, "");
const LOCAL_TIMESHEETS_URL = (import.meta.env.VITE_LOCAL_TIMESHEETS_URL || "http://localhost:3000").replace(/\/+$/, "");

function getTimesheetsLoginUrl(username: string) {
  const isLocal =
    typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
  const baseUrl = isLocal ? LOCAL_TIMESHEETS_URL : REMOTE_TIMESHEETS_URL;
  const returnTo =
    typeof window === "undefined"
      ? "/"
      : `${window.location.pathname || "/"}${window.location.search || ""}${window.location.hash || ""}`;
  const url = new URL("/", baseUrl);
  url.searchParams.set("launch_app", "herdlist");
  url.searchParams.set("return_to", returnTo.startsWith("/") ? returnTo : "/");
  url.searchParams.set("username", username);
  url.searchParams.set("auth_hint", "passkey");
  url.searchParams.set("launch_nonce", String(Date.now()));
  return url.toString();
}

export default function Landing() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isPasskeyRedirecting, setIsPasskeyRedirecting] = useState(false);
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await apiRequest("POST", "/api/auth/login", { username, password });

      // Login successful, reload to trigger app to recognize auth state
      window.location.href = "/";
    } catch (error: any) {
      toast({
        title: "Login Failed",
        description: error.message || "Invalid email or password",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasskeyLogin = () => {
    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      toast({
        title: "Username Required",
        description: "Enter your Timesheets username before using a passkey.",
        variant: "destructive",
      });
      return;
    }

    setIsPasskeyRedirecting(true);
    window.location.assign(getTimesheetsLoginUrl(trimmedUsername));
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2">
          <CardTitle className="text-2xl text-center">Herd Management System</CardTitle>
          <CardDescription className="text-center">
            Comprehensive livestock management for dairy and beef cattle operations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Timesheets Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="your.username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={isLoading || isPasskeyRedirecting}
                autoComplete="username"
                data-testid="input-username"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="********"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading || isPasskeyRedirecting}
                autoComplete="current-password"
                data-testid="input-password"
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={isLoading || isPasskeyRedirecting}
              data-testid="button-login"
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>
            <Button
              type="button"
              className="w-full"
              size="lg"
              variant="outline"
              disabled={isLoading || isPasskeyRedirecting}
              onClick={handlePasskeyLogin}
              data-testid="button-passkey-login"
            >
              {isPasskeyRedirecting ? "Opening Timesheets..." : "Sign in with Timesheets passkey"}
            </Button>
          </form>

          <div className="mt-6 text-sm text-muted-foreground">
            <p>
              Please use your Timesheets login to gain access to the Herd
              Management System.
            </p>
          </div>

        </CardContent>
      </Card>
    </div>
  );
}
