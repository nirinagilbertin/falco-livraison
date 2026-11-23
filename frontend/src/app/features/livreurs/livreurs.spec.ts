import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Livreurs } from './livreurs';

describe('Livreurs', () => {
  let component: Livreurs;
  let fixture: ComponentFixture<Livreurs>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Livreurs],
    }).compileComponents();

    fixture = TestBed.createComponent(Livreurs);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
