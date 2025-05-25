import axios, { AxiosResponse } from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as fetchApiResponsesModule from '../fetchApiResponses';

jest.mock('axios');
jest.mock('fs');
jest.mock('path');

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
    it('should load and parse config file when it exists', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue('{"version":"v1","apis":[{"name":"API 1"}]}');
      
      const result = fetchApiResponsesModule.loadConfig('/path/to/config.json');
      
      expect(fs.existsSync).toHaveBeenCalledWith('/path/to/config.json');
      expect(fs.readFileSync).toHaveBeenCalledWith('/path/to/config.json', 'utf-8');
      expect(result).toEqual({ version: 'v1', apis: [{ name: 'API 1' }] });
    });
    
    it('should log error and return null when file does not exist', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      
      const result = fetchApiResponsesModule.loadConfig('/path/to/nonexistent.json');
      
      expect(fs.existsSync).toHaveBeenCalledWith('/path/to/nonexistent.json');
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Config file not found'));
      expect(result).toBeNull();
    });
  });
  
  describe('fetchApiResponse', () => {
    it('should fetch and return response for GET request', async () => {
      const mockResponse = { 
        data: { key: 'value' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {}
      } as AxiosResponse;
      
      (axios as jest.MockedFunction<typeof axios>).mockResolvedValueOnce(mockResponse);
      
      const result = await fetchApiResponsesModule.fetchApiResponse(
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
      
      (axios as jest.MockedFunction<typeof axios>).mockResolvedValueOnce(mockResponse);
      
      const result = await fetchApiResponsesModule.fetchApiResponse(
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
      (axios as jest.MockedFunction<typeof axios>).mockRejectedValueOnce(mockError);
      
      const result = await fetchApiResponsesModule.fetchApiResponse(
        'http://example.com/api',
        'GET',
        {},
        {},
        'v1'
      );
      
      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to fetch data'));
    });
  });
  
  describe('saveApiResponseToFile', () => {
    it('should save API response to file as JSON', () => {
      const response = { key: 'value' };
      const filePath = '/path/to/output.json';
      
      fetchApiResponsesModule.saveApiResponseToFile(response, filePath);
      
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        filePath,
        JSON.stringify(response, null, 2),
        'utf-8'
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Response saved to'));
    });
  });
  
  describe('fetchAndSaveApiResponses', () => {
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
      jest.spyOn(fetchApiResponsesModule, 'loadConfig').mockReturnValue(mockConfig);
      jest.spyOn(fetchApiResponsesModule, 'fetchApiResponse')
        .mockResolvedValueOnce({ data: 'response1' })
        .mockResolvedValueOnce({ data: 'response2' });
      jest.spyOn(fetchApiResponsesModule, 'saveApiResponseToFile').mockImplementation(() => {});
      
      (path.join as jest.Mock)
        .mockImplementation((dir: string, file: string) => `${dir}/${file}`);
    });
    
    it('should fetch and save all API responses', async () => {
      const result = await fetchApiResponsesModule.fetchAndSaveApiResponses('/path/to/config.json', '/path/to/output');
      
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
      jest.spyOn(fetchApiResponsesModule, 'loadConfig').mockReturnValueOnce(null);
      
      const result = await fetchApiResponsesModule.fetchAndSaveApiResponses('/path/to/config.json', '/path/to/output');
      
      expect(result).toBe(false);
      expect(fetchApiResponsesModule.fetchApiResponse).not.toHaveBeenCalled();
    });
    
    it('should skip saving when API response is null', async () => {
      jest.spyOn(fetchApiResponsesModule, 'fetchApiResponse')
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ data: 'response2' });
      
      await fetchApiResponsesModule.fetchAndSaveApiResponses('/path/to/config.json', '/path/to/output');
      
      expect(fetchApiResponsesModule.saveApiResponseToFile).toHaveBeenCalledTimes(1);
      expect(fetchApiResponsesModule.saveApiResponseToFile).toHaveBeenCalledWith(
        { data: 'response2' },
        '/path/to/output/API 2.json'
      );
    });
  });
  
  describe('main function', () => {
    beforeEach(() => {
      jest.spyOn(fetchApiResponsesModule, 'fetchAndSaveApiResponses').mockResolvedValue(true);
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      (fs.mkdirSync as jest.Mock).mockImplementation(() => undefined);
    });
    
    it('should return error code when arguments are missing', async () => {
      const exitCode = await fetchApiResponsesModule.main([]);
      
      expect(exitCode).toBe(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Usage:'));
      expect(fetchApiResponsesModule.fetchAndSaveApiResponses).not.toHaveBeenCalled();
    });
    
    it('should create output directory if it does not exist', async () => {
      await fetchApiResponsesModule.main(['v1', '/path/to/config.json']);
      
      expect(fs.existsSync).toHaveBeenCalledWith('./apiResponses/v1');
      expect(fs.mkdirSync).toHaveBeenCalledWith('./apiResponses/v1', { recursive: true });
    });
    
    it('should not create directory if it already exists', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      
      await fetchApiResponsesModule.main(['v1', '/path/to/config.json']);
      
      expect(fs.mkdirSync).not.toHaveBeenCalled();
    });
    
    it('should call fetchAndSaveApiResponses with correct arguments', async () => {
      await fetchApiResponsesModule.main(['v1', '/path/to/config.json']);
      
      expect(fetchApiResponsesModule.fetchAndSaveApiResponses).toHaveBeenCalledWith(
        '/path/to/config.json', 
        './apiResponses/v1'
      );
    });
    
    it('should return success code when fetchAndSaveApiResponses succeeds', async () => {
      const exitCode = await fetchApiResponsesModule.main(['v1', '/path/to/config.json']);
      
      expect(exitCode).toBe(0);
    });
    
    it('should return error code when fetchAndSaveApiResponses fails', async () => {
      jest.spyOn(fetchApiResponsesModule, 'fetchAndSaveApiResponses').mockResolvedValue(false);
      
      const exitCode = await fetchApiResponsesModule.main(['v1', '/path/to/config.json']);
      
      expect(exitCode).toBe(1);
    });
  });
});

