import * as fs from 'fs';
import * as path from 'path';
import { diff } from 'deep-diff';
import * as compareApiResponsesModule from '../compareApiResponses';

// Mock external dependencies
jest.mock('fs');
jest.mock('path');
jest.mock('deep-diff');

// Mock the module itself to get around the issue of not being able to mock methods
jest.mock('../compareApiResponses', () => {
  const originalModule = jest.requireActual('../compareApiResponses');
  return {
    ...originalModule,
    loadApiResponse: jest.fn(),
    compareApiResponses: jest.fn(),
    compareDirectories: jest.fn(),
    main: jest.fn()
  };
});

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
      // Set up our mocks
      const mockFileContent = '{"data":"test"}';
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(mockFileContent);
      
      // Since we've mocked the module, call the real implementation manually
      const originalLoadApiResponse = jest.requireActual('../compareApiResponses').loadApiResponse;
      const result = originalLoadApiResponse('file.json');
      
      expect(fs.existsSync).toHaveBeenCalledWith('file.json');
      expect(fs.readFileSync).toHaveBeenCalledWith('file.json', 'utf-8');
      expect(result).toEqual({ data: 'test' });
    });
    
    it('should return null when file does not exist', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      
      const originalLoadApiResponse = jest.requireActual('../compareApiResponses').loadApiResponse;
      const result = originalLoadApiResponse('missing.json');
      
      expect(fs.existsSync).toHaveBeenCalledWith('missing.json');
      expect(fs.readFileSync).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });
  
  describe('compareApiResponses', () => {
    // Now we'll test the real implementation but using our mocked fs and deep-diff
    const originalCompareApiResponses = jest.requireActual('../compareApiResponses').compareApiResponses;
    
    it('should handle when both files are missing', () => {
      // Mock fs.existsSync to return false for both files
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      
      originalCompareApiResponses('file1.json', 'file2.json');
      
      expect(consoleLogSpy).toHaveBeenCalledWith('Both files are missing: file1.json and file2.json');
    });
    
    it('should handle when first file is missing', () => {
      // Mock fs.existsSync to return false for first file and true for second file
      (fs.existsSync as jest.Mock).mockImplementation((path: string) => {
        return path === 'file2.json'; // Only the second file exists
      });
      
      // Mock readFileSync to return valid JSON for file2
      (fs.readFileSync as jest.Mock).mockReturnValue('{"key": "value"}');
      
      originalCompareApiResponses('file1.json', 'file2.json');
      
      expect(consoleLogSpy).toHaveBeenCalledWith('File missing in version 1: file1.json');
    });
    
    it('should handle when second file is missing', () => {
      // Mock fs.existsSync to return true for first file and false for second file
      (fs.existsSync as jest.Mock).mockImplementation((path: string) => {
        return path === 'file1.json'; // Only the first file exists
      });
      
      // Mock readFileSync to return valid JSON for file1
      (fs.readFileSync as jest.Mock).mockReturnValue('{"key": "value"}');
      
      originalCompareApiResponses('file1.json', 'file2.json');
      
      expect(consoleLogSpy).toHaveBeenCalledWith('File missing in version 2: file2.json');
    });
    
    it('should report differences between files', () => {
      // Mock fs.existsSync to return true for all files
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      
      // Mock readFileSync to return different JSON for each file
      (fs.readFileSync as jest.Mock)
        .mockReturnValueOnce('{"data": "value1"}')
        .mockReturnValueOnce('{"data": "value2"}');
      
      // Mock diff to return differences
      (diff as jest.Mock).mockReturnValue([{ path: ['data'], kind: 'E', lhs: 'value1', rhs: 'value2' }]);
      
      originalCompareApiResponses('file1.json', 'file2.json');
      
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Differences found between'));
    });
    
    it('should report when files match', () => {
      // Mock fs.existsSync to return true for all files
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      
      // Mock readFileSync to return the same JSON for both files
      (fs.readFileSync as jest.Mock).mockReturnValue('{"data": "same"}');
      
      // Mock diff to return null (no differences)
      (diff as jest.Mock).mockReturnValue(null);
      
      originalCompareApiResponses('file1.json', 'file2.json');
      
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('No differences found between'));
    });
  });
  
  describe('compareDirectories', () => {
    const originalCompareDirectories = jest.requireActual('../compareApiResponses').compareDirectories;
    const originalCompareApiResponses = jest.requireActual('../compareApiResponses').compareApiResponses;
    
    beforeEach(() => {
      // Clear all mocks to avoid interference
      jest.clearAllMocks();
      
      // Mock compareApiResponses to be able to verify it's called
      (compareApiResponsesModule.compareApiResponses as jest.Mock).mockImplementation(() => {});
    });
    
    it('should compare all files in both directories', () => {
      // Mock file operations
      const files = ['file1.json', 'file2.json'];
      (fs.readdirSync as jest.Mock).mockReturnValue(files);
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (path.join as jest.Mock).mockImplementation((dir: string, file: string) => `${dir}/${file}`);
      
      // We'll use the mocked compareApiResponses and call the real compareDirectories
      originalCompareDirectories('dir1', 'dir2');
      
      expect(fs.readdirSync).toHaveBeenCalledWith('dir1');
      expect(fs.readdirSync).toHaveBeenCalledWith('dir2');
      expect(compareApiResponsesModule.compareApiResponses).toHaveBeenCalledTimes(2);
    });
    
    it('should report when a file is missing in dir1', () => {
      // Set up files in directories
      (fs.readdirSync as jest.Mock)
        .mockReturnValueOnce(['file1.json']) // dir1 has only file1
        .mockReturnValueOnce(['file1.json', 'file2.json']); // dir2 has file1 and file2
        
      (path.join as jest.Mock).mockImplementation((dir: string, file: string) => `${dir}/${file}`);
      
      // Mock existsSync to make file2 missing in dir1
      (fs.existsSync as jest.Mock).mockImplementation((path: string) => {
        return path !== 'dir1/file2.json';
      });
      
      originalCompareDirectories('dir1', 'dir2');
      
      expect(consoleLogSpy).toHaveBeenCalledWith('File missing in version 1: dir1/file2.json');
    });
    
    it('should report when a file is missing in dir2', () => {
      // Set up files in directories
      (fs.readdirSync as jest.Mock)
        .mockReturnValueOnce(['file1.json', 'file2.json']) // dir1 has both files
        .mockReturnValueOnce(['file1.json']); // dir2 has only file1
        
      (path.join as jest.Mock).mockImplementation((dir: string, file: string) => `${dir}/${file}`);
      
      // Mock existsSync to make file2 missing in dir2
      (fs.existsSync as jest.Mock).mockImplementation((path: string) => {
        return path !== 'dir2/file2.json';
      });
      
      originalCompareDirectories('dir1', 'dir2');
      
      expect(consoleLogSpy).toHaveBeenCalledWith('File missing in version 2: dir2/file2.json');
    });
  });
  
  describe('main function', () => {
    const originalMain = jest.requireActual('../compareApiResponses').main;
    
    beforeEach(() => {
      jest.clearAllMocks();
      
      // Mock compareDirectories to be able to verify it's called
      (compareApiResponsesModule.compareDirectories as jest.Mock).mockImplementation(() => {});
    });
    
    it('should return error code when directories are not provided', () => {
      const exitCode = originalMain([]);
      
      expect(exitCode).toBe(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Please provide two directories'));
    });
    
    it('should return error code when dir1 does not exist', () => {
      // Mock existsSync to return false for dir1
      (fs.existsSync as jest.Mock).mockImplementation(path => path !== 'dir1');
      
      const exitCode = originalMain(['dir1', 'dir2']);
      
      expect(exitCode).toBe(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Directory not found: dir1'));
    });
    
    it('should return error code when dir2 does not exist', () => {
      // Mock existsSync to return true for dir1 but false for dir2
      (fs.existsSync as jest.Mock).mockImplementation(path => path !== 'dir2');
      
      const exitCode = originalMain(['dir1', 'dir2']);
      
      expect(exitCode).toBe(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Directory not found: dir2'));
    });
    
    it('should compare directories and return success code when both exist', () => {
      // Mock existsSync to return true for all directories
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      
      const exitCode = originalMain(['dir1', 'dir2']);
      
      expect(exitCode).toBe(0);
      expect(compareApiResponsesModule.compareDirectories).toHaveBeenCalledWith('dir1', 'dir2');
    });
  });
});