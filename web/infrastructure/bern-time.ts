"use client";

import { useEffect, useState } from "react";

const timeFormat = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "Europe/Zurich",
});

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "Europe/Zurich",
});

const shortDateFormat = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "Europe/Zurich",
});

export function formatBernTime(date: Date): string {
  return timeFormat.format(date);
}

export function formatBernDate(date: Date): string {
  return dateFormat.format(date).replace(",", "");
}

export function formatBernShortDate(date: Date): string {
  return shortDateFormat.format(date).replace(",", "");
}

// Null until mounted: the server and the first client render agree, then the clock ticks on each
// minute boundary.
export function useNow(): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const date = new Date();
      setNow(date);
      timer = setTimeout(tick, 60_000 - (date.getTime() % 60_000));
    };
    tick();
    return () => clearTimeout(timer);
  }, []);
  return now;
}
