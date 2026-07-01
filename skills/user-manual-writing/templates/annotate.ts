// annotate.ts — Playwright helper: plain screenshots + numbered-marker screenshots with a legend.
// Copy into the target project's e2e harness (e.g. e2e/user-manual/fixtures/annotate.ts) and
// import Page/Locator from that project's own @playwright/test install.
import type { Page, Locator } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

export type Marker = {
  target: Locator;
  n: number;
  label: string;
  type?: "click" | "dblclick" | "scroll";
  place?: "tl" | "tr" | "bl" | "br";
};

const PLACE_OFFSET: Record<NonNullable<Marker["place"]>, [number, number]> = {
  tl: [0, 0],
  tr: [1, 0],
  bl: [0, 1],
  br: [1, 1],
};

export async function shot(page: Page, outPath: string) {
  await mkdir(dirname(outPath), { recursive: true });
  await page.screenshot({ path: outPath });
  return outPath;
}

export async function shotAnnotated(
  page: Page,
  outPath: string,
  markers: Marker[],
  color = "#c2261b",
) {
  await mkdir(dirname(outPath), { recursive: true });

  const points: { n: number; x: number; y: number }[] = [];
  const legend: string[] = [];

  for (const m of markers) {
    const count = await m.target.count();
    if (count !== 1) {
      console.warn(`[annotate] marker ${m.n} ("${m.label}") resolved to ${count} elements — narrow the selector.`);
    }
    const el = m.target.first();
    if (m.type === "click") await el.click();
    if (m.type === "dblclick") await el.dblclick();
    if (m.type === "scroll") await el.scrollIntoViewIfNeeded();

    const box = await el.boundingBox();
    if (!box) {
      console.warn(`[annotate] marker ${m.n} ("${m.label}") has no bounding box — element not visible, skipped.`);
      continue;
    }
    const [ox, oy] = PLACE_OFFSET[m.place ?? "tl"];
    points.push({ n: m.n, x: box.x + box.width * ox, y: box.y + box.height * oy });
    legend.push(`${m.n}. ${m.label}`);
  }

  await page.evaluate(
    ({ points, color }) => {
      const host = document.createElement("div");
      host.id = "__annotate_overlay__";
      host.style.cssText = "position:fixed;inset:0;z-index:999999;pointer-events:none;";
      for (const p of points) {
        const dot = document.createElement("div");
        dot.textContent = String(p.n);
        dot.style.cssText = `position:absolute;left:${p.x}px;top:${p.y}px;transform:translate(-50%,-50%);
          width:22px;height:22px;border-radius:50%;background:${color};color:#fff;
          font:600 12px/22px sans-serif;text-align:center;box-shadow:0 0 0 2px #fff;`;
        host.appendChild(dot);
      }
      document.body.appendChild(host);
    },
    { points, color },
  );

  await page.screenshot({ path: outPath });

  await page.evaluate(() => document.querySelector("#__annotate_overlay__")?.remove());

  // Clamped to the current viewport — resize the viewport before capture for below-the-fold
  // markers, restore after. See SKILL.md "Screenshots" step for the viewport/scroll gotchas.
  return { outPath, legend };
}
