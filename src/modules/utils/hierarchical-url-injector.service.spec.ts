import { HierarchicalUrlInjectorService } from './hierarchical-url-injector.service';

describe('HierarchicalUrlInjectorService', () => {
  const service = new HierarchicalUrlInjectorService();

  it('adds hierarchical URLs using nested park data', () => {
    const ride: any = {
      name: 'Ride X',
      park: { id: 1, name: 'Park Y', continent: 'Europe', country: 'Germany' },
    };

    const result = service.addUrlToRide(ride);
    expect(result.hierarchicalUrl).toBe('/parks/europe/germany/park-y/ride-x');
    expect(result.park.hierarchicalUrl).toBe('/parks/europe/germany/park-y');
  });

  it('falls back to context when park data is incomplete', () => {
    const ride: any = {
      name: 'Ride Z',
      park: { id: 1, continent: '', country: '' },
    };
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const result = service.addUrlToRide(ride, {
      continent: 'Europe',
      country: 'Germany',
      name: 'Park Z',
    });

    warnSpy.mockRestore();

    expect(result.hierarchicalUrl).toBe('/parks/europe/germany/park-z/ride-z');
    expect(result.park.hierarchicalUrl).toBe('/parks/unknown/unknown/unknown');
  });
});