describe('fetchApiResponse', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });
  
  test('should fetch and return API response for GET request', async () => {
    const url = 'http://example.com/api';
    const method = 'GET';
    const headers = { Authorization: 'token' };
    const params = {};
    const version = 'v1';
    const responseData = { data: 'value' };
    
    (axios as jest.Mock).mockImplementation(() => Promise.resolve({ data: responseData }));
    
    const result = await fetchApiResponse(url, method, headers, params, version);
    
    expect(axios).toHaveBeenCalledWith({
      url,
      method,
      headers,
      data: undefined
    });
    expect(result).toEqual(responseData);
  });
  
  test('should fetch and return API response for POST request', async () => {
    const url = 'http://example.com/api';
    const method = 'POST';
    const headers = { Authorization: 'token' };
    const params = { key: 'value' };
    const version = 'v1';
    const responseData = { data: 'value' };
    
    (axios as jest.Mock).mockImplementation(() => Promise.resolve({ data: responseData }));
    
    const result = await fetchApiResponse(url, method, headers, params, version);
    
    expect(axios).toHaveBeenCalledWith({
      url,
      method,
      headers,
      data: params
    });
    expect(result).toEqual(responseData);
  });
  
  test('should handle API error and return null', async () => {
    const url = 'http://example.com/api';
    const method = 'GET';
    const headers = {};
    const params = {};
    const version = 'v1';
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    (axios as jest.Mock).mockImplementation(() => Promise.reject(new Error('API error')));
    
    const result = await fetchApiResponse(url, method, headers, params, version);
    
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to fetch data'), expect.any(Error));
    expect(result).toBeNull();
  });
});

describe('saveApiResponseToFile', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });
  
  test('should save API response to file as JSON', () => {
    const response = { data: 'value' };
    const filePath = '/test/output.json';
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    
    saveApiResponseToFile(response, filePath);
    
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      filePath,
      JSON.stringify(response, null, 2),
      'utf-8'
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Response saved to'));
  });
});

