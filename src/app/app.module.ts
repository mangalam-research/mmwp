import { NgModule } from "@angular/core";

import { configuration, XMLTransformService,  XMLUploadAndTransformService,
       } from "wed-demo-lib";

import { ConcordanceCleanupTransformService,
       } from "./concordance-cleanup-transform.service";
import { ConcordanceToDocTransformService,
       } from "./concordance-to-doc-transform.service";
import { ConcordanceUploadAndCleanupService,
       } from "./concordance-upload-and-cleanup.service";
import { CoNLLTransformService } from "./conll-transform.service";
import { CSVTransformService } from "./csv-transform.service";
import { SemanticInformationTransformService,
       } from "./semantic-information-transform.service";

export const cf: NgModule = Object.assign({}, configuration);

// tslint:disable-next-line:no-non-null-assertion
cf.providers = cf.providers!.concat([{
  provide: XMLTransformService,
  useClass: ConcordanceCleanupTransformService,
  multi: true,
}, {
  provide: XMLTransformService,
  useClass: ConcordanceToDocTransformService,
  multi: true,
}, {
  provide: XMLTransformService,
  useClass: CoNLLTransformService,
  multi: true,
}, {
  provide: XMLTransformService,
  useClass: SemanticInformationTransformService,
  multi: true,
}, {
  provide: XMLTransformService,
  useClass: CSVTransformService,
  multi: true,
}, {
  provide: XMLUploadAndTransformService,
  useClass: ConcordanceUploadAndCleanupService,
  multi: true,
}, {
  provide: "Mode",
  useValue: {
    name: "mmwpa-mode",
    path: "../../../mmwpa-mode",
  },
  multi: true,
}]);
@NgModule(cf)
// tslint:disable-next-line:no-unnecessary-class
export class AppModule { }
