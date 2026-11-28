import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PaiementsDemande } from './paiements-demande';

describe('PaiementsDemande', () => {
  let component: PaiementsDemande;
  let fixture: ComponentFixture<PaiementsDemande>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PaiementsDemande],
    }).compileComponents();

    fixture = TestBed.createComponent(PaiementsDemande);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
