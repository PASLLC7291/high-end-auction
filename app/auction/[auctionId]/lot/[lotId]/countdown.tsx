"use client";

import { useEffect, useState, useRef } from "react";
import { Clock } from "lucide-react";
import { SaleItemDataType } from "./page";

/**
 * Animated indicator that morphs between a dot and a plus sign
 */
const MorphingIndicator = ({
    isPlus,
    baseColor,
    plusColor = "bg-orange-500",
    size = "default",
}: {
    isPlus: boolean;
    baseColor: string;
    plusColor?: string;
    size?: "sm" | "default";
}) => {
    const dotSize = size === "sm" ? "h-1.5 w-1.5" : "h-2 w-2";
    const plusH = size === "sm" ? "h-0.5 w-2.5" : "h-0.5 w-3";
    const plusV = size === "sm" ? "w-0.5 h-2.5" : "w-0.5 h-3";
    const containerSize = size === "sm" ? "h-1.5 w-1.5" : "h-2 w-2";

    return (
        <div className={`relative ${containerSize} flex items-center justify-center`}>
            {/* Horizontal bar - shrinks to dot size when not plus */}
            <span
                className={`absolute rounded-full transition-all duration-500 ease-out ${
                    isPlus 
                        ? `${plusH} ${plusColor}` 
                        : `${dotSize} ${baseColor}`
                }`}
            />
            {/* Vertical bar - hidden when dot, visible when plus */}
            <span
                className={`absolute rounded-full transition-all duration-500 ease-out ${
                    isPlus 
                        ? `${plusV} ${plusColor}` 
                        : `${dotSize} ${baseColor}`
                }`}
            />
        </div>
    );
};

interface TimeLeft {
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    isExpired: boolean;
    totalHours: number;
}

/**
 * Hook to calculate time remaining until a target date
 * Updates every second and returns formatted time units
 */
function useCountdown(targetDate: string | null): TimeLeft {
    const [timeLeft, setTimeLeft] = useState<TimeLeft>({
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
        isExpired: false,
        totalHours: 0,
    });

    useEffect(() => {
        if (!targetDate) return;

        const calculateTimeLeft = (): TimeLeft => {
            const now = new Date().getTime();
            const target = new Date(targetDate).getTime();
            const difference = target - now;

            if (difference <= 0) {
                return {
                    days: 0,
                    hours: 0,
                    minutes: 0,
                    seconds: 0,
                    isExpired: true,
                    totalHours: 0,
                };
            }

            const days = Math.floor(difference / (1000 * 60 * 60 * 24));
            const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((difference % (1000 * 60)) / 1000);
            const totalHours = Math.floor(difference / (1000 * 60 * 60));

            return {
                days,
                hours,
                minutes,
                seconds,
                isExpired: false,
                totalHours,
            };
        };

        setTimeLeft(calculateTimeLeft());
        const timer = setInterval(() => {
            setTimeLeft(calculateTimeLeft());
        }, 1000);

        return () => clearInterval(timer);
    }, [targetDate]);

    return timeLeft;
}

interface CountdownDisplayProps {
    closingDate: string | null;
    onExpiredChange?: (isExpired: boolean) => void;
    variant?: "compact" | "detailed";
    size?: "sm" | "default";
    status: SaleItemDataType["status"];
    showLabel?: boolean;
}

/**
 * Countdown timer component with urgency indicators
 * Isolated to prevent parent re-renders on every tick
 */
