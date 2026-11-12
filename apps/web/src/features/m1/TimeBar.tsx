import { Segmented, Select } from "antd";
import {
  dayOptions,
  minutesToClock,
  type ReservationFormSettings,
  startOptions,
} from "./reservation.model";
import {
  ANY_HOURS,
  clampToRoom,
  describeDay,
  type OpeningHours,
  type TimeWindow,
} from "./time-window.model";

interface TimeBarProps {
  window: TimeWindow;
  onChange: (next: TimeWindow) => void;
  settings: ReservationFormSettings;
  now: Date;
  /** The room whose opening hours bound the options; omitted on the room list. */
  room?: OpeningHours;
}

/**
 * Time-first entry point (REQ-M1-11): day chips and a start time. Only legal values are
 * offered and every change is clamped to what the room can give. The duration is chosen
 * per seat in the selection card, because it depends on how long that seat stays free.
 */
export function TimeBar({ window, onChange, settings, now, room }: TimeBarProps) {
  const hours = room ?? ANY_HOURS;
  const days = dayOptions(now, settings.timezone);
  const starts = startOptions(window.day, hours, settings, now);
  const change = (patch: Partial<TimeWindow>) =>
    onChange(clampToRoom({ ...window, ...patch }, hours, settings, now));

  return (
    <fieldset className="time-bar" aria-label="预约时段">
      <Segmented<string>
        className="time-bar__days"
        value={window.day}
        onChange={(day) => change({ day })}
        options={days.map((day) => ({
          value: day,
          label: describeDay(day, now, settings.timezone),
        }))}
        aria-label="日期"
      />
      <div className="time-bar__field">
        <span aria-hidden="true">从</span>
        <Select<number>
          value={starts.includes(window.start) ? window.start : undefined}
          onChange={(start) => change({ start })}
          options={starts.map((m) => ({ value: m, label: minutesToClock(m) }))}
          placeholder={starts.length === 0 ? "今天已无可约时段" : "选择"}
          aria-label="开始时间"
          popupMatchSelectWidth={false}
        />
        <span aria-hidden="true">开始</span>
      </div>
    </fieldset>
  );
}