describe('fetchAndSaveApiResponses', () => {
  const configPath = '/test/config.json';
  const outputDir = '/test/output';
  
  beforeEach(() => {
    jest.spyOn(global, 'loadConfig' as any).mockReturnValue({
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
          headers: { Authorization: 'token' },
          params: { key: 'value' }
        }
      ]
    });
    
    jest.spyOn(global, 'fetchApiResponse' as any).mockImplementation(async () => ({ data: 'value' }));
    jest.spyOn(global, 'saveApiResponseToFile' as any).mockImplementation(() => {});
    
    (path.join as jest.Mock).mockImplementation((dir, file) => `${dir}/${file}`);
  });
  
  afterEach(() => {
    jest.resetAllMocks();
  });
  
  test('should fetch and save responses for all APIs in the config', async () => {
    const fetchApiResponseSpy = jest.spyOn(global, 'fetchApiResponse' as any);
    const saveApiResponseToFileSpy = jest.spyOn(global, 'saveApiResponseToFile' as any);
    
    const result = await fetchAndSaveApiResponses(configPath, outputDir);
    
    expect(result).toBe(true);
    expect(fetchApiResponseSpy).toHaveBeenCalledTimes(2);
    expect(saveApiResponseToFileSpy).toHaveBeenCalledTimes(2);
    
    // Check first API call
    expect(fetchApiResponseSpy).toHaveBeenCalledWith(
      'http://example.com/api1', 
      'GET', 
      { Authorization: 'token' }, 
      {}, 
      'v1'
    );
    
    // Check second API call
    expect(fetchApiResponseSpy).toHaveBeenCalledWith(
      'http://example.com/api2',
      'POST',
      { Authorization: 'token' },
      { key: 'value' },
      'v1'
    );
    
    // Check file paths for saved responses
    expect(saveApiResponseToFileSpy).toHaveBeenCalledWith(
      { data: 'value' },
      `${outputDir}/API 1.json`
    );
    expect(saveApiResponseToFileSpy).toHaveBeenCalledWith(
      { data: 'value' },
      `${outputDir}/API 2.json`
    );
  });
  
  test('should return false when config loading fails', async () => {
    jest.spyOn(global, 'loadConfig' as any).mockReturnValueOnce(null);
    
    const result = await fetchAndSaveApiResponses(configPath, outputDir);
    
    expect(result).toBe(false);
  });
  
  test('should skip saving when API response is null', async () => {
    jest.spyOn(global, 'fetchApiResponse' as any)
      .mockResolvedValueOnce({ data: 'value' })
      .mockResolvedValueOnce(null);
    
    const saveApiResponseToFileSpy = jest.spyOn(global, 'saveApiResponseToFile' as any);
    
    await fetchAndSaveApiResponses(configPath, outputDir);
    
    expect(saveApiResponseToFileSpy).toHaveBeenCalledTimes(1);
  });
});

describe('main', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(global, 'fetchAndSaveApiResponses' as any).mockResolvedValue(true);
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    (fs.mkdirSync as jest.Mock).mockImplementation(() => undefined);
  });
  
  afterEach(() => {
    jest.resetAllMocks();
  });
  
  test('should return error code when version and config are not provided', async () => {
    const result = await main([]);
    
    expect(result).toBe(1);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Usage:'));
  });
  
  test('should create output directory if it does not exist', async () => {
    await main(['v1', '/test/config.json']);
    
    expect(fs.existsSync).toHaveBeenCalledWith('./apiResponses/v1');
    expect(fs.mkdirSync).toHaveBeenCalledWith('./apiResponses/v1', { recursive: true });
  });
  
  test('should not create output directory if it already exists', async () => {
    (fs.existsSync as jest.Mock).mockReturnValueOnce(true);
    
    await main(['v1', '/test/config.json']);
    
    expect(fs.existsSync).toHaveBeenCalledWith('./apiResponses/v1');
    expect(fs.mkdirSync).not.toHaveBeenCalled();
  });
  
  test('should call fetchAndSaveApiResponses with correct arguments', async () => {
    const fetchAndSaveApiResponsesSpy = jest.spyOn(global, 'fetchAndSaveApiResponses' as any);
    
    await main(['v1', '/test/config.json']);
    
    expect(fetchAndSaveApiResponsesSpy).toHaveBeenCalledWith(
      '/test/config.json',
      './apiResponses/v1'
    );
  });
  
  test('should return success code when fetchAndSaveApiResponses succeeds', async () => {
    jest.spyOn(global, 'fetchAndSaveApiResponses' as any).mockResolvedValueOnce(true);
    
    const result = await main(['v1', '/test/config.json']);
    
    expect(result).toBe(0);
  });
  
  test('should return error code when fetchAndSaveApiResponses fails', async () => {
    jest.spyOn(global, 'fetchAndSaveApiResponses' as any).mockResolvedValueOnce(false);
    
    const result = await main(['v1', '/test/config.json']);
    
    expect(result).toBe(1);
  });
});

