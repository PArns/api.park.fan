import { HierarchicalUrlService } from './hierarchical-url.service';

describe('HierarchicalUrlService', () => {
  it('creates slugged park URLs', () => {
    const url = HierarchicalUrlService.generateParkUrl(
      'Europe',
      'Germany',
      'Phantasialand',
    );
    expect(url).toBe('/parks/europe/germany/phantasialand');
  });

  it('matches slugs correctly', () => {
    const match = HierarchicalUrlService.slugMatches(
      'phantasialand',
      'Phantasialand',
    );
    expect(match).toBe(true);
  });
});
