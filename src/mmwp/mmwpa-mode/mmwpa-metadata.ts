import { EName } from "salve";

import { util } from "wed";
import { Metadata } from "wed/modes/generic/metadata";

// tslint:disable-next-line:no-http-string
const MY_NAMESPACE = "http://mangalamresearch.org/ns/mmwp/doc";

export class MMWPAMetadata implements Metadata {
  readonly version: "2";

  getNamespaceMappings(): Record<string, string> {
    return {
      // tslint:disable-next-line:no-http-string
      "": MY_NAMESPACE,
    };
  }

  isInline(node: Element): boolean {
    const originalName = util.getOriginalName(node);
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

  unresolveName(name: EName): string | undefined {
    if (name.ns === MY_NAMESPACE) {
      return name.name;
    }

    return undefined;
  }
}
