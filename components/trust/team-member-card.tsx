/**
 * TeamMemberCard - Display team member/specialist with credentials
 */

import { Mail, Phone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

export interface TeamMember {
  name: string;
  title: string;
  department?: string;
  image?: string;
  bio?: string;
  credentials?: string[];
  email?: string;
  phone?: string;
}

interface TeamMemberCardProps {
  member: TeamMember;
  variant?: "compact" | "full";
  showContact?: boolean;
  className?: string;
}

export function TeamMemberCard({
  member,
  variant = "full",
  showContact = true,
  className,
}: TeamMemberCardProps) {
  const initials = member.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  if (variant === "compact") {
    return (
      <div className={`flex items-center gap-4 ${className ?? ""}`}>
        <Avatar className="h-12 w-12">
          <AvatarImage src={member.image} alt={member.name} />
          <AvatarFallback className="bg-primary/10 text-primary font-medium">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="font-medium text-foreground">{member.name}</p>
          <p className="text-sm text-muted-foreground">{member.title}</p>
        </div>
      </div>
    );
  }

  return (
    <Card className={`border-border/50 overflow-hidden ${className ?? ""}`}>
      <div className="aspect-[4/5] bg-muted">
        {member.image ? (
          <img
            src={member.image}
            alt={member.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Avatar className="h-24 w-24">
              <AvatarFallback className="bg-primary/10 text-primary text-3xl font-medium">
                {initials}
              </AvatarFallback>
            </Avatar>
          </div>
        )}
      </div>
      <CardContent className="p-5">
        <h3 className="font-serif text-lg font-medium text-foreground">
          {member.name}
        </h3>
        <p className="text-sm text-primary">{member.title}</p>
        {member.department && (
          <p className="text-sm text-muted-foreground">{member.department}</p>
        )}

        {member.credentials && member.credentials.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {member.credentials.map((credential, index) => (
              <span
                key={index}
                className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
              >
                {credential}
              </span>
            ))}
          </div>
        )}

        {member.bio && (
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground line-clamp-3">
            {member.bio}
          </p>
        )}

        {showContact && (member.email || member.phone) && (
          <div className="mt-4 flex gap-2">
            {member.email && (
              <Button variant="outline" size="sm" className="flex-1" asChild>
                <a href={`mailto:${member.email}`}>
                  <Mail className="mr-1.5 h-3.5 w-3.5" />
                  Email
                </a>
              </Button>
            )}
            {member.phone && (
              <Button variant="outline" size="sm" className="flex-1" asChild>
                <a href={`tel:${member.phone}`}>
                  <Phone className="mr-1.5 h-3.5 w-3.5" />
                  Call
                </a>
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface TeamGridProps {
  members: TeamMember[];
  columns?: 2 | 3 | 4;
  showContact?: boolean;
  className?: string;
}

export function TeamGrid({
  members,
  columns = 4,
  showContact = true,
  className,
}: TeamGridProps) {
  const gridCols = {
    2: "md:grid-cols-2",
    3: "md:grid-cols-2 lg:grid-cols-3",
    4: "md:grid-cols-2 lg:grid-cols-4",
  }[columns];

  return (
    <div className={`grid gap-6 ${gridCols} ${className ?? ""}`}>
      {members.map((member, index) => (
        <TeamMemberCard key={index} member={member} showContact={showContact} />
      ))}
    </div>
  );
}
