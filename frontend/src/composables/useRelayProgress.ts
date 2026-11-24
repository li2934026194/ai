import { computed } from "vue";
import { useM7WorkspaceStore } from "@/stores/m7Workspace";

export function useRelayProgress() {
  const ws = useM7WorkspaceStore();

  const copyDone = computed(() => {
    const items = ws.summary?.core_items || [];
    return items.filter((i) => i.slot.startsWith("copy_") && i.done).length;
  });

  const imgDone = computed(() => ws.summary?.buyer_preview.images.length ?? 0);

  const vidAplusDone = computed(() => {
    const items = ws.summary?.core_items || [];
    return items.filter((i) => (i.slot === "vid_15s" || i.slot === "aplus_page") && i.done).length;
  });

  const steps = computed(() => [
    { path: "/m7/copy", num: "1", label: "商品文案", status: `${copyDone.value}/4`, done: copyDone.value === 4 },
    { path: "/m7/images", num: "2", label: "1+4 电商套图", status: `${imgDone.value}/5`, done: imgDone.value === 5 },
    { path: "/m7/video-aplus", num: "3", label: "视频与A+长页", status: `${vidAplusDone.value}/2`, done: vidAplusDone.value === 2 },
    {
      path: "/m7/compliance",
      num: "4",
      label: "合规总览导出",
      status: `${ws.doneCnt}/8`,
      done: ws.summary?.approval_status === "APPROVED",
    },
  ]);

  return {
    copyDone,
    imgDone,
    vidAplusDone,
    steps,
  };
}
