import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';


import { KeyIdModalComponent } from './key-id-modal.component';
import { SharedModule } from '../../shared/shared.module';

@NgModule({
  declarations: [KeyIdModalComponent],
  imports: [CommonModule, SharedModule],
  exports: [KeyIdModalComponent]
})
export class KeyIdModalModule {}
