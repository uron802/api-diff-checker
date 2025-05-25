import * as fs from 'fs';
import * as path from 'path';
import { diff } from 'deep-diff';
import * as compareApiResponsesModule from '../compareApiResponses';

jest.mock('fs');
jest.mock('path');
jest.mock('deep-diff');

describe('compareApiResponses', () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  
  beforeEach(() => {
    jest.clearAllMocks();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  
  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });
  
  describe('loadApiResponse', () => {
    it('should load JSON file when it exists', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue('{"data":"test"}');
      
      const result = compareApiResponsesModule.loadApiResponse('file.json');
      
      expect(fs.existsSync).toHaveBeenCalledWith('file.json');
      expect(fs.readFileSync).toHaveBeenCalledWith('file.json', 'utf-8');
      expect(result).toEqual({ data: 'test' });
    });
    
    it('should return null when file does not exist', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      
      const result = compareApiResponsesModule.loadApiResponse('missing.json');
      
      expect(fs.existsSync).toHaveBeenCalledWith('missing.json');
      expect(fs.readFileSync).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });
  
  describe('compareApiResponses', () => {
    it('should handle when both files are missing', () => {
      jest.spyOn(compareApiResponsesModule, 'loadApiResponse').mockReturnValue(null);
      
      compareApiResponsesModule.compareApiResponses('file1.json', 'file2.json');
      
      expect(consoleLogSpy).toHaveBeenCalledWith('Both files are missing: file1.json and file2.json');
    });
    
    it('should handle when first file is missing', () => {
      const loadApiResponseSpy = jest.spyOn(compareApiResponsesModule, 'loadApiResponse');
      loadApiResponseSpy.mockReturnValueOnce(null);
      loadApiResponseSpy.mockReturnValueOnce({});
      
      compareApiResponsesModule.compareApiResponses('file1.json', 'file2.json');
      
      expect(consoleLogSpy).toHaveBeenCalledWith('File missing in version 1: file1.json');
    });
    
    it('should handle when second file is missing', () => {
      const loadApiResponseSpy = jest.spyOn(compareApiResponsesModule, 'loadApiResponse');
      loadApiResponseSpy.mockReturnValueOnce({});
      loadApiResponseSpy.mockReturnValueOnce(null);
      
      compareApiResponsesModule.compareApiResponses('file1.json', 'file2.json');
      
      expect(consoleLogSpy).toHaveBeenCalledWith('File missing in version 2: file2.json');
    });
    
    it('should report differences between files', () => {
      const loadApiResponseSpy = jest.spyOn(compareApiResponsesModule, 'loadApiResponse');
      loadApiResponseSpy.mockReturnValueOnce({ data: 'value1' });
      loadApiResponseSpy.mockReturnValueOnce({ data: 'value2' });
      
      (diff as jest.Mock).mockReturnValue([{ path: ['data'], kind: 'E', lhs: 'value1', rhs: 'value2' }]);
      
      compareApiResponsesModule.compareApiResponses('file1.json', 'file2.json');
      
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Differences found between'));
    });
    
    it('should report when files match', () => {
      const loadApiResponseSpy = jest.spyOn(compareApiResponsesModule, 'loadApiResponse');
      loadApiResponseSpy.mockReturnValueOnce({ data: 'same' });
      loadApiResponseSpy.mockReturnValueOnce({ data: 'same' });
      
      (diff as jest.Mock).mockReturnValue(null);
      
      compareApiResponsesModule.compareApiResponses('file1.json', 'file2.json');
      
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('No differences found between'));
    });
  });
  
  describe('compareDirectories', () => {
    beforeEach(() => {
      // Mock loadApiResponse to avoid JSON parse errors with mock fs
      jest.spyOn(compareApiResponsesModule, 'loadApiResponse').mockReturnValue({});
      jest.spyOn(compareApiResponsesModule, 'compareApiResponses').mockImplementation(() => {});
    });
    
    it('should compare all files in both directories', () => {
      const files = ['file1.json', 'file2.json'];
      (fs.readdirSync as jest.Mock).mockReturnValue(files);
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (path.join as jest.Mock).mockImplementation((dir: string, file: string) => `${dir}/${file}`);
      
      compareApiResponsesModule.compareDirectories('dir1', 'dir2');
      
      expect(fs.readdirSync).toHaveBeenCalledWith('dir1');
      expect(fs.readdirSync).toHaveBeenCalledWith('dir2');
      expect(compareApiResponsesModule.compareApiResponses).toHaveBeenCalledTimes(2);
    });
    
    it('should report when a file is missing in dir1', () => {
      (fs.readdirSync as jest.Mock)
        .mockReturnValueOnce(['file1.json'])
        .mockReturnValueOnce(['file1.json', 'file2.json']);
      (fs.existsSync as jest.Mock)
        .mockImplementation((path: string) => !path.includes('dir1/file2.json'));
      (path.join as jest.Mock)
        .mockImplementation((dir: string, file: string) => `${dir}/${file}`);
      
      compareApiResponsesModule.compareDirectories('dir1', 'dir2');
      
      expect(consoleLogSpy).toHaveBeenCalledWith('File missing in version 1: dir1/file2.json');
    });
    
    it('should report when a file is missing in dir2', () => {
      (fs.readdirSync as jest.Mock)
        .mockReturnValueOnce(['file1.json', 'file2.json'])
        .mockReturnValueOnce(['file1.json']);
      (fs.existsSync as jest.Mock)
        .mockImplementation((path: string) => !path.includes('dir2/file2.json'));
      (path.join as jest.Mock)
        .mockImplementation((dir: string, file: string) => `${dir}/${file}`);
      
      compareApiResponsesModule.compareDirectories('dir1', 'dir2');
      
      expect(consoleLogSpy).toHaveBeenCalledWith('File missing in version 2: dir2/file2.json');
    });
  });
  
  describe('main function', () => {
    beforeEach(() => {
      jest.spyOn(compareApiResponsesModule, 'compareDirectories').mockImplementation();
    });
    
    it('should return error code when directories are not provided', () => {
      const exitCode = compareApiResponsesModule.main([]);
      
      expect(exitCode).toBe(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Please provide two directories'));
    });
    
    it('should return error code when dir1 does not exist', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      
      const exitCode = compareApiResponsesModule.main(['dir1', 'dir2']);
      
      expect(exitCode).toBe(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Directory not found: dir1'));
    });
    
    it('should return error code when dir2 does not exist', () => {
      (fs.existsSync as jest.Mock)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false);
      
      const exitCode = compareApiResponsesModule.main(['dir1', 'dir2']);
      
      expect(exitCode).toBe(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Directory not found: dir2'));
    });
    
    it('should compare directories and return success code when both exist', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      
      const exitCode = compareApiResponsesModule.main(['dir1', 'dir2']);
      
      expect(exitCode).toBe(0);
      expect(compareApiResponsesModule.compareDirectories).toHaveBeenCalledWith('dir1', 'dir2');
    });
  });
});

