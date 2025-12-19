import { generateCacheKey } from '../../src/utils/hash';

describe('Hash Utils', () => {
  describe('generateCacheKey', () => {
    it('should generate a deterministic hash for method and params', () => {
      const method = 'getAccountInfo';
      const params = ['Address123'];
      
      const hash1 = generateCacheKey(method, params);
      const hash2 = generateCacheKey(method, params);
      
      expect(hash1).toBeDefined();
      expect(typeof hash1).toBe('string');
      expect(hash1).toBe(hash2);
    });

    it('should generate different hashes for different methods', () => {
      const hash1 = generateCacheKey('method1', []);
      const hash2 = generateCacheKey('method2', []);
      
      expect(hash1).not.toBe(hash2);
    });

    it('should generate different hashes for different params', () => {
      const method = 'getAccountInfo';
      const hash1 = generateCacheKey(method, ['A']);
      const hash2 = generateCacheKey(method, ['B']);
      
      expect(hash1).not.toBe(hash2);
    });

    it('should handle empty params', () => {
      const hash = generateCacheKey('method', []);
      expect(hash).toBeDefined();
    });

    it('should handle complex params objects', () => {
      const method = 'complex';
      const params = [{ a: 1, b: '2' }, true];
      const hash = generateCacheKey(method, params);
      expect(hash).toBeDefined();
    });
  });
});