export const CountdownDisplay = ({
    closingDate,
    status,
    onExpiredChange,
    variant = "compact",
    size = "default",
    showLabel = false,
}: CountdownDisplayProps) => {
    const countdown = useCountdown(closingDate);
    const prevClosingDateRef = useRef<string | null>(null);
    const [isTimeExtended, setIsTimeExtended] = useState(false);

    // Notify parent when expired status changes
    useEffect(() => {
        onExpiredChange?.(countdown.isExpired);
    }, [countdown.isExpired, onExpiredChange]);

    // Detect when closing date changes (soft close extension)
    useEffect(() => {
        if (
            prevClosingDateRef.current !== null &&
            closingDate !== null &&
            prevClosingDateRef.current !== closingDate &&
            new Date(closingDate) > new Date(prevClosingDateRef.current)
        ) {
            // Time was extended
            setIsTimeExtended(true);
            const timer = setTimeout(() => setIsTimeExtended(false), 2000);
            return () => clearTimeout(timer);
        }
        prevClosingDateRef.current = closingDate;
    }, [closingDate]);

    // Styling based on status (or expired state)
    const getIndicatorColor = (forceExpired = false) => {
        if (forceExpired || countdown.isExpired) {
            return "bg-foreground/40";
        }
        switch (status) {
            case "ITEM_NOT_OPEN":
                return "bg-blue-500";
            case "ITEM_OPEN":
                return "bg-green-500 animate-pulse";
            case "ITEM_CLOSING":
                return "bg-orange-500 animate-pulse";
            case "ITEM_CLOSED":
                return "bg-foreground/40";
            default:
                return "bg-foreground/40";
        }
    };

    const indicatorColor = getIndicatorColor();

    if (status === "ITEM_CLOSED" || countdown.isExpired) {
        return (
            <div className={`flex items-center gap-1.5 text-left text-muted-foreground ${size === "sm" ? "text-xs" : ""}`}>
                <span className={`rounded-full bg-foreground/40 ${size === "sm" ? "h-1.5 w-1.5" : "h-2 w-2"}`} />
                <span className={size === "sm" ? "font-medium" : "font-semibold"}>Closed</span>
            </div>
        );
    }

    if (variant === "detailed") {
        const isUrgent = status === "ITEM_CLOSING" || status === "ITEM_OPEN";
        return (
            <div
                className={`inline-flex items-center gap-3 rounded-lg border bg-background p-3 transition-all duration-300 ${
                    isTimeExtended
                        ? "border-orange-500 ring-2 ring-orange-500/20"
                        : ""
                }`}
            >
                <MorphingIndicator
                    isPlus={isTimeExtended}
                    baseColor={isUrgent ? "bg-destructive" : "bg-muted-foreground"}
                />
                <div className="flex items-center gap-2">
                    {countdown.days > 0 && (
                        <TimeUnit value={countdown.days} label="day" isUrgent={isUrgent} />
                    )}
                    <TimeUnit value={countdown.hours} label="hr" isUrgent={isUrgent} />
                    <TimeUnit value={countdown.minutes} label="min" isUrgent={isUrgent} />
                    <TimeUnit value={countdown.seconds} label="sec" isUrgent={isUrgent} />
                </div>
                {isTimeExtended && (
                    <span className="text-xs font-medium text-orange-500 animate-in fade-in slide-in-from-left-2 duration-300">
                        Extended
                    </span>
                )}
            </div>
        );
    }

    // Compact variant (default)
    const formatTime = () => {
        if (countdown.days > 0) {
            return `${countdown.days}d ${countdown.hours}h ${countdown.minutes}m`;
        }
        if (countdown.hours > 0) {
            return `${countdown.hours}h ${countdown.minutes}m ${countdown.seconds}s`;
        }
        return `${countdown.minutes}m ${countdown.seconds}s`;
    };

    // Get label text based on status
    const getLabel = () => {
        if (status === "ITEM_NOT_OPEN") return "Opens in";
        if (status === "ITEM_OPEN" || status === "ITEM_CLOSING") return "Closes in";
        return null;
    };

    const label = showLabel ? getLabel() : null;

    return (
        <div className={`flex items-center gap-1.5 font-mono text-left ${size === "sm" ? "text-xs" : ""}`}>
            <MorphingIndicator
                isPlus={isTimeExtended}
                baseColor={indicatorColor}
                size={size}
            />
            {label && (
                <span className={`text-muted-foreground ${size === "sm" ? "font-normal" : ""}`}>
                    {label}
                </span>
            )}
            <span
                className={`transition-all duration-300 ${
                    size === "sm" ? "font-medium" : "font-semibold"
                } ${
                    isTimeExtended
                        ? "text-orange-500 scale-105"
                        : ""
                }`}
            >
                {formatTime()}
            </span>
        </div>
    );
};

/**
 * Time unit display component for detailed variant
 */
const TimeUnit = ({
    value,
    label,
    isUrgent,
}: {
    value: number;
    label: string;
    isUrgent: boolean;
}) => {
    return (
        <div className="flex flex-col items-center">
            <span
                className={`text-2xl font-bold tabular-nums ${isUrgent ? "text-destructive" : ""
                    }`}
            >
                {value.toString().padStart(2, "0")}
            </span>
            <span className="text-xs text-muted-foreground uppercase">
                {label}
                {value !== 1 ? "s" : ""}
            </span>
        </div>
    );
};