describe('fetchApiResponse', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });
  
  test('should fetch and return API response for GET request', async () => {
    const url = 'http://example.com/api';
    const method = 'GET';
    const headers = { Authorization: '******' };
    const params = {};
    const version = 'v1';
    const responseData = { data: 'value' };
    
    mockedAxios.mockResolvedValue({ data: responseData });
    
    const result = await fetchApiResponse(url, method, headers, params, version);
    
    expect(mockedAxios).toHaveBeenCalledWith({
      url,
      method,
      headers,
      data: undefined
    });
    expect(result).toEqual(responseData);
  });
  
  test('should fetch and return API response for POST request', async () => {
    const url = 'http://example.com/api';
    const method = 'POST';
    const headers = { Authorization: '******' };
    const params = { key: 'value' };
    const version = 'v1';
    const responseData = { data: 'value' };
    
    mockedAxios.mockResolvedValue({ data: responseData });
    
    const result = await fetchApiResponse(url, method, headers, params, version);
    
    expect(mockedAxios).toHaveBeenCalledWith({
      url,
      method,
      headers,
      data: params
    });
    expect(result).toEqual(responseData);
  });
  
  test('should handle API error and return null', async () => {
    const url = 'http://example.com/api';
    const method = 'GET';
    const headers = {};
    const params = {};
    const version = 'v1';
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    mockedAxios.mockRejectedValue(new Error('API error'));
    
    const result = await fetchApiResponse(url, method, headers, params, version);
    
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to fetch data'), expect.any(Error));
    expect(result).toBeNull();
  });
});

describe('saveApiResponseToFile', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });
  
  test('should save API response to file as JSON', () => {
    const response = { data: 'value' };
    const filePath = '/test/output.json';
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    
    saveApiResponseToFile(response, filePath);
    
    expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
      filePath,
      JSON.stringify(response, null, 2),
      'utf-8'
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Response saved to'));
  });
});

