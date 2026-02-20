"use client";

import Image from "next/image";
import Link from "next/link";
import { Newspaper, Settings, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Edition {
  id: number;
  generatedAt: string;
}

interface GazetteHeaderProps {
  pastEditions?: Edition[];
}

export function GazetteHeader({ pastEditions = [] }: GazetteHeaderProps) {
  return (
    <header className="sticky top-0 z-50 flex items-center justify-between px-4 py-3 bg-background/80 backdrop-blur-sm border-b border-border">
      <Link href="/gazette" className="flex items-center">
        <Image
          src="/briefflow-logo.svg"
          alt="briefflow"
          width={65}
          height={18}
          priority
        />
      </Link>

      <nav className="flex items-center gap-1">
        {/* Editions dropdown */}
        {pastEditions.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground gap-1.5 text-sm">
                <Newspaper className="h-4 w-4" />
                <span className="hidden sm:inline">Editions</span>
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {pastEditions.slice(0, 10).map((edition) => (
                <DropdownMenuItem key={edition.id} asChild>
                  <Link href={`/gazette/${edition.id}`}>
                    {new Date(edition.generatedAt).toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Settings link */}
        <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground gap-1.5 text-sm">
          <Link href="/settings">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Settings</span>
          </Link>
        </Button>
      </nav>
    </header>
  );
}
