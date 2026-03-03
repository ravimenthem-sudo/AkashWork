import http from 'http';

const paths = [
    '/',
    '/health',
    '/api/health',
    '/chat',
    '/api/chat',
    '/query',
    '/api/query',
    '/chatbot/query',
    '/api/chatbot/query',
    '/v1/chat/completions',
    '/api/v1/chat',
    '/message',
    '/api/message'
];

const checkPath = (path) => {
    return new Promise((resolve) => {
        const options = {
            hostname: 'localhost',
            port: 8035,
            path: path,
            method: 'GET', // Try GET first as it's safer for health checks
            timeout: 2000
        };

        const req = http.request(options, (res) => {
            resolve({ path, status: res.statusCode });
        });

        req.on('error', (e) => {
            resolve({ path, error: e.message });
        });

        req.on('timeout', () => {
            req.destroy();
            resolve({ path, error: 'timeout' });
        });

        req.end();
    });
};

async function run() {
    console.log('Probing localhost:8035...');
    for (const path of paths) {
        const result = await checkPath(path);
        if (!result.error) {
            console.log(`Path: ${result.path}, Status: ${result.status}`);
        } else {
            // console.log(`Path: ${result.path}, Error: ${result.error}`);
        }
    }
}

run();
