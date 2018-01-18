import { NgModule } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { BrowserModule } from "@angular/platform-browser";

import { AppComponent } from "dashboard/app.component";
import { ChunksService } from "dashboard/chunks.service";
import { ConfirmService } from "dashboard/confirm.service";
import { MetadataService } from "dashboard/metadata.service";
import { ModesService } from "dashboard/modes.service";
import { PacksService } from "dashboard/packs.service";
import { ProcessingComponent } from "dashboard/processing.component";
import { ProcessingService } from "dashboard/processing.service";
import { SchemasService } from "dashboard/schemas.service";
import { SharedModule } from "dashboard/shared.module";
import { UpgradeService } from "dashboard/upgrade.service";
import { XMLFilesService } from "dashboard/xml-files.service";
import { XMLTransformService } from "dashboard/xml-transform.service";

import { AppRoutingModule } from "./app-routing.module";
import { ConcordanceTransformService } from "./concordance-transform.service";
import { CoNLLTransformService } from "./conll-transform.service";
import { CSVTransformService } from "./csv-transform.service";
import { SemanticInformationTransformService,
       } from "./semantic-information-transform.service";

export const configuration: NgModule = {
  imports: [
    BrowserModule,
    FormsModule,
    SharedModule,
    AppRoutingModule,
  ],
  declarations: [
    AppComponent,
    ProcessingComponent,
  ],
  providers: [
    ConfirmService,
    ChunksService,
    XMLFilesService,
    ProcessingService,
    ModesService,
    SchemasService,
    MetadataService,
    UpgradeService,
    PacksService,
    // Everything above is essentially coming from wed-demo. The following
    // is what we add for mmwp.
    {
      provide: XMLTransformService,
      useClass: ConcordanceTransformService,
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
      provide: "Mode",
      useValue: {
        name: "mmwpa-mode",
        path: "mmwp/mmwpa-mode/mmwpa-mode",
      },
      multi: true,
    },
  ],
  bootstrap: [ AppComponent ],
};

// tslint:disable-next-line:no-stateless-class
@NgModule(configuration)
export class AppModule { }
