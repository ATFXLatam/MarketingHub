"use client";

import { DatePicker } from "@/components/arc/date-picker/date-picker";
import { Input } from "@/components/arc/input/input";
import { RadioGroup } from "@/components/arc/radio-group/radio-group";
import { Select } from "@/components/arc/select/select";
import type { Area } from "@/lib/board-config";
import { COPY_READY, DETAIL_LABEL, detailKeysFor, VIDEO_FORMATS, type DetailKey, type Details } from "@/lib/requirements";

const toIsoDate = (date?: Date) =>
  date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}` : "";

const COPY_QUESTION: Partial<Record<Area, string>> = { video: "Is the script ready?" };

export interface RequirementFieldsProps {
  area: Area;
  details: Details;
  errors: Record<string, string>;
  onChange: (key: DetailKey, value: string) => void;
}

/** The fields only this area needs, in the order they weigh on the score. */
export function RequirementFields({ area, details, errors, onChange }: RequirementFieldsProps) {
  return (
    <>
      {detailKeysFor(area).map((key) => {
        const value = details[key] ?? "";
        switch (key) {
          case "url":
            return <Input key={key} id={key} label={DETAIL_LABEL[key]} type="url" inputMode="url" placeholder="https://atfx.com/..." value={value} onChange={(event) => onChange(key, event.target.value)} error={errors[key]} />;
          case "cta":
            return <Input key={key} id={key} label={DETAIL_LABEL[key]} placeholder="Open an account, Sign up for the webinar" value={value} onChange={(event) => onChange(key, event.target.value)} maxLength={120} />;
          case "format":
            return <Select key={key} id={key} label={DETAIL_LABEL[key]} placeholder="Choose one" options={VIDEO_FORMATS.map((format) => ({ value: format, label: format }))} value={value} onValueChange={(next) => onChange(key, next)} />;
          case "duration":
          case "attendees":
            return <Input key={key} id={key} label={DETAIL_LABEL[key]} inputMode="numeric" placeholder={key === "duration" ? "30" : "120"} value={value} onChange={(event) => onChange(key, event.target.value)} error={errors[key]} />;
          case "copyReady":
            return (
              <div key={key} id={key} tabIndex={-1}>
                <RadioGroup
                  label={COPY_QUESTION[area] ?? "Is the final copy ready?"}
                  name={key}
                  value={value}
                  onValueChange={(next) => onChange(key, next)}
                  options={[
                    { value: COPY_READY, label: "Yes, it is ready", description: "The team starts without waiting for text" },
                    { value: "no", label: "Not yet", description: "It gets written or approved before production" },
                  ]}
                />
              </div>
            );
          case "eventDate":
            return (
              <div key={key} id={key} tabIndex={-1}>
                <DatePicker label={DETAIL_LABEL[key]} locale="en-US" placeholder="Choose a date" value={value ? new Date(`${value}T00:00:00`) : undefined} onChange={(date) => onChange(key, toIsoDate(date))} />
              </div>
            );
          default:
            return <Input key={key} id={key} label={DETAIL_LABEL[key]} value={value} onChange={(event) => onChange(key, event.target.value)} maxLength={300} />;
        }
      })}
    </>
  );
}
