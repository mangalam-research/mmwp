import { ProcessingService } from "dashboard/processing.service";
import { triggerDownload } from "dashboard/util";
import { XMLFile } from "dashboard/xml-file";
import { XMLTransformService } from "dashboard/xml-transform.service";

import { ProcessingError, validateAnnotatedDocument } from "./util";

export abstract class AnnotatedDocumentTransformService
extends XMLTransformService {
  constructor(private readonly processing: ProcessingService, name: string) {
    super(name);
  }

  async perform(input: XMLFile): Promise<string> {
    let transformed: string;
    try {
      this.processing.start(1);
      const data = await input.getData();
      const doc = await validateAnnotatedDocument(data);

      transformed = await this.transform(doc);
      triggerDownload(this.getOutputName(input), transformed);
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
    return transformed;
  }

  reportFailure(title: string, message: string): void {
    alert({
      title,
      message,
    });
  }

  protected abstract transform(doc: Document): Promise<string>;
  protected abstract getOutputName(input: XMLFile): string;
}
