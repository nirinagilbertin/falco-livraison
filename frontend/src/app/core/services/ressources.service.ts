import { Injectable } from '@angular/core';
import { Depot, Vehicule, Zone } from '../models/ressources.model';
import { CrudService } from './crud.service';

@Injectable({ providedIn: 'root' })
export class DepotService extends CrudService<Depot> {
  constructor() {
    super('/depots');
  }
}

@Injectable({ providedIn: 'root' })
export class ZoneService extends CrudService<Zone> {
  constructor() {
    super('/zones');
  }
}

@Injectable({ providedIn: 'root' })
export class VehiculeService extends CrudService<Vehicule> {
  constructor() {
    super('/vehicules');
  }
}