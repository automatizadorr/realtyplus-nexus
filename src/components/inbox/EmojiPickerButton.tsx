import { useState } from "react";
import { Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import EmojiPicker, { Theme } from "emoji-picker-react";

export function EmojiPickerButton({ onPick, disabled }: { onPick: (emoji: string) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="h-10 w-10 rounded-xl" disabled={disabled}>
          <Smile className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" align="end" className="p-0 border-none w-auto">
        <EmojiPicker
          theme={Theme.AUTO}
          onEmojiClick={(e) => {
            onPick(e.emoji);
            setOpen(false);
          }}
          width={320}
          height={380}
        />
      </PopoverContent>
    </Popover>
  );
}
