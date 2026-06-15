import { useId } from "react"
import { cn } from "@/lib/utils"

type FilledStarProps = React.ComponentPropsWithoutRef<"svg">

export function FilledStar({ className, ...props }: FilledStarProps) {
  const id = useId()
  const gradId = `star-grad-${id.replaceAll(":", "")}`

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={cn("size-4", className)}
      {...props}
    >
      <defs>
        {/*
         * SVG gradients always interpolate in sRGB, which produces a dull/grey
         * midpoint. Simulate the oklch path by adding explicit stops at the
         * 25%, 50%, 75% hue positions between primary-500 (h≈209°) and
         * secondary-500 (h≈339°), keeping L and C linearly interpolated too.
         * Each stop is expressed in oklch() so the browser renders the correct
         * vivid colour at that sample point.
         */}
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   style={{ stopColor: "var(--primary-500)" }} />
          <stop offset="33%"  style={{ stopColor: "oklch(67.7% 0.131 242)" }} />
          <stop offset="66%"  style={{ stopColor: "oklch(66.9% 0.162 307)" }} />
          <stop offset="100%" style={{ stopColor: "var(--secondary-500)" }} />
        </linearGradient>
      </defs>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M10.6772 2.9544C11.3321 1.68187 13.1679 1.68187 13.8228 2.9544L16.0293 7.24233C16.0659 7.31348 16.1347 7.363 16.2143 7.37556L21.0106 8.13205C22.4332 8.35643 23.0001 10.0828 21.9828 11.093L18.5492 14.5025C18.4923 14.559 18.4661 14.6389 18.4787 14.7177L19.2355 19.4762C19.4598 20.8865 17.9749 21.9539 16.6905 21.3059L12.3645 19.1234C12.2926 19.0871 12.2074 19.0871 12.1355 19.1234L7.80953 21.3059C6.52505 21.9539 5.04024 20.8865 5.26453 19.4762L6.02134 14.7177C6.03387 14.6389 6.00766 14.559 5.95079 14.5025L2.51718 11.093C1.49993 10.0828 2.06681 8.35643 3.48941 8.13205L8.28567 7.37556C8.3653 7.363 8.43407 7.31348 8.47069 7.24233L10.6772 2.9544Z"
        fill={`url(#${gradId})`}
      />
    </svg>
  )
}
