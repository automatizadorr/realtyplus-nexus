import { FileText, Music, Download } from "lucide-react";

interface Props {
  url: string;
  type?: string | null;
}

export function MediaBubble({ url, type }: Props) {
  const t = (type || "").toLowerCase();
  const isImage = t.startsWith("image/") || /\.(jpe?g|png|gif|webp)$/i.test(url);
  const isAudio = t.startsWith("audio/") || /\.(mp3|ogg|wav|m4a)$/i.test(url);
  const isPdf = t === "application/pdf" || /\.pdf$/i.test(url);
  const filename = decodeURIComponent(url.split("/").pop()?.split("?")[0] || "archivo");

  if (isImage) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="block">
        <img src={url} alt="adjunto" className="rounded-lg max-w-full max-h-64 object-cover" />
      </a>
    );
  }
  if (isAudio) {
    return (
      <div className="flex items-center gap-2">
        <Music className="h-4 w-4 shrink-0" />
        <audio controls src={url} className="max-w-[220px]" />
      </div>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-2 text-xs underline underline-offset-2"
    >
      {isPdf ? <FileText className="h-4 w-4" /> : <Download className="h-4 w-4" />}
      <span className="truncate max-w-[200px]">{filename}</span>
    </a>
  );
}
