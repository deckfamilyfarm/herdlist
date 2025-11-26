import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function Landing() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await apiRequest("POST", "/api/auth/login", { email, password });

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
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                data-testid="input-email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                data-testid="input-password"
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={isLoading}
              data-testid="button-login"
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          <div className="mt-6 space-y-2 text-sm text-muted-foreground">
            <p className="font-medium">Features:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Animal breeding and parentage tracking</li>
              <li>Location tracking across properties</li>
              <li>Vaccination and health records</li>
              <li>Movement history</li>
              <li>Calving and slaughter data</li>
            </ul>
          </div>

          <div className="mt-6 space-y-2 text-xs text-center text-muted-foreground">
            <p>Default accounts for testing:</p>
            <p>Admin: jdeck88@gmail.com / admin123</p>
            <p>User: deckfamilyfarm@gmail.com / user123</p>
            <p className="text-destructive">⚠️ Change passwords after first login</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
