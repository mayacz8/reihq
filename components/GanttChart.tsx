"use client";

import { useEffect, useRef } from "react";
// @ts-ignore - frappe-gantt ships no types
import Gantt from "frappe-gantt";
import "@/styles/gantt.css";
import { updateTaskDates } from "@/app/renovations/[id]/actions";

export interface GanttTaskInput {
  id: string;
  name: string;
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
  progress: number;
  dependencies: string; // comma-separated task ids, only ones also present on the chart
  category: string;
  itemType: "task" | "schedule_item"; // 'task' = punch list item, 'schedule_item' = construction/schedule phase
}

const PALETTE = [
  "#2f6b4f", // accent green
  "#b5651d", // clay
  "#3a5a9b", // blue
  "#8a3ab2", // purple
  "#b23a5a", // rose
  "#4a7a8a", // teal
  "#8a7a3a", // olive
  "#7a3a3a", // brick
];

// Punch list tasks always render in this neutral slate color, regardless of
// category, so they read visually distinct from construction/schedule items.
const TASK_COLOR = "#64748b";
const TASK_CLASS = "type-task";

function slug(s: string) {
  return "cat-" + s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export default function GanttChart({ projectId, tasks }: { projectId: string; tasks: GanttTaskInput[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const ganttRef = useRef<any>(null);

  // Category colors only apply to schedule items — punch list tasks get
  // their own fixed color (see TASK_COLOR) so the two kinds of item are
  // visually distinguishable at a glance.
  const categories = Array.from(new Set(tasks.filter((t) => t.itemType === "schedule_item").map((t) => t.category)));
  const colorByCategory = new Map(categories.map((c, i) => [c, PALETTE[i % PALETTE.length]]));

  useEffect(() => {
    if (!containerRef.current || tasks.length === 0) return;
    containerRef.current.innerHTML = "";

    const ganttTasks = tasks.map((t) => ({
      ...t,
      custom_class: t.itemType === "task" ? TASK_CLASS : slug(t.category),
    }));

    ganttRef.current = new Gantt(containerRef.current, ganttTasks, {
      view_mode: "Week",
      readonly_progress: true,
      popup_on: "click",
      on_date_change: (task: any, start: Date, end: Date) => {
        const toISO = (d: Date) => d.toISOString().slice(0, 10);
        updateTaskDates(task.id, toISO(start), toISO(end), projectId);
      },
    });
  }, [tasks, projectId]);

  if (tasks.length === 0) {
    return (
      <div className="rounded-xl border border-black/10 bg-white p-6 text-center text-sm text-black/40">
        No tasks or schedule items have both a start and due date yet — add dates above to see them here.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-black/10 bg-white p-4">
      <style>
        {`.bar-wrapper.${TASK_CLASS} .bar { fill: ${TASK_COLOR}22; stroke: ${TASK_COLOR}; stroke-dasharray: 3,2; }
.bar-wrapper.${TASK_CLASS} .bar-progress { fill: ${TASK_COLOR}; }
` +
          categories
            .map(
              (c) => `.bar-wrapper.${slug(c)} .bar { fill: ${colorByCategory.get(c)}22; stroke: ${colorByCategory.get(c)}; }
.bar-wrapper.${slug(c)} .bar-progress { fill: ${colorByCategory.get(c)}; }`
            )
            .join("\n")}
      </style>
      <div className="mb-3 flex flex-wrap gap-3">
        <div className="flex items-center gap-1.5 text-xs text-black/60">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full border border-dashed"
            style={{ borderColor: TASK_COLOR, backgroundColor: TASK_COLOR + "22" }}
          />
          Punch list tasks
        </div>
        {categories.map((c) => (
          <div key={c} className="flex items-center gap-1.5 text-xs text-black/60">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colorByCategory.get(c) }} />
            {c}
          </div>
        ))}
      </div>
      <div ref={containerRef} className="gantt-container" />
    </div>
  );
}