describe('compareApiResponses', () => {
  const mockedFs = fs as jest.Mocked<typeof fs>;
  const originalConsoleLog = console.log;
  let consoleOutput: string[] = [];
  
  beforeEach(() => {
    consoleOutput = [];
    console.log = jest.fn((...args) => {
      consoleOutput.push(args.join(' '));
    });
    
    mockedFs.existsSync.mockReturnValue(true);
  });
  
  afterEach(() => {
    console.log = originalConsoleLog;
    jest.resetAllMocks();
  });
  
  test('should report when both files are missing', () => {
    jest.spyOn(global, 'loadApiResponse' as any).mockImplementation(() => null);
    
    compareApiResponses('file1.json', 'file2.json');
    
    expect(consoleOutput).toContain('Both files are missing: file1.json and file2.json');
  });
  
  test('should report when file1 is missing', () => {
    jest.spyOn(global, 'loadApiResponse' as any)
      .mockImplementationOnce(() => null)
      .mockImplementationOnce(() => ({ key: 'value' }));
    
    compareApiResponses('file1.json', 'file2.json');
    
    expect(consoleOutput).toContain('File missing in version 1: file1.json');
  });
  
  test('should report when file2 is missing', () => {
    jest.spyOn(global, 'loadApiResponse' as any)
      .mockImplementationOnce(() => ({ key: 'value' }))
      .mockImplementationOnce(() => null);
    
    compareApiResponses('file1.json', 'file2.json');
    
    expect(consoleOutput).toContain('File missing in version 2: file2.json');
  });
  
  test('should report when differences are found', () => {
    jest.spyOn(global, 'loadApiResponse' as any)
      .mockImplementationOnce(() => ({ key: 'value1' }))
      .mockImplementationOnce(() => ({ key: 'value2' }));
    
    compareApiResponses('file1.json', 'file2.json');
    
    expect(consoleOutput[0]).toContain('Differences found between file1.json and file2.json');
    expect(consoleOutput[1]).toContain('key');
  });
  
  test('should report when no differences are found', () => {
    const sameObject = { key: 'value' };
    jest.spyOn(global, 'loadApiResponse' as any)
      .mockImplementationOnce(() => sameObject)
      .mockImplementationOnce(() => sameObject);
    
    compareApiResponses('file1.json', 'file2.json');
    
    expect(consoleOutput).toContain('No differences found between file1.json and file2.json. The responses match.');
  });
});

