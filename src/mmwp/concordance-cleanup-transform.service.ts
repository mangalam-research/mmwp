import { Injectable } from "@angular/core";
import { alert } from "bootprompt";

import { ProcessingService } from "dashboard/processing.service";
import { XMLFile } from "dashboard/xml-file";
import { XMLFilesService } from "dashboard/xml-files.service";
import { XMLTransformService } from "dashboard/xml-transform.service";
import { ConcordanceCleaner } from "./concordance-cleaner";
import { ProcessingError } from "./util";

@Injectable()
export class ConcordanceCleanupTransformService extends XMLTransformService {
  constructor(private readonly processing: ProcessingService,
              private readonly xmlFiles: XMLFilesService) {
    super("Concordance cleanup");
  }

  async perform(input: XMLFile): Promise<XMLFile[]> {
    this.processing.start(1);
    let ret: XMLFile[];
    try {
      ret = await new ConcordanceCleaner(this.xmlFiles, false).perform(input);
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
    finally {
      this.processing.increment();
      this.processing.stop();
    }

    return ret;
  }

  reportFailure(title: string, message: string): void {
    alert({
      title,
      message,
    });
  }
}
