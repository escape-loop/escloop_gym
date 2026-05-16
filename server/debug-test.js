const http = require('http');

const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/gym/members?page=1&limit=2000&status=all&includeInactivePlans=true&flatten=false',
    method: 'GET',
};

// Note: Ensure the path matches the route definition in server.js: app.use('/gym', Router) -> Router.get("/members", ...)
// So it should be /gym/members

const req = http.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            console.log('--- DEBUG REPORT ---');
            if (json.success) {
                console.log('Total Members Found:', json.members.length);
                const withPackage = json.members.filter(m => m.packageName);
                console.log('Members with ANY packageName:', withPackage.length);
                withPackage.forEach(m => {
                    console.log(`[${m.memberId}] ${m.fullName}: Package="${m.packageName}" | Status="${m.status}"`);
                });
                const withoutPackage = json.members.filter(m => !m.packageName);
                console.log('Members WITHOUT packageName:', withoutPackage.length);
                withoutPackage.slice(0, 5).forEach(m => {
                    console.log(`[${m.memberId}] ${m.fullName}: Status="${m.status}" (No package)`);
                });

            } else {
                console.log('API Returned Error:', json.message);
            }
        } catch (e) {
            console.log('JSON Parse Error:', e.message);
            console.log('Raw Response (preview):', data.substring(0, 500));
        }
    });
});

req.on('error', (e) => {
    console.error(`Request Error: ${e.message}`);
});

req.end();