describe('compareDirectories', () => {
  const mockedFs = fs as jest.Mocked<typeof fs>;
  const mockedPath = path as jest.Mocked<typeof path>;
  const originalConsoleLog = console.log;
  let consoleOutput: string[] = [];
  
  beforeEach(() => {
    consoleOutput = [];
    console.log = jest.fn((...args) => {
      consoleOutput.push(args.join(' '));
    });
    
    mockedPath.join.mockImplementation((dir, file) => `${dir}/${file}`);
  });
  
  afterEach(() => {
    console.log = originalConsoleLog;
    jest.resetAllMocks();
  });
  
  test('should compare files from both directories', () => {
    const dir1 = '/test/dir1';
    const dir2 = '/test/dir2';
    const files = ['file1.json', 'file2.json', 'file3.json'];
    
    mockedFs.readdirSync.mockReturnValueOnce(files as any);
    mockedFs.readdirSync.mockReturnValueOnce(files as any);
    mockedFs.existsSync.mockReturnValue(true);
    
    const compareApiResponsesSpy = jest.spyOn(global, 'compareApiResponses' as any).mockImplementation(() => {});
    
    compareDirectories(dir1, dir2);
    
    expect(mockedFs.readdirSync).toHaveBeenCalledWith(dir1);
    expect(mockedFs.readdirSync).toHaveBeenCalledWith(dir2);
    expect(compareApiResponsesSpy).toHaveBeenCalledTimes(3);
    expect(compareApiResponsesSpy).toHaveBeenCalledWith(`${dir1}/file1.json`, `${dir2}/file1.json`);
    expect(compareApiResponsesSpy).toHaveBeenCalledWith(`${dir1}/file2.json`, `${dir2}/file2.json`);
    expect(compareApiResponsesSpy).toHaveBeenCalledWith(`${dir1}/file3.json`, `${dir2}/file3.json`);
  });
  
  test('should report missing files in version 1', () => {
    const dir1 = '/test/dir1';
    const dir2 = '/test/dir2';
    const files1 = ['file1.json'];
    const files2 = ['file1.json', 'file2.json'];
    
    mockedFs.readdirSync.mockReturnValueOnce(files1 as any);
    mockedFs.readdirSync.mockReturnValueOnce(files2 as any);
    
    mockedFs.existsSync.mockImplementation((path: any) => !path.includes('file2'));
    
    const compareApiResponsesSpy = jest.spyOn(global, 'compareApiResponses' as any).mockImplementation(() => {});
    
    compareDirectories(dir1, dir2);
    
    expect(consoleOutput).toContain(`File missing in version 1: ${dir1}/file2.json`);
    expect(compareApiResponsesSpy).toHaveBeenCalledTimes(1);
    expect(compareApiResponsesSpy).toHaveBeenCalledWith(`${dir1}/file1.json`, `${dir2}/file1.json`);
  });
  
  test('should report missing files in version 2', () => {
    const dir1 = '/test/dir1';
    const dir2 = '/test/dir2';
    const files1 = ['file1.json', 'file2.json'];
    const files2 = ['file1.json'];
    
    mockedFs.readdirSync.mockReturnValueOnce(files1 as any);
    mockedFs.readdirSync.mockReturnValueOnce(files2 as any);
    
    mockedFs.existsSync.mockImplementation((path: any) => !path.includes(`${dir2}/file2`));
    
    const compareApiResponsesSpy = jest.spyOn(global, 'compareApiResponses' as any).mockImplementation(() => {});
    
    compareDirectories(dir1, dir2);
    
    expect(consoleOutput).toContain(`File missing in version 2: ${dir2}/file2.json`);
    expect(compareApiResponsesSpy).toHaveBeenCalledTimes(1);
    expect(compareApiResponsesSpy).toHaveBeenCalledWith(`${dir1}/file1.json`, `${dir2}/file1.json`);
  });
});

describe('main', () => {
  const mockedFs = fs as jest.Mocked<typeof fs>;
  
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(global, 'compareDirectories' as any).mockImplementation(() => {});
  });
  
  afterEach(() => {
    jest.resetAllMocks();
  });
  
  test('should return error code when directories are not provided', () => {
    const result = main([]);
    
    expect(result).toBe(1);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Please provide two directories'));
  });
  
  test('should return error code when directory 1 does not exist', () => {
    mockedFs.existsSync.mockReturnValueOnce(false);
    
    const result = main(['dir1', 'dir2']);
    
    expect(result).toBe(1);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Directory not found: dir1'));
  });
  
  test('should return error code when directory 2 does not exist', () => {
    mockedFs.existsSync.mockReturnValueOnce(true).mockReturnValueOnce(false);
    
    const result = main(['dir1', 'dir2']);
    
    expect(result).toBe(1);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Directory not found: dir2'));
  });
  
  test('should compare directories and return success code when both directories exist', () => {
    mockedFs.existsSync.mockReturnValue(true);
    const compareDirectoriesSpy = jest.spyOn(global, 'compareDirectories' as any).mockImplementation(() => {});
    
    const result = main(['dir1', 'dir2']);
    
    expect(result).toBe(0);
    expect(compareDirectoriesSpy).toHaveBeenCalledWith('dir1', 'dir2');
  });
});