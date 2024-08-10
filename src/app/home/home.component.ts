import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { KeyIdModalComponent } from './key-id-modal/key-id-modal.component';
@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
})
export class HomeComponent implements OnInit {
  constructor(private router: Router, private dialog: MatDialog) {}
  openDialog() {
    this.dialog.open(KeyIdModalComponent, {
    });
  }
  ngOnInit(): void {
    this.openDialog()
    console.log('HomeComponent INIT');
  }
}
