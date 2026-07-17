import { cn, formatStripeAmount } from "@/lib/utils"

interface OrderAmountProps {
  amount: number
  refundedAmount: number
  currency: string
  /** When true, stack original above net (list rows). Default stacks. */
  className?: string
  netClassName?: string
  originalClassName?: string
}

/**
 * Shows the order total. When refunded, shows the original muted/strikethrough
 * and the net amount kept (not the refund amount).
 */
export function OrderAmount({
  amount,
  refundedAmount,
  currency,
  className,
  netClassName,
  originalClassName,
}: OrderAmountProps) {
  if (refundedAmount <= 0) {
    return (
      <span className={className}>{formatStripeAmount(amount, currency)}</span>
    )
  }

  const net = Math.max(0, amount - refundedAmount)

  return (
    <span className={cn("inline-flex flex-col items-start gap-0.5", className)}>
      <span
        className={cn(
          "text-xs font-normal text-muted-foreground line-through",
          originalClassName
        )}
      >
        {formatStripeAmount(amount, currency)}
      </span>
      <span className={cn("font-medium", netClassName)}>
        {formatStripeAmount(net, currency)}
      </span>
    </span>
  )
}
