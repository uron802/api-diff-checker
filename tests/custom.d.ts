declare namespace jest {
  interface MockInstance<T, Y extends any[]> {
    mockImplementation(fn: (...args: Y) => T): this;
    mockReturnValue(val: T): this;
    mockReturnValueOnce(val: T): this;
    mockResolvedValue(val: T): this;
    mockRejectedValue(val: any): this;
  }
}