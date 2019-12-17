import { NgModule } from "@angular/core";

import { WedDemoDashboardComponent, WedDemoModule, XMLTransformService,
         XMLUploadAndTransformService } from "wed-demo-lib";

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

//
// Originally we had this module set so that it would load ``configuration``
// from wed-demo-lib and just modify that. Turns out that AOT does not work if
// we do that. So we have to duplicate the initialization code from wed-demo-lib
// here. :-(
//
@NgModule({
  imports: [
    WedDemoModule,
  ],
  providers: [
    // Providers above are those of wed-demo. What follows is what we add.
    {
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
    }],
  bootstrap: [ WedDemoDashboardComponent ],
})
// tslint:disable-next-line:no-unnecessary-class
export class AppModule { }
