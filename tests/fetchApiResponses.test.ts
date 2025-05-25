import axios, { AxiosResponse } from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as fetchApiResponsesModule from '../fetchApiResponses';

// Mock external dependencies
jest.mock('axios');
jest.mock('fs');
jest.mock('path');

// Mock the module itself to get around the issue of not being able to mock methods
jest.mock('../fetchApiResponses', () => {
  const originalModule = jest.requireActual('../fetchApiResponses');
  return {
    ...originalModule,
    loadConfig: jest.fn(),
    fetchApiResponse: jest.fn(),
    saveApiResponseToFile: jest.fn(),
    fetchAndSaveApiResponses: jest.fn(),
    main: jest.fn()
  };
});

describe('fetchApiResponses', () => {
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
  
  describe('loadConfig', () => {
    const originalLoadConfig = jest.requireActual('../fetchApiResponses').loadConfig;
    
    it('should load and parse config file when it exists', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue('{"version":"v1","apis":[{"name":"API 1"}]}');
      
      const result = originalLoadConfig('/path/to/config.json');
      
      expect(fs.existsSync).toHaveBeenCalledWith('/path/to/config.json');
      expect(fs.readFileSync).toHaveBeenCalledWith('/path/to/config.json', 'utf-8');
      expect(result).toEqual({ version: 'v1', apis: [{ name: 'API 1' }] });
    });
    
    it('should log error and return null when file does not exist', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      
      const result = originalLoadConfig('/path/to/nonexistent.json');
      
      expect(fs.existsSync).toHaveBeenCalledWith('/path/to/nonexistent.json');
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Config file not found'));
      expect(result).toBeNull();
    });
  });
  
  describe('fetchApiResponse', () => {
    const originalFetchApiResponse = jest.requireActual('../fetchApiResponses').fetchApiResponse;
    
    it('should fetch and return response for GET request', async () => {
      const mockResponse = { 
        data: { key: 'value' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {}
      } as AxiosResponse;
      
      (axios as unknown as jest.MockedFunction<typeof axios>).mockResolvedValueOnce(mockResponse);
      
      const result = await originalFetchApiResponse(
        'http://example.com/api',
        'GET',
        { Authorization: 'token' },
        {},
        'v1'
      );
      
      expect(axios).toHaveBeenCalledWith({
        url: 'http://example.com/api',
        method: 'GET',
        headers: { Authorization: 'token' },
        data: undefined
      });
      expect(result).toEqual(mockResponse.data);
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Fetched response from'));
    });
    
    it('should include params in data for POST request', async () => {
      const mockResponse = { 
        data: { key: 'value' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {}
      } as AxiosResponse;
      
      (axios as unknown as jest.MockedFunction<typeof axios>).mockResolvedValueOnce(mockResponse);
      
      const result = await originalFetchApiResponse(
        'http://example.com/api',
        'POST',
        { 'Content-Type': 'application/json' },
        { param: 'value' },
        'v1'
      );
      
      expect(axios).toHaveBeenCalledWith({
        url: 'http://example.com/api',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        data: { param: 'value' }
      });
      expect(result).toEqual(mockResponse.data);
    });
    
    it('should handle API errors and return null', async () => {
      const mockError = new Error('API Error');
      (axios as unknown as jest.MockedFunction<typeof axios>).mockRejectedValueOnce(mockError);
      
      const result = await originalFetchApiResponse(
        'http://example.com/api',
        'GET',
        {},
        {},
        'v1'
      );
      
      expect(result).toBeNull();
      // Update this to match the actual error message format
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to fetch data from v1 http://example.com/api:',
        mockError
      );
    });
  });
  
  describe('saveApiResponseToFile', () => {
    const originalSaveApiResponseToFile = jest.requireActual('../fetchApiResponses').saveApiResponseToFile;
    
    it('should save API response to file as JSON', () => {
      const response = { key: 'value' };
      const filePath = '/path/to/output.json';
      
      originalSaveApiResponseToFile(response, filePath);
      
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        filePath,
        JSON.stringify(response, null, 2),
        'utf-8'
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Response saved to'));
    });
  });
  
  describe('fetchAndSaveApiResponses', () => {
    const originalFetchAndSaveApiResponses = jest.requireActual('../fetchApiResponses').fetchAndSaveApiResponses;
    
    const mockConfig = {
      version: 'v1',
      apis: [
        {
          name: 'API 1',
          url: 'http://example.com/api1',
          method: 'GET',
          headers: { Authorization: 'token' }
        },
        {
          name: 'API 2',
          url: 'http://example.com/api2',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          params: { param: 'value' }
        }
      ]
    };
    
    beforeEach(() => {
      // Reset all mocks completely
      jest.resetAllMocks();
      
      // Set up mocks for dependencies
      (fetchApiResponsesModule.loadConfig as jest.Mock).mockReturnValue(mockConfig);
      (fetchApiResponsesModule.fetchApiResponse as jest.Mock)
        .mockResolvedValueOnce({ data: 'response1' })
        .mockResolvedValueOnce({ data: 'response2' });
        
      (path.join as jest.Mock)
        .mockImplementation((dir: string, file: string) => `${dir}/${file}`);
    });
    
    it('should fetch and save all API responses', async () => {
      const result = await originalFetchAndSaveApiResponses('/path/to/config.json', '/path/to/output');
      
      // Now this should return true because we've mocked loadConfig
      expect(result).toBe(true);
      expect(fetchApiResponsesModule.loadConfig).toHaveBeenCalledWith('/path/to/config.json');
      expect(fetchApiResponsesModule.fetchApiResponse).toHaveBeenCalledTimes(2);
      expect(fetchApiResponsesModule.saveApiResponseToFile).toHaveBeenCalledTimes(2);
      
      expect(fetchApiResponsesModule.fetchApiResponse).toHaveBeenNthCalledWith(
        1,
        'http://example.com/api1',
        'GET',
        { Authorization: 'token' },
        {},
        'v1'
      );
      
      expect(fetchApiResponsesModule.fetchApiResponse).toHaveBeenNthCalledWith(
        2,
        'http://example.com/api2',
        'POST',
        { 'Content-Type': 'application/json' },
        { param: 'value' },
        'v1'
      );
      
      expect(fetchApiResponsesModule.saveApiResponseToFile).toHaveBeenCalledWith(
        { data: 'response1' },
        '/path/to/output/API 1.json'
      );
      
      expect(fetchApiResponsesModule.saveApiResponseToFile).toHaveBeenCalledWith(
        { data: 'response2' },
        '/path/to/output/API 2.json'
      );
    });
    
    it('should return false when config loading fails', async () => {
      // Mock config file not existing
      (fetchApiResponsesModule.loadConfig as jest.Mock).mockReturnValue(null);
      
      const result = await originalFetchAndSaveApiResponses('/path/to/config.json', '/path/to/output');
      
      expect(result).toBe(false);
      expect(fetchApiResponsesModule.fetchApiResponse).not.toHaveBeenCalled();
    });
    
    it('should skip saving when API response is null', async () => {
      // Mock first call to fetchApiResponse returning null
      (fetchApiResponsesModule.fetchApiResponse as jest.Mock)
        .mockReset()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ data: 'response2' });
      
      await originalFetchAndSaveApiResponses('/path/to/config.json', '/path/to/output');
      
      expect(fetchApiResponsesModule.saveApiResponseToFile).toHaveBeenCalledTimes(1);
      expect(fetchApiResponsesModule.saveApiResponseToFile).toHaveBeenCalledWith(
        { data: 'response2' },
        '/path/to/output/API 2.json'
      );
    });
  });
  
  describe('main function', () => {
    const originalMain = jest.requireActual('../fetchApiResponses').main;
    
    beforeEach(() => {
      // Reset all mocks
      jest.resetAllMocks();
      
      // Mock existence checks for directories
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      (fs.mkdirSync as jest.Mock).mockImplementation(() => undefined);
      
      // Mock fetchAndSaveApiResponses to control return value
      (fetchApiResponsesModule.fetchAndSaveApiResponses as jest.Mock).mockResolvedValue(true);
    });
    
    it('should return error code when arguments are missing', async () => {
      const exitCode = await originalMain([]);
      
      expect(exitCode).toBe(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Usage:'));
      expect(fs.existsSync).not.toHaveBeenCalled(); // Should exit before any directory checks
    });
    
    it('should create output directory if it does not exist', async () => {
      // We'll specifically mock the directory check to fail
      (fs.existsSync as jest.Mock).mockImplementation((path) => {
        return !path.includes('apiResponses'); // Any path with 'apiResponse' doesn't exist
      });
      
      await originalMain(['v1', '/path/to/config.json']);
      
      expect(fs.existsSync).toHaveBeenCalledWith('./apiResponses/v1');
      expect(fs.mkdirSync).toHaveBeenCalledWith('./apiResponses/v1', { recursive: true });
    });
    
    it('should not create directory if it already exists', async () => {
      // We'll specifically mock the directory check to succeed
      (fs.existsSync as jest.Mock).mockImplementation((path) => {
        return path.includes('apiResponses'); // Any path with 'apiResponse' exists
      });
      
      await originalMain(['v1', '/path/to/config.json']);
      
      expect(fs.existsSync).toHaveBeenCalledWith('./apiResponses/v1');
      expect(fs.mkdirSync).not.toHaveBeenCalled();
    });
    
    it('should call fetchAndSaveApiResponses with correct arguments', async () => {
      await originalMain(['v1', '/path/to/config.json']);
      
      expect(fetchApiResponsesModule.fetchAndSaveApiResponses).toHaveBeenCalledWith(
        '/path/to/config.json', 
        './apiResponses/v1'
      );
    });
    
    it('should return success code when fetchAndSaveApiResponses succeeds', async () => {
      // Mock successful return
      (fetchApiResponsesModule.fetchAndSaveApiResponses as jest.Mock).mockResolvedValue(true);
      
      const exitCode = await originalMain(['v1', '/path/to/config.json']);
      
      expect(exitCode).toBe(0);
    });
    
    it('should return error code when fetchAndSaveApiResponses fails', async () => {
      // Mock failure return
      (fetchApiResponsesModule.fetchAndSaveApiResponses as jest.Mock).mockResolvedValue(false);
      
      const exitCode = await originalMain(['v1', '/path/to/config.json']);
      
      expect(exitCode).toBe(1);
    });
  });
});