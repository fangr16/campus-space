import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { fetchSettings } from "./api";
import { parseFormSettings, type ReservationFormSettings } from "./reservation.model";
import {
  horizonRange,
  readWindow,
  type TimeWindow,
  windowRange,
  writeWindow,
} from "./time-window.model";

export type ViewMode = "map" | "list";

const NOW_REFRESH_MS = 60_000;

export interface TimeWindowState {
  settings: ReservationFormSettings;
  now: Date;
  window: TimeWindow;
  /** The first slot from the start: "is this seat free right then". */
  slotRange: { from: string; to: string };
  /** The longest reservation possible from the start: what the floor plan asks about. */
  horizon: { from: string; to: string };
  setWindow: (next: TimeWindow) => void;
  view: ViewMode;
  setView: (view: ViewMode) => void;
}

/**
 * The start the student is looking at, kept in the URL (`date`, `start`, `view`) so the room
 * list and the floor plan share it and a link reproduces the view. The duration is chosen per
 * seat afterwards. Settings come from the module; until they load the defaults apply.
 */
export function useTimeWindow(): TimeWindowState {
  const [params, setParams] = useSearchParams();
  const settingsQuery = useQuery({ queryKey: ["m1", "settings"], queryFn: fetchSettings });
  const settings = useMemo(() => parseFormSettings(settingsQuery.data ?? []), [settingsQuery.data]);
  // "now" moves once a minute and when the tab comes back, so a page left open does not keep
  // offering a start that has already passed; it is otherwise stable to keep options steady.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const refresh = () => setNow(new Date());
    const timer = globalThis.setInterval(refresh, NOW_REFRESH_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      globalThis.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  const window = useMemo(() => readWindow(params, settings, now), [params, settings, now]);
  const slotRange = useMemo(() => windowRange(window, settings, 1), [window, settings]);
  const horizon = useMemo(() => horizonRange(window, settings), [window, settings]);

  const setWindow = useCallback(
    (next: TimeWindow) => {
      setParams((prev) => writeWindow(prev, next), { replace: true });
    },
    [setParams],
  );
  const view: ViewMode = params.get("view") === "list" ? "list" : "map";
  const setView = useCallback(
    (mode: ViewMode) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (mode === "list") next.set("view", "list");
          else next.delete("view");
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  return { settings, now, window, slotRange, horizon, setWindow, view, setView };
}
