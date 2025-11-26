import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Plus, Shield, Mail } from "lucide-react";
import type { User, EmailWhitelist } from "@shared/schema";

export default function Admin() {
  const { toast } = useToast();
  const [newEmail, setNewEmail] = useState("");

  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
  });

  const { data: whitelist = [], isLoading: whitelistLoading } = useQuery<EmailWhitelist[]>({
    queryKey: ["/api/admin/whitelist"],
  });

  const addEmailMutation = useMutation({
    mutationFn: async (email: string) => {
      await apiRequest("/api/admin/whitelist", "POST", { email });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/whitelist"] });
      setNewEmail("");
      toast({
        title: "Success",
        description: "Email added to whitelist",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const removeEmailMutation = useMutation({
    mutationFn: async (email: string) => {
      await apiRequest(`/api/admin/whitelist/${encodeURIComponent(email)}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/whitelist"] });
      toast({
        title: "Success",
        description: "Email removed from whitelist",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAddEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (newEmail && newEmail.includes("@")) {
      addEmailMutation.mutate(newEmail);
    } else {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Admin Panel</h1>
        <p className="text-muted-foreground mt-2">
          Manage user access and email whitelist
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Email Whitelist
              </CardTitle>
              <CardDescription className="mt-2">
                Only whitelisted emails can access the system
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleAddEmail} className="flex gap-2">
              <Input
                type="email"
                placeholder="email@example.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                data-testid="input-whitelist-email"
              />
              <Button 
                type="submit" 
                size="icon"
                disabled={addEmailMutation.isPending}
                data-testid="button-add-whitelist"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </form>

            {whitelistLoading ? (
              <p className="text-sm text-muted-foreground text-center py-4">Loading...</p>
            ) : whitelist.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No whitelisted emails yet
              </p>
            ) : (
              <div className="space-y-2">
                {whitelist.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between p-2 rounded-md border hover-elevate"
                    data-testid={`whitelist-item-${entry.email}`}
                  >
                    <span className="text-sm">{entry.email}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeEmailMutation.mutate(entry.email)}
                      disabled={removeEmailMutation.isPending}
                      data-testid={`button-remove-${entry.email}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Registered Users
            </CardTitle>
            <CardDescription className="mt-2">
              Users who have logged in to the system
            </CardDescription>
          </CardHeader>
          <CardContent>
            {usersLoading ? (
              <p className="text-sm text-muted-foreground text-center py-4">Loading...</p>
            ) : users.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No users yet</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id} data-testid={`user-row-${user.email}`}>
                      <TableCell className="font-medium">{user.email}</TableCell>
                      <TableCell>
                        {user.isAdmin === "yes" ? (
                          <Badge variant="default" data-testid={`badge-admin-${user.email}`}>
                            Admin
                          </Badge>
                        ) : (
                          <Badge variant="secondary" data-testid={`badge-user-${user.email}`}>
                            User
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            <strong>Email Whitelist:</strong> Add email addresses to allow users to sign in.
            Only whitelisted emails can complete the authentication process.
          </p>
          <p>
            <strong>Admin Status:</strong> To grant admin privileges to a user, you must manually
            update their record in the database:
          </p>
          <pre className="bg-muted p-3 rounded-md text-xs mt-2">
            UPDATE users SET is_admin = 'yes' WHERE email = 'user@example.com';
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
