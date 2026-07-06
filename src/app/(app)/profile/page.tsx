import { requireDbUser } from "@/lib/auth";
import { ProfileForm } from "@/components/profile/profile-form";

export default async function ProfilePage() {
  const user = await requireDbUser();

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage how you appear to your roommates.</p>
      </div>

      <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
        <ProfileForm
          name={user.name}
          email={user.email}
          avatarUrl={user.avatarUrl}
        />
      </div>
    </div>
  );
}
