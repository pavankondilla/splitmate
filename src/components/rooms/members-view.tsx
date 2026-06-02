import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
  joinedAt: Date;
}

interface MembersViewProps {
  members: Member[];
  currentUserId: string;
}

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

export function MembersView({ members, currentUserId }: MembersViewProps) {
  return (
    <div className="space-y-2">
      {members.map((m) => (
        <div key={m.id} className="flex items-center gap-3 py-3 px-4 bg-white rounded-lg border border-gray-200">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="text-sm bg-indigo-100 text-indigo-700">
              {initials(m.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900 text-sm">{m.name}</span>
              {m.id === currentUserId && <span className="text-xs text-gray-400">(you)</span>}
            </div>
            <p className="text-xs text-gray-500 truncate">{m.email}</p>
          </div>
          <Badge variant={m.role === "admin" ? "default" : "secondary"} className={m.role === "admin" ? "bg-indigo-600 text-white" : ""}>
            {m.role}
          </Badge>
        </div>
      ))}
    </div>
  );
}
