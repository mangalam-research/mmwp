import { alert } from "bootprompt";

import { ProcessingService, triggerDownload, XMLFile,
         XMLTransformService } from "wed-demo-lib";

import { ProcessingError, validateAnnotatedDocument } from "./util";

export abstract class AnnotatedDocumentTransformService
extends XMLTransformService {
  constructor(private readonly processing: ProcessingService, name: string,
              protected readonly mimeType: string) {
    super(name);
  }

  async perform(input: XMLFile): Promise<string> {
    let transformed: string;
    try {
      this.processing.start(1);
      const data = await input.getData();
      const doc = await validateAnnotatedDocument(data);

      transformed = await this.transform(doc);
      triggerDownload(this.getOutputName(input), this.mimeType, transformed);
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
