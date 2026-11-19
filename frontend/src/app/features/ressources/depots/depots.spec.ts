import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Depots } from './depots';

describe('Depots', () => {
  let component: Depots;
  let fixture: ComponentFixture<Depots>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Depots],
    }).compileComponents();

    fixture = TestBed.createComponent(Depots);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
