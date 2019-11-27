import { Injectable } from "@angular/core";
import { alert } from "bootprompt";

import { XMLFile, XMLFilesService,
         XMLUploadAndTransformService } from "wed-demo-lib";
import { ConcordanceCleaner } from "./concordance-cleaner";
import { ProcessingError } from "./util";

@Injectable()
export class ConcordanceUploadAndCleanupService
extends XMLUploadAndTransformService {
  constructor(private readonly xmlFiles: XMLFilesService) {
    super("Concordance cleanup");
  }

  async process(file: XMLFile): Promise<void> {
    try {
      await new ConcordanceCleaner(this.xmlFiles, true).perform(file);
    }
    catch (err) {
      if (err instanceof ProcessingError) {
        this.reportFailure(err.title !== undefined ? err.title : "Error",
                           err.message);
        throw err;
      }

      this.reportFailure("Internal failure", err.toString());
      throw err;
    }
  }

  reportFailure(title: string, message: string): void {
    alert({
      title,
      message,
    });
  }
}
