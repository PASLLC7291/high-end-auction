"use client"

import { useEffect, useState } from "react"
import { Clock } from "lucide-react"

interface AuctionCountdownProps {
  closesAt: Date
  status: "live" | "upcoming" | "closed"
}

export function AuctionProgressBar({ closesAt, status }: AuctionCountdownProps) {
  const [progress, setProgress] = useState<number>(0)
  const [timeLeft, setTimeLeft] = useState<string>("")

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date().getTime()
      const distance = closesAt.getTime() - now

      if (distance < 0) {
        return "Closed"
      }

      const days = Math.floor(distance / (1000 * 60 * 60 * 24))
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((distance % (1000 * 60)) / 1000)

      if (days > 0) {
        return `${days}d ${hours}h`
      } else if (hours > 0) {
        return `${hours}h ${minutes}m`
      } else if (minutes > 0) {
        return `${minutes}m ${seconds}s`
      } else {
        return `${seconds}s`
      }
    }

    const calculateProgress = () => {
      const now = new Date().getTime()
      const distance = closesAt.getTime() - now

      // Calculate total auction duration (24 hours for live, 7 days for upcoming)
      const totalDuration = status === "live" ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000
      const elapsed = totalDuration - distance
      const progressPercentage = Math.min(Math.max((elapsed / totalDuration) * 100, 0), 100)

      setProgress(progressPercentage)
    }

    setTimeLeft(calculateTimeLeft())
    calculateProgress()

    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft())
      calculateProgress()
    }, 1000)

    return () => clearInterval(timer)
  }, [closesAt, status])

  if (status === "closed") {
    return null
  }

  const getStatusText = () => {
    if (status === "live") {
      return "Closing in"
    }
    return "Opens in"
  }

  return (
    <div className="relative">
      <div className="flex items-center justify-between bg-muted/30 px-4 py-2.5">
        <div className="flex items-center gap-2 text-xs">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-medium text-muted-foreground">{getStatusText()}</span>
        </div>
        <span className="font-mono text-xs font-medium text-foreground">{timeLeft}</span>
      </div>
      <div className="relative h-1 w-full overflow-hidden bg-muted">
        <div
          className="h-full bg-foreground transition-all duration-1000 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}
