import { cn } from "@/lib/utils";

// Soft tints that read well on both the light and the dark surfaces.
const TINTS = [
  "bg-sky-500/15 text-sky-800 dark:text-sky-300",
  "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300",
  "bg-amber-500/15 text-amber-800 dark:text-amber-300",
  "bg-rose-500/15 text-rose-800 dark:text-rose-300",
  "bg-violet-500/15 text-violet-800 dark:text-violet-300",
  "bg-cyan-500/15 text-cyan-800 dark:text-cyan-300",
];

const SIZES = {
  sm: "size-8 text-xs",
  lg: "size-12 text-base",
} as const;

function initialsOf(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0]?.[0] ?? "";
  const last = words.length > 1 ? (words.at(-1)?.[0] ?? "") : "";
  return (first + last).toUpperCase() || "?";
}

/** The same name always gets the same tint. */
function tintOf(name: string) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return TINTS[hash % TINTS.length];
}

type CustomerAvatarProps = {
  name: string;
  size?: keyof typeof SIZES;
  className?: string;
};

/**
 * A customer's initials on a tinted circle. Decorative: it always sits next
 * to the customer's name, so it is hidden from assistive technology.
 */
export function CustomerAvatar({ name, size = "sm", className }: CustomerAvatarProps) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold select-none",
        SIZES[size],
        tintOf(name),
        className,
      )}
    >
      {initialsOf(name)}
    </span>
  );
}
