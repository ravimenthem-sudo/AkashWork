import http from 'http';

const paths = [
    '/chat',
    '/query',
    '/api/chatbot/query'
];

const checkPath = (path) => {
    return new Promise((resolve) => {
        const data = JSON.stringify({
            query: "hello",
            context: {}
        });

        const options = {
            hostname: 'localhost',
            port: 8035,
            path: path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length
            }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => resolve({ path, status: res.statusCode, body: body.substring(0, 500) }));
        });

        req.on('error', (e) => {
            resolve({ path, error: e.message });
        });

        req.write(data);
        req.end();
    });
};

async function run() {
    console.log('Probing POST localhost:8035...');
    for (const path of paths) {
        const result = await checkPath(path);
        console.log(`Path: ${result.path}, Status: ${result.status}, Body: ${result.body || result.error}`);
    }
}

run();
