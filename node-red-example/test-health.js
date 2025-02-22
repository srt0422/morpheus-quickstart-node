const https = require('https');
const http = require('http');

async function checkServiceHealth(url) {
    return new Promise((resolve) => {
        const urlObj = new URL(url);
        const protocol = urlObj.protocol === 'https:' ? https : http;
        
        // Simple GET request to root URL, matching the shell script approach
        const options = {
            method: 'GET',
            hostname: urlObj.hostname,
            port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 8080),
            path: '/health',  // Check health endpoint instead of root path
            headers: {
                'Accept': '*/*',
                'User-Agent': 'curl/7.79.1'  // Mimic curl
            }
        };
        
        console.log('Testing health check with options:', options);
        
        const req = protocol.request(options, (res) => {
            console.log('Response status:', res.statusCode);
            console.log('Response headers:', res.headers);
            
            let data = '';
            res.on('data', chunk => {
                data += chunk;
            });
            
            res.on('end', () => {
                console.log('Response body:', data);
                // Check if response contains 'healthy' like the shell script
                resolve(data.toLowerCase().includes('healthy'));
            });
        });
        
        req.on('error', (err) => {
            console.error('Request error:', err);
            resolve(false);
        });
        
        req.setTimeout(5000, () => {
            console.error('Request timeout');
            req.destroy();
            resolve(false);
        });

        req.end();
    });
}

// Test both the deployed service and localhost
async function runTests() {
    const serviceUrl = 'https://nfa-proxy-5u4is4kvbq-uw.a.run.app';
    console.log('Testing deployed service:', serviceUrl);
    const deployedResult = await checkServiceHealth(serviceUrl);
    console.log('Deployed service health check result:', deployedResult);
    
    console.log('\nTesting localhost...');
    const localResult = await checkServiceHealth('http://localhost:8080');
    console.log('Local service health check result:', localResult);
}

runTests(); 