describe('fetchAndSaveApiResponses', () => {
  const configPath = '/test/config.json';
  const outputDir = '/test/output';
  
  beforeEach(() => {
    jest.spyOn(global, 'loadConfig' as any).mockReturnValue({
      version: 'v1',
      apis: [
        {
          name: 'API 1',
          url: 'http://example.com/api1',
          method: 'GET',
          headers: { Authorization: '******' }
        },
        {
          name: 'API 2',
          url: 'http://example.com/api2',
          method: 'POST',
          headers: { Authorization: '******' },
          params: { key: 'value' }
        }
      ]
    });
    
    jest.spyOn(global, 'fetchApiResponse' as any).mockImplementation(async () => ({ data: 'value' }));
    jest.spyOn(global, 'saveApiResponseToFile' as any).mockImplementation(() => {});
    
    mockedPath.join.mockImplementation((dir, file) => `${dir}/${file}`);
  });
  
  afterEach(() => {
    jest.resetAllMocks();
  });
  
  test('should fetch and save responses for all APIs in the config', async () => {
    const fetchApiResponseSpy = jest.spyOn(global, 'fetchApiResponse' as any);
    const saveApiResponseToFileSpy = jest.spyOn(global, 'saveApiResponseToFile' as any);
    
    const result = await fetchAndSaveApiResponses(configPath, outputDir);
    
    expect(result).toBe(true);
    expect(fetchApiResponseSpy).toHaveBeenCalledTimes(2);
    expect(saveApiResponseToFileSpy).toHaveBeenCalledTimes(2);
    
    // Check first API call
    expect(fetchApiResponseSpy).toHaveBeenCalledWith(
      'http://example.com/api1', 
      'GET', 
      { Authorization: '******' }, 
      {}, 
      'v1'
    );
    
    // Check second API call
    expect(fetchApiResponseSpy).toHaveBeenCalledWith(
      'http://example.com/api2',
      'POST',
      { Authorization: '******' },
      { key: 'value' },
      'v1'
    );
    
    // Check file paths for saved responses
    expect(saveApiResponseToFileSpy).toHaveBeenCalledWith(
      { data: 'value' },
      `${outputDir}/API 1.json`
    );
    expect(saveApiResponseToFileSpy).toHaveBeenCalledWith(
      { data: 'value' },
      `${outputDir}/API 2.json`
    );
  });
  
  test('should return false when config loading fails', async () => {
    jest.spyOn(global, 'loadConfig' as any).mockReturnValueOnce(null);
    
    const result = await fetchAndSaveApiResponses(configPath, outputDir);
    
    expect(result).toBe(false);
  });
  
  test('should skip saving when API response is null', async () => {
    jest.spyOn(global, 'fetchApiResponse' as any)
      .mockResolvedValueOnce({ data: 'value' })
      .mockResolvedValueOnce(null);
    
    const saveApiResponseToFileSpy = jest.spyOn(global, 'saveApiResponseToFile' as any);
    
    await fetchAndSaveApiResponses(configPath, outputDir);
    
    expect(saveApiResponseToFileSpy).toHaveBeenCalledTimes(1);
  });
});

describe('main', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(global, 'fetchAndSaveApiResponses' as any).mockResolvedValue(true);
    mockedFs.existsSync.mockReturnValue(false);
    mockedFs.mkdirSync.mockImplementation(() => {});
  });
  
  afterEach(() => {
    jest.resetAllMocks();
  });
  
  test('should return error code when version and config are not provided', async () => {
    const result = await main([]);
    
    expect(result).toBe(1);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Usage:'));
  });
  
  test('should create output directory if it does not exist', async () => {
    await main(['v1', '/test/config.json']);
    
    expect(mockedFs.existsSync).toHaveBeenCalledWith('./apiResponses/v1');
    expect(mockedFs.mkdirSync).toHaveBeenCalledWith('./apiResponses/v1', { recursive: true });
  });
  
  test('should not create output directory if it already exists', async () => {
    mockedFs.existsSync.mockReturnValueOnce(true);
    
    await main(['v1', '/test/config.json']);
    
    expect(mockedFs.existsSync).toHaveBeenCalledWith('./apiResponses/v1');
    expect(mockedFs.mkdirSync).not.toHaveBeenCalled();
  });
  
  test('should call fetchAndSaveApiResponses with correct arguments', async () => {
    const fetchAndSaveApiResponsesSpy = jest.spyOn(global, 'fetchAndSaveApiResponses' as any);
    
    await main(['v1', '/test/config.json']);
    
    expect(fetchAndSaveApiResponsesSpy).toHaveBeenCalledWith(
      '/test/config.json',
      './apiResponses/v1'
    );
  });
  
  test('should return success code when fetchAndSaveApiResponses succeeds', async () => {
    jest.spyOn(global, 'fetchAndSaveApiResponses' as any).mockResolvedValueOnce(true);
    
    const result = await main(['v1', '/test/config.json']);
    
    expect(result).toBe(0);
  });
  
  test('should return error code when fetchAndSaveApiResponses fails', async () => {
    jest.spyOn(global, 'fetchAndSaveApiResponses' as any).mockResolvedValueOnce(false);
    
    const result = await main(['v1', '/test/config.json']);
    
    expect(result).toBe(1);
  });
});