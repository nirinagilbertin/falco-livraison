import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MotDePasseInitial } from './mot-de-passe-initial';

describe('MotDePasseInitial', () => {
  let component: MotDePasseInitial;
  let fixture: ComponentFixture<MotDePasseInitial>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MotDePasseInitial],
    }).compileComponents();

    fixture = TestBed.createComponent(MotDePasseInitial);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
