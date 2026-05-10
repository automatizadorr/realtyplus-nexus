import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronUp, ChevronDown, X } from "lucide-react";

interface Props {
  query: string;
  onQueryChange: (q: string) => void;
  matches: number;
  current: number;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
}

export function ChatSearchBar({ query, onQueryChange, matches, current, onPrev, onNext, onClose }: Props) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/40">
      <Input
        autoFocus
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="Buscar en la conversación..."
        className="h-8 text-sm"
      />
      <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
        {matches > 0 ? `${current + 1} / ${matches}` : query ? "0" : ""}
      </span>
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onPrev} disabled={matches === 0}>
        <ChevronUp className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onNext} disabled={matches === 0}>
        <ChevronDown className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
