/**
 * A prototype application for the Meaning Mapper.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
import { platformBrowserDynamic } from "@angular/platform-browser-dynamic";

import { AppModule } from "dashboard/app.module";
import { ChunksService } from "dashboard/chunks.service";
import { ProcessingService } from "dashboard/processing.service";
import { XMLFilesService } from "dashboard/xml-files.service";
import { XMLTransformService } from "dashboard/xml-transform.service";

import { ConcordanceTransformService,
       } from "./mmwp/concordance-transform.service";
import { CoNLLTransformService } from "./mmwp/conll-transform.service";

// tslint:disable-next-line:no-floating-promises
platformBrowserDynamic([
  ChunksService,
  XMLFilesService,
  ProcessingService, {
  provide: XMLTransformService,
  useClass: ConcordanceTransformService,
  multi: true,
}, {
  provide: XMLTransformService,
  useClass: CoNLLTransformService,
  multi: true,
}, {
  provide: "Mode",
  useValue: {
    name: "mmwpa-mode",
    path: "mmwp/mmwpa-mode/mmwpa-mode",
  },
  multi: true,
}]).bootstrapModule(AppModule);
