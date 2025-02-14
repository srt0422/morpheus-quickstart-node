const puppeteer = require('puppeteer');
const { spawn } = require('child_process');
const path = require('path');
const waitPort = require('wait-port');

const TEST_TIMEOUT = 120000; // 2 minutes timeout
const OPENAI_API_URL = process.env.OPENAI_API_URL || 'https://nfa-proxy-2cmojdnxfq-uw.a.run.app';
const CHAT_COMPLETIONS_PATH = process.env.CHAT_COMPLETIONS_PATH || '/v1/chat/completions';
const MODEL_NAME = "LMR-Hermes-2-Theta-Llama-3-8B";
const TEST_PROMPT = 'Write a hello world program in Python';
const DEV_SERVER_PORT = 3000;

jest.setTimeout(TEST_TIMEOUT);

describe('Chat Functionality', () => {
  let browser;
  let page;
  let nextProcess;

  beforeAll(async () => {
    // Start the Next.js development server with environment variables
    console.log('Starting Next.js development server...');
    nextProcess = spawn('npm', ['run', 'dev'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        OPENAI_API_URL,
        CHAT_COMPLETIONS_PATH,
        NEXT_PUBLIC_CHAT_COMPLETIONS_PATH: CHAT_COMPLETIONS_PATH,
        MODEL_NAME,
        PORT: DEV_SERVER_PORT.toString(),
        NODE_ENV: 'test'
      }
    });

    // Log server output for debugging
    nextProcess.stdout.on('data', (data) => {
      console.log(`Next.js server stdout: ${data}`);
    });
    nextProcess.stderr.on('data', (data) => {
      console.log(`Next.js server stderr: ${data}`);
    });

    // Wait for the development server to be ready
    console.log('Waiting for development server to be ready...');
    try {
      await waitPort({
        host: 'localhost',
        port: DEV_SERVER_PORT,
        timeout: 60000 // 1 minute timeout for server start
      });
      console.log('Development server is ready');

      // Additional wait to ensure the server is fully initialized
      await new Promise(resolve => setTimeout(resolve, 5000));
      console.log('Additional wait completed');
    } catch (err) {
      console.error('Failed waiting for dev server:', err);
      throw err;
    }

    // Launch browser
    console.log('Launching browser...');
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    // Create new page
    page = await browser.newPage();
    await page.setDefaultTimeout(30000); // 30 seconds timeout for all page operations

    // Enable request interception and logging
    await page.setRequestInterception(true);
    page.on('request', request => {
      console.log(`Request: ${request.method()} ${request.url()}`);
      // Check if this is the chat completion request
      if (request.url().includes('/v1/chat/completions')) {
        console.log('Chat completion request body:', request.postData());
      }
      request.continue();
    });
    page.on('response', response => {
      console.log(`Response: ${response.status()} ${response.url()}`);
      // Log chat completion response
      if (response.url().includes('/v1/chat/completions')) {
        response.text().then(text => {
          console.log('Chat completion response:', text);
        }).catch(err => {
          console.error('Error reading response:', err);
        });
      }
    });
    
    console.log('Setup complete');
  }, TEST_TIMEOUT);

  afterAll(async () => {
    console.log('Starting cleanup...');
    if (page) {
      await page.close().catch(err => console.error('Error closing page:', err));
    }
    if (browser) {
      await browser.close().catch(err => console.error('Error closing browser:', err));
      console.log('Browser closed');
    }
    if (nextProcess) {
      nextProcess.kill();
      console.log('Next.js server killed');
    }
    console.log('Cleanup complete');
  });

  test('should send message and receive streaming response', async () => {
    console.log('Starting test...');
    
    try {
      // Navigate to the chat page
      console.log('Navigating to chat page...');
      const response = await page.goto(`http://localhost:${DEV_SERVER_PORT}`);
      console.log('Navigation complete with status:', response.status());

      if (response.status() !== 200) {
        const content = await response.text();
        console.error('Page load failed. Content:', content);
        throw new Error(`Page load failed with status ${response.status()}`);
      }

      // Wait for the textarea to be available
      console.log('Waiting for textarea...');
      const textarea = await page.waitForSelector('textarea[name="message"]', {
        timeout: 30000,
        visible: true
      });
      console.log('Textarea found');

      // Type the test prompt
      console.log('Typing test prompt...');
      await textarea.type(TEST_PROMPT);
      console.log('Test prompt typed');

      // Submit the form
      console.log('Submitting form...');
      const submitButton = await page.waitForSelector('input[type="submit"]', {
        timeout: 30000,
        visible: true
      });
      await submitButton.click();
      console.log('Form submitted');

      // Wait for the chat completion request
      console.log('Waiting for chat completion request...');
      const chatRequest = await page.waitForRequest(
        request => request.url().includes('/v1/chat/completions'),
        { timeout: 30000 }
      );
      console.log('Chat completion request made:', chatRequest.method());

      // Wait for the response
      console.log('Waiting for response...');
      try {
        await page.waitForFunction(
          () => document.querySelector('.assistantMessage')?.textContent?.length > 0,
          { 
            timeout: 60000,
            polling: 1000
          }
        );
        console.log('Response received');
      } catch (err) {
        console.error('Error waiting for response:', err);
        // Get the page content for debugging
        const content = await page.content();
        console.error('Page content:', content);
        throw err;
      }

      // Get the response text
      const responseText = await page.evaluate(
        () => document.querySelector('.assistantMessage')?.textContent
      );
      console.log('Response text:', responseText);

      // Verify the response
      expect(responseText?.length).toBeGreaterThan(0);
      console.log('Test complete');
    } catch (error) {
      console.error('Test failed:', error);
      // Get the page content for debugging
      const content = await page.content();
      console.error('Page content at failure:', content);
      throw error;
    }
  }, TEST_TIMEOUT);
}); 