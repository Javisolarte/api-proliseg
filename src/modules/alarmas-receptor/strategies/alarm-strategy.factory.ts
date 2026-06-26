import { Injectable, NotFoundException } from '@nestjs/common';
import { AlarmPanelStrategy } from './alarm-panel.strategy';
import { IntelbrasStrategy } from './intelbras.strategy';

@Injectable()
export class AlarmStrategyFactory {
  constructor(
    private readonly intelbrasStrategy: IntelbrasStrategy,
  ) {}

  /**
   * Resuelve la estrategia adecuada según la marca/modelo del panel de alarma.
   * Si no se especifica, por defecto utiliza Intelbras AMT.
   */
  getStrategy(marcaModelo: string): AlarmPanelStrategy {
    const brand = (marcaModelo || '').toLowerCase();
    
    // De momento la prioridad absoluta es Intelbras (AMT)
    if (brand.includes('intelbras') || brand.includes('intel') || brand.includes('interbras') || brand.includes('amt')) {
      return this.intelbrasStrategy;
    }
    
    // Si no se encuentra, por defecto retornamos la de Intelbras como estrategia base de monitoreo/control
    return this.intelbrasStrategy;
  }
}
