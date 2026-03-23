import http from 'http';

const path = '/api/chatbot/query';

const checkOptions = () => {
    return new Promise((resolve) => {
        const options = {
            hostname: 'localhost',
            port: 8035,
            path: path,
            method: 'OPTIONS',
            headers: {
                'Origin': 'http://localhost:5173',
                'Access-Control-Request-Method': 'POST'
            }
        };

        const req = http.request(options, (res) => {
            resolve({ method: 'OPTIONS', status: res.statusCode, headers: res.headers });
        });

        req.on('error', (e) => {
            resolve({ method: 'OPTIONS', error: e.message });
        });

        req.end();
    });
};

const checkPost = () => {
    return new Promise((resolve) => {
        const data = JSON.stringify({
            query: "What are my tasks?",
            context: { role: "executive" }
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
            res.on('end', () => resolve({ method: 'POST', status: res.statusCode, body: body }));
        });

        req.on('error', (e) => {
            resolve({ method: 'POST', error: e.message });
        });

        req.write(data);
        req.end();
    });
};

async function run() {
    console.log('Probing OPTIONS and POST on localhost:8035/api/chatbot/query...');

    const optionsResult = await checkOptions();
    console.log('OPTIONS Result:', optionsResult);

    const postResult = await checkPost();
    console.log('POST Result:', postResult);
}

run();
