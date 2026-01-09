import { Button } from "./Button";
import { Card } from "./Card";

export function DropzoneCard() {
  return (
    <Card className="shadow-md p-6">
      <div class="text-xs uppercase tracking-wide text-text2/70 mb-3">Upload</div>

      <div class="rounded-xl border border-dashed border-border p-8 text-center">
        <div class="mx-auto mb-3 h-10 w-10 rounded-lg bg-surface2 flex items-center justify-center">
          <span class="text-text2">⬆</span>
        </div>

        <div class="font-medium">Upload a product photo</div>
        <div class="mt-1 text-sm text-text2">PNG / JPG · best on plain background</div>

        <div class="mt-5 flex items-center justify-center gap-3">
          <Button type="button" data-action="upload">
            Upload Image
          </Button>
          <Button type="button" variant="secondary" data-action="demo">
            Try demo
          </Button>
        </div>
      </div>
    </Card>
  );
}
