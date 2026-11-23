import { Component } from '@angular/core';
import { Parametres } from '../parametres/parametres';
import { Tarifs } from '../tarifs/tarifs';

@Component({
  selector: 'app-configuration',
  imports: [Tarifs, Parametres],
  templateUrl: './configuration.html',
  styleUrl: './configuration.css',
})
export class Configuration {}