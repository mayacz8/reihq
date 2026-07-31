"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Called directly from the client-side Gantt chart when a bar is
// dragged/resized to a new date range.
export async function updateTaskDates(taskId: string, startDate: string, endDate: string, projectId: string) {
  const supabase = createClient();
  await supabase
    .from("renovation_tasks")
    .update({ start_date: startDate, due_date: endDate })
    .eq("id", taskId);
  revalidatePath(`/renovations/${projectId}`);
}
