import { Metadata } from "wed/modes/generic/metadata";
import { getOriginalName } from "wed/util";

export class MMWPAMetadata implements Metadata {
  readonly version: "2";

  getNamespaceMappings(): Record<string, string> {
    return {
      // tslint:disable-next-line:no-http-string
      "": "http://mangalamresearch.org/ns/mmwp/doc",
    };
  }

  isInline(node: Element): boolean {
    const originalName = getOriginalName(node);
    const parts = originalName.split(":");
    const local = (parts.length === 1) ? parts[0] : parts[1];

    return local === "word";
  }

  shortDescriptionFor(): undefined {
    return undefined;
  }

  documentationLinkFor(): undefined {
    return undefined;
  }
}
