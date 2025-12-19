import { RequestCoalescer } from '../../src/proxy/coalescer';

describe('RequestCoalescer', () => {
  let coalescer: RequestCoalescer;

  beforeEach(() => {
    coalescer = new RequestCoalescer();
  });

  it('should only execute once for simultaneous requests with the same key', async () => {
    const task = jest.fn().mockImplementation(() => new Promise(resolve => setTimeout(() => resolve('data'), 50)));
    
    const p1 = coalescer.execute('test-key', task);
    const p2 = coalescer.execute('test-key', task);
    
    const [res1, res2] = await Promise.all([p1, p2]);
    
    expect(res1).toBe('data');
    expect(res2).toBe('data');
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('should execute again after the previous task finishes', async () => {
    const task = jest.fn().mockResolvedValue('data');
    
    await coalescer.execute('test-key', task);
    await coalescer.execute('test-key', task);
    
    expect(task).toHaveBeenCalledTimes(2);
  });

  it('should handle errors correctly and still cleanup', async () => {
    const task = jest.fn().mockRejectedValue(new Error('fail'));
    
    await expect(coalescer.execute('test-key', task)).rejects.toThrow('fail');
    
    const newTask = jest.fn().mockResolvedValue('success');
    const res = await coalescer.execute('test-key', newTask);
    
    expect(res).toBe('success');
    expect(newTask).toHaveBeenCalledTimes(1);
  });
});
