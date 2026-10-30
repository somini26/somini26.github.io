import { rmSync } from "node:fs";
// Remove only the generated output so deleted or newly drafted posts cannot remain public.
rmSync(new URL("../_site/", import.meta.url), { recursive: true, force: true });
